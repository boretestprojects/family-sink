import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { champion, computeStats, gameCalendar, scoreBrush, sessionIndex, winnerOfDay } from "../frontend/game.js";

const defaults = JSON.parse(readFileSync(new URL("../examples/default-rules.json", import.meta.url), "utf8"));
const profiles = [{ id: "rowan", name: "Rowan", active: true }, { id: "avery", name: "Avery", active: true }];
const calendar = gameCalendar("Europe/Oslo", defaults.dayStart);
const record = (timestamp, duration, userId = "rowan") => ({ timestamp, duration, userId });

test("preserves all duration bands and exact thresholds", () => {
  const durations = [1, 14, 15, 29, 30, 49, 50, 69, 70, 89, 90, 119, 120, 179, 180, 300];
  assert.deepEqual(durations.map((duration) => scoreBrush(duration, defaults)),
    [0, 0, -3, -3, -2, -2, 0, 0, 3, 3, 5, 5, 7, 7, 10, 10]);
  assert.equal(scoreBrush(20, { ...defaults, points: [0, 99, 0, 0, 0, 0, 0, 0] }), 99);
});

test("uses the Home Assistant timezone and 03:00 boundary, including DST", () => {
  const boundaryCases = [
    ["2026-01-02T01:59:59Z", "2026-01-01"], ["2026-01-02T02:00:00Z", "2026-01-02"],
    ["2026-03-29T01:00:00Z", "2026-03-29"], ["2026-10-25T01:59:59Z", "2026-10-24"],
    ["2026-10-25T02:00:00Z", "2026-10-25"],
  ];
  for (const [timestamp, key] of boundaryCases) assert.equal(calendar.dayKey(timestamp), key);
  assert.equal(gameCalendar("Europe/Oslo", 240).dayKey("2026-01-02T02:30:00Z"), "2026-01-01");
});

test("applies slot and full-day penalties with the original 03:00–04:00 overlap", () => {
  const { people } = sessionIndex([
    record("2026-02-01T03:50:00+01:00", 120),
    record("2026-02-01T04:00:00+01:00", 20),
    record("2026-02-02T12:00:00+01:00", 120),
    record("2026-02-04T19:00:00+01:00", 120),
    record("2026-02-04T01:00:00+01:00", 20, "avery"),
  ], calendar);
  const stats = computeStats(profiles, people, "2026-02-04", defaults);
  assert.deepEqual(stats.rowan, {
    totalScore: -7, currentWeekScore: -11, lastWeekScore: 4, currentMonthScore: -7,
    lastMonthScore: 0, hasStartedGame: true, hasGoldenCardToday: false, streak: 1,
  });
  assert.equal(stats.avery.totalScore, -8);
  assert.equal(champion(profiles, stats, "lastWeekScore").id, "rowan");
});

test("preserves master bonus reset, Golden Card and streak rules", () => {
  const rows = [
    record("2026-02-01T08:00:00+01:00", 180), record("2026-02-01T19:00:00+01:00", 180),
    record("2026-02-02T08:00:00+01:00", 180), record("2026-02-02T19:00:00+01:00", 180),
    record("2026-02-03T08:00:00+01:00", 120), record("2026-02-04T08:00:00+01:00", 180),
    record("2026-02-04T20:00:00+01:00", 180),
  ];
  const { people, logs } = sessionIndex(rows, calendar);
  assert.equal(logs.length, 7);
  const stats = computeStats(profiles, people, "2026-02-04", defaults);
  assert.equal(stats.rowan.totalScore, 82);
  assert.equal(stats.rowan.hasGoldenCardToday, true);
  assert.equal(stats.rowan.streak, 4);
  assert.equal(stats.avery.hasStartedGame, false);
});

test("preserves month and week totals and individual game starts", () => {
  const { people } = sessionIndex([
    record("2026-01-31T09:00:00+01:00", 120), record("2026-01-31T19:00:00+01:00", 120),
    record("2026-02-01T17:00:00+01:00", 100), record("2026-02-02T08:00:00+01:00", 180),
  ], calendar);
  const stats = computeStats(profiles, people, "2026-02-02", defaults);
  assert.equal(stats.rowan.lastMonthScore, 14);
  assert.equal(stats.rowan.lastWeekScore, 9);
  assert.equal(stats.rowan.currentMonthScore, 5);
  assert.equal(stats.rowan.currentWeekScore, 10);
  const [rowan, avery] = profiles;
  const adjusted = computeStats([{ ...rowan, start: "2026-02-02" }, avery], people, "2026-02-02", defaults);
  assert.equal(adjusted.rowan.totalScore, 10);
  assert.equal(adjusted.rowan.lastMonthScore, 0);
  assert.equal(champion([{ ...rowan, active: false }, avery], stats, "lastMonthScore"), null);
});

test("daily winner has original duration tie-break and zero-point handling", () => {
  const rows = { rowan: [{ duration: 120 }], avery: [{ duration: 179 }] };
  assert.equal(winnerOfDay(profiles, rows, defaults).user.id, "avery");
  assert.equal(winnerOfDay(profiles, {}, defaults), null);
});
