"""Discover Oral-B brushes and map their sensor metadata."""

from dataclasses import dataclass

from homeassistant.helpers import device_registry as dr, entity_registry as er

from .const import ORALB
from .model import InputError, ROLES


@dataclass(frozen=True)
class Assignment:
    """Current entity IDs and ownership keys for a stored profile."""

    state: str | None
    duration: str | None
    battery: str | None
    device: str | None

    @property
    def claims(self):
        """Brush identity and sensors exclusive to one active profile."""
        return {key for key in (self.device, self.state, self.duration) if key}


class BrushRegistry:
    """A snapshot of Home Assistant's device and entity registries."""

    def __init__(self, hass):
        self.hass = hass
        device_registry = dr.async_get(hass)
        self.devices = {
            device.id: device
            for entry in hass.config_entries.async_entries(ORALB)
            for device in dr.async_entries_for_config_entry(device_registry, entry.entry_id)
        }
        self.sensors = {
            entry.id: entry for entry in er.async_get(hass).entities.values()
            if entry.domain == "sensor" and not entry.disabled_by
        }
        self.auto = {device_id: {role: [] for role in ROLES} for device_id in self.devices}
        for entry in self.sensors.values():
            if entry.platform != ORALB or entry.device_id not in self.auto:
                continue
            state = hass.states.get(entry.entity_id)
            attrs = state.attributes if state else {}
            device_class = entry.original_device_class or entry.device_class or attrs.get("device_class")
            role = None
            if entry.translation_key == "toothbrush_state":
                role = "state"
            elif device_class == "duration":
                role = "duration"
            elif device_class == "battery":
                role = "battery"
            if role:
                self.auto[entry.device_id][role].append(entry)

    def resolve(self, profile, *, strict=False):
        """Resolve stable registry IDs to current entity IDs."""
        device = profile["device"]
        selected = {}
        for role, entry_id in profile["manual"].items():
            entry = self.sensors.get(entry_id)
            if entry is None:
                if strict:
                    raise InputError("missing_entity")
                continue
            if entry.device_id and (entry.device_id in self.devices or device):
                if device and device != entry.device_id:
                    if strict:
                        raise InputError("invalid_assignment")
                    return Assignment(None, None, None, None)
                device = entry.device_id
            selected[role] = entry.entity_id
        for role, candidates in self.auto.get(device, {}).items():
            if role not in profile["manual"] and len(candidates) == 1:
                selected[role] = candidates[0].entity_id
        if len(set(selected.values())) != len(selected):
            if strict:
                raise InputError("invalid_assignment")
            return Assignment(None, None, None, device)
        return Assignment(*(selected.get(role) for role in ROLES), device)

    def describe_devices(self):
        """Show automatic mapping availability in the setup panel."""
        return [
            {
                "id": device.id,
                "name": device.name_by_user or device.name or ORALB,
                "mapping": {role: entries[0].entity_id if len(entries) == 1 else None
                            for role, entries in self.auto[device.id].items()},
            }
            for device in self.devices.values()
        ]

    def describe_sensors(self):
        """Return enabled sensors for administrator-only manual selection."""
        return [
            {"id": entry.id, "entity": entry.entity_id, "device": entry.device_id,
             "name": entry.name or entry.original_name or entry.entity_id}
            for entry in sorted(self.sensors.values(), key=lambda entry: entry.entity_id)
        ]
