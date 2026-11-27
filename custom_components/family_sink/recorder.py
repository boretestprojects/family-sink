"""Record each brush independently using the legacy pause/resume behavior."""

import asyncio
import logging
from zoneinfo import ZoneInfo

from homeassistant.core import callback
from homeassistant.helpers import device_registry as dr, entity_registry as er
from homeassistant.helpers.event import async_call_later, async_track_state_change_event

from .const import MIN_SESSION_SECONDS, PAUSE_SECONDS
from .discovery import BrushRegistry

_LOGGER = logging.getLogger(__name__)
SECONDS_PER_UNIT = {"ms": 0.001, "µs": 0.000001, "min": 60, "h": 3600, "d": 86400}


def snapshot_seconds(state):
    """Capture and round the current duration as the original automation did."""
    if state is None:
        return 0
    try:
        return round(float(state.state) * SECONDS_PER_UNIT.get(
            state.attributes.get("unit_of_measurement"), 1,
        ))
    except (ValueError, TypeError, OverflowError):
        return 0


class SessionRecorder:
    """Manage one state listener and one pending timer per assigned brush."""

    def __init__(self, hass, store):
        self.hass = hass
        self.store = store
        self.assignments = {}
        self.conflicts = set()
        self.pending = {}
        self._listeners = {}
        self._registry_listeners = []
        self._refresh = None
        self._writes = set()

    @callback
    def start(self):
        """Track registry changes including device discovery and entity renames."""
        for event in (er.EVENT_ENTITY_REGISTRY_UPDATED, dr.EVENT_DEVICE_REGISTRY_UPDATED):
            self._registry_listeners.append(self.hass.bus.async_listen(event, self._schedule_rebuild))
        self.rebuild()

    @callback
    def _schedule_rebuild(self, _event):
        if self._refresh is None:
            self._refresh = self.hass.loop.call_soon(self.rebuild)

    @callback
    def rebuild(self):
        """Rebind only changed assignments, leaving other brushes uninterrupted."""
        if self._refresh is not None:
            self._refresh.cancel()
            self._refresh = None
        registry = BrushRegistry(self.hass)
        assignments = {
            person: registry.resolve(profile)
            for person, profile in self.store.profiles.items() if profile["active"]
        }
        claims = {}
        for person, assignment in assignments.items():
            for key in assignment.claims:
                claims.setdefault(key, []).append(person)
        self.conflicts = {person for owners in claims.values() if len(owners) > 1 for person in owners}
        tracked = {
            person: (assignment.state, assignment.duration)
            for person, assignment in assignments.items()
            if assignment.state and assignment.duration and person not in self.conflicts
        }
        for person, (mapping, unsubscribe) in list(self._listeners.items()):
            if tracked.get(person) != mapping:
                unsubscribe()
                self._listeners.pop(person)
                self._cancel(person)
        for person, mapping in tracked.items():
            if person not in self._listeners:
                self._listen(person, mapping)
        self.assignments = assignments

    @callback
    def _listen(self, person, mapping):
        state_id, duration_id = mapping

        @callback
        def state_changed(event):
            old, new = event.data["old_state"], event.data["new_state"]
            if new is not None and new.state == "running":
                self._cancel(person)
                return
            if old is None or old.state != "running":
                return
            self._cancel(person)
            duration = snapshot_seconds(self.hass.states.get(duration_id))
            # Snapshot both inputs before the pause, even if the sensor resets to zero.
            zone = ZoneInfo(self.hass.config.time_zone)
            timestamp = event.time_fired.astimezone(zone).isoformat(timespec="seconds")

            @callback
            def finish(_now):
                self.pending.pop(person, None)
                if duration >= MIN_SESSION_SECONDS:
                    task = self.hass.async_create_task(
                        self._record(timestamp, person, duration), "Family Sink save brushing session",
                    )
                    self._writes.add(task)
                    task.add_done_callback(self._writes.discard)

            self.pending[person] = async_call_later(self.hass, PAUSE_SECONDS, finish)

        unsubscribe = async_track_state_change_event(self.hass, [state_id], state_changed)
        self._listeners[person] = (mapping, unsubscribe)

    @callback
    def _cancel(self, person):
        if cancel := self.pending.pop(person, None):
            cancel()

    async def _record(self, timestamp, person, duration):
        try:
            await self.store.append(timestamp, person, duration)
        except Exception:
            _LOGGER.exception("Could not save a completed Family Sink session")

    async def stop(self):
        """Remove listeners and timers and finish recordings already being saved."""
        for unsubscribe in self._registry_listeners:
            unsubscribe()
        self._registry_listeners.clear()
        if self._refresh is not None:
            self._refresh.cancel()
            self._refresh = None
        for _, unsubscribe in self._listeners.values():
            unsubscribe()
        self._listeners.clear()
        for person in list(self.pending):
            self._cancel(person)
        if self._writes:
            await asyncio.gather(*self._writes)
