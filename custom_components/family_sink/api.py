"""Authenticated Home Assistant WebSocket commands for the panel."""

from uuid import uuid4
from zoneinfo import ZoneInfo

from homeassistant.auth.permissions.const import POLICY_READ
from homeassistant.components import websocket_api as ws
from homeassistant.exceptions import Unauthorized
import probatio

from .const import DEFAULT_RULES, DOMAIN
from .discovery import BrushRegistry
from .model import InputError, ROLES, clean_profile, clean_rules, normalize_avatar, parse_history


@ws.websocket_command({
    "type": f"{DOMAIN}/dashboard",
    probatio.Optional("history_revision"): str,
})
@ws.async_response
async def dashboard(hass, connection, msg):
    """Return family data through the authenticated Home Assistant connection."""
    runtime = hass.data.get(DOMAIN)
    if runtime is None:
        connection.send_error(msg["id"], "unavailable", "unavailable")
        return
    store = runtime.store
    profiles = []
    for profile in store.profiles.values():
        person = profile["id"]
        assignment = runtime.recorder.assignments.get(person)
        allowed = {}
        for role in ROLES:
            entity = getattr(assignment, role, None)
            if entity and connection.user.permissions.check_entity(entity, POLICY_READ):
                allowed[role] = entity
        profiles.append({
            **{key: profile[key] for key in ("id", "name", "active", "team", "color", "avatar", "start")},
            "avatarRevision": store.avatars.get(person, {}).get("revision"),
            "entities": allowed,
        })
    result = {
        "profiles": profiles, "rules": store.rules, "timeZone": hass.config.time_zone,
        "historyRevision": store.history_revision,
    }
    if msg.get("history_revision") != store.history_revision:
        result["sessions"] = store.sessions
    connection.send_result(msg["id"], result)


@ws.websocket_command({"type": f"{DOMAIN}/avatar", probatio.Required("person"): str})
@ws.async_response
async def get_avatar(hass, connection, msg):
    """Serve a sanitized raster image only to authenticated users."""
    runtime = hass.data.get(DOMAIN)
    if runtime is None:
        connection.send_error(msg["id"], "unavailable", "unavailable")
        return
    store = runtime.store
    person = msg["person"]
    image = store.avatars.get(person) if person in store.profiles else None
    connection.send_result(msg["id"], image["data"] if image else None)


def settings_snapshot(runtime):
    """Build the administrative configuration and diagnostic view."""
    registry = BrushRegistry(runtime.hass)
    store = runtime.store
    diagnostics = []
    for person, profile in store.profiles.items():
        assignment = registry.resolve(profile)
        entities = {}
        for role in ROLES:
            entity = getattr(assignment, role)
            state = runtime.hass.states.get(entity) if entity else None
            entities[role] = {
                "entity": entity,
                "available": state is not None and state.state not in ("unknown", "unavailable"),
            }
        diagnostics.append({
            "person": person, "entities": entities,
            "conflict": person in runtime.recorder.conflicts,
            "pending": person in runtime.recorder.pending,
        })
    return {
        "profiles": list(store.profiles.values()),
        "rules": store.rules,
        "defaults": DEFAULT_RULES,
        "devices": registry.describe_devices(),
        "sensors": registry.describe_sensors(),
        "diagnostics": diagnostics,
        "sessionCount": len(store.sessions),
    }


async def save_profile(runtime, data):
    """Apply a profile edit and rebind state listeners when necessary."""
    person = data.get("id")
    store = runtime.store
    async with store.lock:
        if person is not None and (not isinstance(person, str) or person not in store.profiles):
            raise InputError("missing_profile")
        person = person or uuid4().hex
        profile = clean_profile(data, person)
        registry = BrushRegistry(runtime.hass)
        previous = store.profiles.get(person, {})
        if profile["device"] and profile["device"] != previous.get("device") and profile["device"] not in registry.devices:
            raise InputError("missing_device")
        assignment_changed = any(profile[key] != previous.get(key) for key in ("manual", "device"))
        assignment = registry.resolve(profile, strict=assignment_changed)
        if profile["active"] and any(
            assignment.claims & registry.resolve(other).claims
            for other_id, other in store.profiles.items() if other_id != person and other["active"]
        ):
            raise InputError("duplicate_brush")
        await store.save(profiles={**store.profiles, person: profile})
        runtime.recorder.rebuild()
    return {"id": person}


@ws.websocket_command({
    "type": f"{DOMAIN}/admin",
    probatio.Required("action"): probatio.In((
        "settings", "profile", "rules", "avatar", "preview", "import", "export",
    )),
    probatio.Optional("data", default=dict): dict,
})
@ws.async_response
async def admin(hass, connection, msg):
    """Read or mutate settings only for Home Assistant administrators."""
    if not connection.user.is_admin:
        raise Unauthorized
    runtime = hass.data.get(DOMAIN)
    if runtime is None:
        connection.send_error(msg["id"], "unavailable", "unavailable")
        return
    store = runtime.store
    data = msg["data"]
    try:
        match msg["action"]:
            case "settings":
                result = settings_snapshot(runtime)
            case "profile":
                result = await save_profile(runtime, data)
            case "rules":
                async with store.lock:
                    await store.save(rules=clean_rules(data))
                result = None
            case "avatar":
                person, payload = data.get("person"), data.get("image")
                if not isinstance(person, str) or person not in store.profiles:
                    raise InputError("missing_profile")
                if payload is not None and not isinstance(payload, str):
                    raise InputError("invalid_image")
                image = None if payload is None else await hass.async_add_executor_job(normalize_avatar, payload)
                await store.set_avatar(person, image)
                result = None
            case "preview" | "import":
                history = data.get("text")
                if not isinstance(history, str):
                    raise InputError("invalid_import")
                rows, invalid = await hass.async_add_executor_job(
                    parse_history, history, ZoneInfo(hass.config.time_zone),
                )
                if msg["action"] == "preview":
                    result = {
                        "sources": sorted({source for _, source, _ in rows}),
                        "valid": len(rows), "invalid": invalid,
                    }
                else:
                    mapping = data.get("mapping")
                    if not isinstance(mapping, dict):
                        raise InputError("invalid_mapping")
                    result = {**await store.import_rows(rows, mapping), "invalid": invalid}
            case "export":
                result = "".join(
                    f"{row['timestamp']}|{row['userId']}|{row['duration']}\n"
                    for row in store.sessions
                )
    except InputError as err:
        connection.send_error(msg["id"], str(err), str(err))
        return
    connection.send_result(msg["id"], result)
