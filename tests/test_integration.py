"""Exercise Family Sink with Home Assistant registries, event bus and storage."""

import asyncio
import base64
from io import BytesIO
import json
from types import MappingProxyType, SimpleNamespace
from unittest.mock import AsyncMock
from zoneinfo import ZoneInfo

from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer
from homeassistant.auth import auth_manager_from_config
from homeassistant.auth.const import GROUP_ID_USER
from homeassistant.components import frontend
from homeassistant.components.http import KEY_HASS
from homeassistant.components.websocket_api.http import WebsocketAPIView
from homeassistant.config_entries import ConfigEntries, ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr, entity_registry as er, frame
from PIL import Image
import pytest

from custom_components import family_sink
from custom_components.family_sink import api, recorder
from custom_components.family_sink.const import DEFAULT_RULES, DOMAIN, PANEL_PATH
from custom_components.family_sink.discovery import BrushRegistry
from custom_components.family_sink.model import InputError, clean_rules, normalize_avatar, parse_history
from custom_components.family_sink.storage import FamilyStore

pytestmark = pytest.mark.asyncio


def entry_for(domain, identifier):
    return ConfigEntry(
        domain=domain, title="Fixture", data={}, options={}, source="user", unique_id=identifier,
        version=1, minor_version=1, discovery_keys=MappingProxyType({}), subentries_data=None,
    )


@pytest.fixture
async def hass(tmp_path):
    instance = HomeAssistant(str(tmp_path))
    instance.config.time_zone = "Europe/Oslo"
    instance.config_entries = ConfigEntries(instance, {})
    instance.http = SimpleNamespace(
        async_register_static_paths=AsyncMock(), supervisor_unix_socket_path=None,
    )
    frame.async_setup(instance)
    await instance.config_entries.async_initialize()
    if hasattr(dr, "async_setup"):
        dr.async_setup(instance)
    await dr.async_load(instance)
    await er.async_load(instance)
    yield instance
    await instance.async_stop(force=True)


@pytest.fixture
async def runtime(hass):
    entry = entry_for(DOMAIN, DOMAIN)
    assert await family_sink.async_setup(hass, {})
    assert await family_sink.async_setup_entry(hass, entry)
    yield entry.runtime_data
    if DOMAIN in hass.data:
        await family_sink.async_unload_entry(hass, entry)


def brush(hass, number, *, domain="oralb", standard=True):
    entry = entry_for(domain, f"device{number}")
    # Register the fixture without starting the production Bluetooth platform.
    hass.config_entries._entries[entry.entry_id] = entry
    device = dr.async_get(hass).async_get_or_create(
        config_entry_id=entry.entry_id,
        identifiers={("fixture", f"brush{number}")},
        name=f"Brush {number}",
    )
    registry = er.async_get(hass)
    common = {"device_id": device.id, "config_entry": entry}
    state = registry.async_get_or_create(
        "sensor", domain, f"fixture{number}a", suggested_object_id=f"renamed{number}a",
        translation_key="toothbrush_state" if standard else None, **common,
    )
    duration = registry.async_get_or_create(
        "sensor", domain, f"fixture{number}b", suggested_object_id=f"custom{number}b",
        original_device_class="duration" if standard else None, **common,
    )
    battery = registry.async_get_or_create(
        "sensor", domain, f"fixture{number}c", suggested_object_id=f"unrelated{number}c",
        original_device_class="battery" if standard else None, **common,
    )
    return SimpleNamespace(device=device.id, state=state, duration=duration, battery=battery)


async def create_profile(runtime, name, device=None, **properties):
    result = await api.save_profile(runtime, {"name": name, "device": device, **properties})
    return result["id"]


async def test_discovery_and_registry_rename(hass, runtime):
    one = brush(hass, 1)
    two = brush(hass, 2, domain="other")
    registry = BrushRegistry(hass)
    assert [item["id"] for item in registry.describe_devices()] == [one.device]
    assert two.device not in registry.auto
    person = await create_profile(runtime, "Rowan", one.device)
    assignment = runtime.recorder.assignments[person]
    assert (assignment.state, assignment.duration, assignment.battery) == (
        one.state.entity_id, one.duration.entity_id, one.battery.entity_id,
    )
    replacement = "sensor.new_name_fixture"
    er.async_get(hass).async_update_entity(one.state.entity_id, new_entity_id=replacement)
    await hass.async_block_till_done()
    assert runtime.recorder.assignments[person].state == replacement


async def test_manual_fallback_and_duplicate_ownership(hass, runtime):
    one = brush(hass, 1, standard=False)
    original = await create_profile(
        runtime, "Avery", one.device, manual={"state": one.state.id, "duration": one.duration.id},
    )
    assert runtime.recorder.assignments[original].state == one.state.entity_id
    with pytest.raises(InputError, match="duplicate_brush"):
        await create_profile(runtime, "Casey", manual={"state": one.state.id})
    archived = await create_profile(runtime, "Casey", one.device, active=False)
    assert archived not in runtime.recorder.assignments
    with pytest.raises(InputError, match="duplicate_brush"):
        await create_profile(runtime, "Casey", one.device, id=archived)
    renamed = er.async_get(hass).async_update_entity(one.duration.entity_id, new_entity_id="sensor.moved")
    await hass.async_block_till_done()
    assert renamed.id == one.duration.id
    assert runtime.recorder.assignments[original].duration == "sensor.moved"


async def test_members_without_a_fixed_limit_and_replacement_preserves_history(hass, runtime):
    brushes = [brush(hass, number) for number in range(7)]
    people = [await create_profile(runtime, f"Person {number}", item.device)
              for number, item in enumerate(brushes[:-1])]
    assert len(runtime.recorder.assignments) == 6
    await runtime.store.append("2026-02-04T12:00:00+01:00", people[0], 181)
    before = list(runtime.store.sessions)
    await create_profile(runtime, "Renamed", brushes[-1].device, id=people[0], team="Team", color="#12abcd")
    assert runtime.store.profiles[people[0]]["name"] == "Renamed"
    assert runtime.store.sessions == before
    assert runtime.recorder.assignments[people[0]].state == brushes[-1].state.entity_id


class Clock:
    """Advance scheduled callbacks without sleeping for the 30-second pause."""

    def __init__(self):
        self.now = 0
        self.timers = {}

    def call_later(self, _hass, delay, callback):
        assert delay == 30
        token = object()
        self.timers[token] = (self.now + delay, callback)
        return lambda: self.timers.pop(token, None)

    def advance(self, seconds):
        self.now += seconds
        for token, (due, callback) in list(self.timers.items()):
            if due <= self.now:
                self.timers.pop(token)
                callback(None)


def transition(hass, fixture, value, duration):
    hass.states.async_set(fixture.duration.entity_id, str(duration))
    hass.states.async_set(fixture.state.entity_id, value)


async def test_independent_pause_resume_snapshots_and_minimum(hass, runtime, monkeypatch):
    clock = Clock()
    monkeypatch.setattr(recorder, "async_call_later", clock.call_later)
    left, right = brush(hass, 1), brush(hass, 2)
    left_id = await create_profile(runtime, "Rowan", left.device)
    right_id = await create_profile(runtime, "Avery", right.device)
    transition(hass, left, "running", 0)
    transition(hass, right, "running", 0)
    transition(hass, left, "idle", 45)
    transition(hass, right, "idle", 19.6)
    hass.states.async_set(right.duration.entity_id, "0")
    clock.advance(29)
    assert runtime.store.sessions == []
    transition(hass, left, "running", 45)
    clock.advance(1)
    await hass.async_block_till_done()
    assert [(row["userId"], row["duration"]) for row in runtime.store.sessions] == [(right_id, 20)]
    transition(hass, left, "idle", 121)
    transition(hass, right, "running", 0)
    transition(hass, right, "idle", 19.4)
    clock.advance(30)
    await hass.async_block_till_done()
    assert [(row["userId"], row["duration"]) for row in runtime.store.sessions] == [
        (right_id, 20), (left_id, 121),
    ]


async def test_history_import_deduplication_and_persistence(hass, runtime):
    person = await create_profile(runtime, "Rowan")
    zone = ZoneInfo("Europe/Oslo")
    stamp = "2026-02-04T08:00:00"
    lines = [f"{stamp}|legacy|19", "2026-02-04T07:00:00Z|legacy|19",
             f"{stamp}|skip|30", "broken", f"{stamp}|legacy|-4"]
    rows, invalid = parse_history("\n".join(lines), zone)
    assert invalid == 2
    assert await runtime.store.import_rows(rows, {"legacy": person}) == {"added": 1, "duplicates": 1, "unmapped": 1}
    copy = FamilyStore(hass)
    await copy.load()
    assert copy.sessions[0]["duration"] == 19
    assert copy.sessions == runtime.store.sessions
    assert await copy.import_rows(rows, {"legacy": person}) == {"added": 0, "duplicates": 2, "unmapped": 1}
    with pytest.raises(InputError, match="invalid_mapping"):
        await copy.import_rows(rows, {"legacy": "unknown"})


async def test_storage_and_panel_lifecycle(hass, monkeypatch):
    clock = Clock()
    monkeypatch.setattr(recorder, "async_call_later", clock.call_later)
    entry = entry_for(DOMAIN, DOMAIN)
    assert await family_sink.async_setup(hass, {})
    assert await family_sink.async_setup_entry(hass, entry)
    panel = hass.data[frontend.DATA_PANELS][PANEL_PATH]
    assert panel.require_admin is False
    assert panel.config["_panel_custom"]["module_url"].startswith("/family_sink_assets/panel.js?")
    runtime = entry.runtime_data
    one = brush(hass, 1)
    person = await create_profile(runtime, "Avery", one.device, avatar="fox")
    image = normalize_avatar(demo_photo())
    await runtime.store.set_avatar(person, image)
    await runtime.store.append("2026-02-04T08:00:00+01:00", person, 20)
    async with runtime.store.lock:
        await runtime.store.save(rules=clean_rules({**DEFAULT_RULES, "missedDay": -11}))
    transition(hass, one, "running", 0)
    transition(hass, one, "idle", 80)
    assert clock.timers
    assert await family_sink.async_unload_entry(hass, entry)
    assert not clock.timers
    assert PANEL_PATH not in hass.data[frontend.DATA_PANELS]
    assert await family_sink.async_setup_entry(hass, entry)
    replacement = entry.runtime_data
    assert replacement.store.profiles[person]["avatar"] == "fox"
    assert replacement.store.avatars[person]["data"] == image
    assert replacement.store.rules["missedDay"] == -11
    assert replacement.store.sessions == runtime.store.sessions
    assert replacement.recorder.assignments[person].state == one.state.entity_id
    transition(hass, one, "running", 0)
    transition(hass, one, "idle", 100)
    clock.advance(30)
    await hass.async_block_till_done()
    assert len(replacement.store.sessions) == 2
    await family_sink.async_unload_entry(hass, entry)


def demo_photo():
    output = BytesIO()
    Image.new("RGB", (300, 200), "blue").save(output, "JPEG")
    return base64.b64encode(output.getvalue()).decode("ascii")


async def test_websocket_auth_and_permissions(hass, runtime):
    hass.auth = await auth_manager_from_config(hass, [], [])
    admin = await hass.auth.async_create_user("Administrator")
    member = await hass.auth.async_create_user("Family member", group_ids=[GROUP_ID_USER])
    assert admin.is_admin and not member.is_admin
    photo = demo_photo()
    app = web.Application()
    app[KEY_HASS] = hass
    app.router.add_get("/api/websocket", WebsocketAPIView().get)

    async def connect(client, user):
        refresh = await hass.auth.async_create_refresh_token(user, "http://localhost")
        socket = await client.ws_connect("/api/websocket")
        assert (await socket.receive_json())["type"] == "auth_required"
        await socket.send_json({"type": "auth", "access_token": hass.auth.async_create_access_token(refresh)})
        assert (await socket.receive_json())["type"] == "auth_ok"
        return socket

    async def request(socket, number, verb, **payload):
        await socket.send_json({"id": number, "type": f"{DOMAIN}/{verb}", **payload})
        return await socket.receive_json()

    async with TestClient(TestServer(app)) as client:
        unauthenticated = await client.ws_connect("/api/websocket")
        assert (await unauthenticated.receive_json())["type"] == "auth_required"
        denied = await request(unauthenticated, 1, "dashboard")
        assert denied["type"] == "auth_invalid"
        await unauthenticated.close()
        admin_socket = await connect(client, admin)
        result = await request(admin_socket, 1, "admin", action="profile", data={"name": "Rowan"})
        person = result["result"]["id"]
        assert (await request(admin_socket, 2, "admin", action="avatar", data={"person": person, "image": photo}))["success"]
        member_socket = await connect(client, member)
        assert (await request(member_socket, 1, "dashboard"))["result"]["profiles"][0]["name"] == "Rowan"
        avatar = (await request(member_socket, 2, "avatar", person=person))["result"]
        with Image.open(BytesIO(base64.b64decode(avatar))) as image:
            assert image.format == "PNG" and image.width == 256
            assert not image.getexif()
        for number, action in enumerate(("settings", "profile", "rules", "avatar", "import", "export"), 3):
            response = await request(member_socket, number, "admin", action=action)
            assert response["error"]["code"] == "unauthorized"
        assert await runtime.store.import_rows([], {}) == {"added": 0, "duplicates": 0, "unmapped": 0}
        await asyncio.gather(admin_socket.close(), member_socket.close())


async def test_defaults_example_matches_backend():
    with open("examples/default-rules.json", encoding="utf-8") as file:
        assert json.load(file) == DEFAULT_RULES
