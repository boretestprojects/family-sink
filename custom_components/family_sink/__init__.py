"""Family Sink integration lifecycle and sidebar registration."""

from dataclasses import dataclass
from pathlib import Path

from homeassistant.components import frontend, panel_custom, websocket_api
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv

from . import _version, api
from .const import ASSET_URL, DOMAIN, PANEL_PATH
from .recorder import SessionRecorder
from .storage import FamilyStore

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)


@dataclass
class Runtime:
    """Live integration data for one household."""

    hass: HomeAssistant
    store: FamilyStore
    recorder: SessionRecorder


async def async_setup(hass, _config):
    """Register stateless handlers and built assets once per HA process."""
    assets = Path(__file__).parent / "frontend"
    await hass.http.async_register_static_paths([
        StaticPathConfig(f"{ASSET_URL}/panel.js", str(assets / "panel.js"), False),
        StaticPathConfig(f"{ASSET_URL}/panel.css", str(assets / "panel.css"), False),
    ])
    for handler in (api.dashboard, api.admin, api.get_avatar):
        websocket_api.async_register_command(hass, handler)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Load local data, expose the panel and start recording."""
    store = FamilyStore(hass)
    await store.load()
    recorder = SessionRecorder(hass, store)
    runtime = Runtime(hass, store, recorder)
    try:
        recorder.start()
        await panel_custom.async_register_panel(
            hass, PANEL_PATH, "family-sink-panel",
            sidebar_title="Family Sink", sidebar_icon="mdi:tooth-outline",
            module_url=f"{ASSET_URL}/panel.js?v={_version.ASSET_VERSION}",
            require_admin=False,
        )
    except Exception:
        await recorder.stop()
        await store.close()
        raise
    hass.data[DOMAIN] = entry.runtime_data = runtime
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Hide the panel and cancel listeners without discarding local data."""
    runtime = entry.runtime_data
    hass.data.pop(DOMAIN, None)
    frontend.async_remove_panel(hass, PANEL_PATH)
    await runtime.recorder.stop()
    await runtime.store.close()
    return True
