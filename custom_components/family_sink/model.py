"""Validate shared game settings and parse original log files."""

from datetime import date, datetime
from io import BytesIO
import base64
import binascii
import re
from uuid import uuid4
from zoneinfo import ZoneInfo

from PIL import Image, ImageOps, UnidentifiedImageError

from .const import AVATARS, DEFAULT_RULES

MAX_IMAGE_BYTES = 2 * 1024 * 1024
MAX_IMPORT_CHARS = 1024 * 1024
ROLES = ("state", "duration", "battery")


class InputError(ValueError):
    """An invalid Family Sink input, identified by a translation key."""


def clean_profile(data, profile_id):
    """Normalize a profile submitted by an administrator."""
    name = data.get("name")
    team = data.get("team", "")
    color = data.get("color", "#2563eb")
    avatar = data.get("avatar", "initial")
    active = data.get("active", True)
    start = data.get("start")
    device = data.get("device")
    manual = data.get("manual", {})
    if not isinstance(name, str) or not 0 < len(name.strip()) <= 80:
        raise InputError("invalid_name")
    if not isinstance(team, str) or len(team.strip()) > 60:
        raise InputError("invalid_team")
    if (not isinstance(color, str) or not re.fullmatch(r"#[0-9a-fA-F]{6}", color)
            or avatar not in AVATARS or type(active) is not bool):
        raise InputError("invalid_profile")
    if device is not None and not isinstance(device, str):
        raise InputError("invalid_assignment")
    if not isinstance(manual, dict) or any(
        role not in ROLES or not isinstance(identifier, str) or not identifier
        for role, identifier in manual.items()
    ) or len(set(manual.values())) != len(manual):
        raise InputError("invalid_assignment")
    if start is not None and start != "":
        try:
            if date.fromisoformat(start).isoformat() != start:
                raise ValueError
        except (TypeError, ValueError) as exc:
            raise InputError("invalid_date") from exc
    return {
        "id": profile_id, "name": name.strip(), "team": team.strip(),
        "color": color, "avatar": avatar, "active": active, "start": start or None,
        "device": device or None, "manual": manual,
    }


def clean_rules(data):
    """Validate a complete settings update, with fixed scoring band count."""
    if data.keys() != DEFAULT_RULES.keys():
        raise InputError("invalid_rules")
    for key, value in data.items():
        if key in ("thresholds", "points"):
            if not isinstance(value, list) or len(value) != len(DEFAULT_RULES[key]):
                raise InputError("invalid_rules")
            minimum = 1 if key == "thresholds" else -1000
            maximum = 3600 if key == "thresholds" else 1000
            if any(type(item) is not int or not minimum <= item <= maximum for item in value):
                raise InputError("invalid_rules")
        else:
            if key.endswith(("Start", "End")):
                minimum, maximum = 0, 1439
            elif key in ("masterDuration", "targetDuration", "masterCount"):
                minimum, maximum = 1, 3600
            else:
                minimum, maximum = -1000, 1000
            if type(value) is not int or not minimum <= value <= maximum:
                raise InputError("invalid_rules")
    if sorted(set(data["thresholds"])) != data["thresholds"]:
        raise InputError("invalid_rules")
    if any(data[f"{window}Start"] == data[f"{window}End"] for window in ("morning", "evening")):
        raise InputError("invalid_rules")
    return data


def parse_history(text, zone: ZoneInfo):
    """Return valid legacy rows and the number of malformed nonempty lines."""
    if len(text) > MAX_IMPORT_CHARS:
        raise InputError("import_too_large")
    rows = []
    invalid = 0
    for line in text.splitlines():
        if not line.strip():
            continue
        try:
            stamp, source, seconds = (field.strip() for field in line.split("|"))
            if not source or "T" not in stamp or not re.fullmatch(r"[0-9]{1,9}", seconds):
                raise ValueError
            value = datetime.fromisoformat(stamp)
            duration = int(seconds)
            if duration <= 0:
                raise ValueError
            if value.tzinfo is None:
                value = value.replace(tzinfo=zone)
            rows.append((value.astimezone(zone).isoformat(timespec="seconds"), source, duration))
        except (ValueError, OverflowError):
            invalid += 1
    return rows, invalid


def make_session(timestamp, user_id, duration):
    """Build a session with a stable ID."""
    return {"id": uuid4().hex, "timestamp": timestamp, "userId": user_id, "duration": duration}


def normalize_avatar(payload):
    """Decode a static raster image and strip metadata before storage."""
    if len(payload) > 4 * ((MAX_IMAGE_BYTES + 2) // 3):
        raise InputError("image_too_large")
    try:
        raw = base64.b64decode(payload, validate=True)
        if len(raw) > MAX_IMAGE_BYTES:
            raise InputError("image_too_large")
        with Image.open(BytesIO(raw), formats=["JPEG", "PNG", "WEBP"]) as source:
            if source.width * source.height > 16_000_000:
                raise InputError("image_too_large")
            image = ImageOps.exif_transpose(source)
            image.thumbnail((256, 256))
            image = image.convert("RGBA")
            pixels = Image.new("RGBA", image.size)
            pixels.paste(image)
            output = BytesIO()
            pixels.save(output, "PNG", optimize=True)
    except InputError:
        raise
    except (UnidentifiedImageError, Image.DecompressionBombError, binascii.Error, OSError, ValueError) as exc:
        raise InputError("invalid_image") from exc
    return base64.b64encode(output.getvalue()).decode("ascii")
