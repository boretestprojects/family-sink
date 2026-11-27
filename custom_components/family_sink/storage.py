"""Private, versioned Home Assistant stores for profiles, history and avatars."""

from asyncio import Lock
from copy import deepcopy
from datetime import datetime
from uuid import uuid4

from homeassistant.helpers.storage import Store

from .const import DEFAULT_RULES, DOMAIN
from .model import InputError, make_session


def _identity(timestamp, person, duration):
    return datetime.fromisoformat(timestamp), person, duration


class FamilyStore:
    """Serialize mutations and expose snapshots through Home Assistant Store."""

    def __init__(self, hass):
        self.main_store = Store(
            hass, 1, DOMAIN, private=True, atomic_writes=True, serialize_in_event_loop=False,
        )
        self.avatar_store = Store(
            hass, 1, f"{DOMAIN}.avatars", private=True, atomic_writes=True,
            serialize_in_event_loop=False,
        )
        self.profiles = {}
        self.rules = deepcopy(DEFAULT_RULES)
        self.sessions = []
        self.avatars = {}
        self.history_revision = uuid4().hex
        self._identities = set()
        self.lock = Lock()
        self.closed = False

    async def load(self):
        """Restore durable data across reloads and restarts."""
        if data := await self.main_store.async_load():
            self.profiles = data["profiles"]
            self.rules = {**DEFAULT_RULES, **data["rules"]}
            self.sessions = data["sessions"]
            self._identities = {
                _identity(row["timestamp"], row["userId"], row["duration"]) for row in self.sessions
            }
        self.avatars = (await self.avatar_store.async_load()) or {}

    async def close(self):
        """Finish a write in progress before allowing a new runtime."""
        async with self.lock:
            self.closed = True

    def ensure_open(self):
        """Check lifecycle state while holding the write lock."""
        if self.closed:
            raise InputError("unavailable")

    async def save(self, *, profiles=None, rules=None, sessions=None):
        """Save a new snapshot with the caller holding the lock."""
        self.ensure_open()
        new_profiles = self.profiles if profiles is None else profiles
        new_rules = self.rules if rules is None else rules
        new_sessions = self.sessions if sessions is None else sessions
        await self.main_store.async_save({
            "profiles": new_profiles, "rules": new_rules, "sessions": new_sessions,
        })
        self.profiles = new_profiles
        self.rules = new_rules
        self.sessions = new_sessions
        if sessions is not None:
            self.history_revision = uuid4().hex

    async def append(self, timestamp, person, seconds):
        """Commit a completed session, suppressing duplicate records."""
        async with self.lock:
            identity = _identity(timestamp, person, seconds)
            if identity in self._identities:
                return
            await self.save(sessions=[*self.sessions, make_session(timestamp, person, seconds)])
            self._identities.add(identity)

    async def import_rows(self, rows, mapping):
        """Map legacy IDs, commit valid rows, and report repeat imports."""
        async with self.lock:
            self.ensure_open()
            if any(not isinstance(person, str) or person not in self.profiles
                   for person in mapping.values()):
                raise InputError("invalid_mapping")
            added = []
            duplicates = unmapped = 0
            new_identities = set()
            for timestamp, source, duration in rows:
                person = mapping.get(source)
                if person is None:
                    unmapped += 1
                    continue
                identity = _identity(timestamp, person, duration)
                if identity in self._identities or identity in new_identities:
                    duplicates += 1
                    continue
                new_identities.add(identity)
                added.append(make_session(timestamp, person, duration))
            if added:
                await self.save(sessions=[*self.sessions, *added])
                self._identities.update(new_identities)
            return {"added": len(added), "duplicates": duplicates, "unmapped": unmapped}

    async def set_avatar(self, person, image):
        """Replace or remove one private avatar."""
        async with self.lock:
            self.ensure_open()
            if person not in self.profiles:
                raise InputError("missing_profile")
            avatars = dict(self.avatars)
            if image is None:
                avatars.pop(person, None)
            else:
                avatars[person] = {"data": image, "revision": uuid4().hex}
            await self.avatar_store.async_save(avatars)
            self.avatars = avatars
