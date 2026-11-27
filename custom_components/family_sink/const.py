"""Constants for Family Sink."""

DOMAIN = "family_sink"
PANEL_PATH = "family-sink"
ASSET_URL = "/family_sink_assets"
ORALB = "oralb"
PAUSE_SECONDS = 30
MIN_SESSION_SECONDS = 20
AVATARS = ("initial", "fox", "bear", "cat", "rabbit", "panda", "owl", "tooth")
DEFAULT_RULES = {
    "thresholds": [15, 30, 50, 70, 90, 120, 180],
    "points": [0, -3, -2, 0, 3, 5, 7, 10],
    "missingMorning": -5,
    "missingEvening": -5,
    "missedDay": -15,
    "masterDuration": 180,
    "masterCount": 3,
    "masterBonus": 20,
    "targetDuration": 120,
    "dayStart": 180,
    "morningStart": 240,
    "morningEnd": 720,
    "eveningStart": 1080,
    "eveningEnd": 240,
}
