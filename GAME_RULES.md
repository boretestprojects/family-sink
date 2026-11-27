# Game rules

**Every brush counts.** This guide describes the defaults used by Family Sink. The dashboard shows the points for the displayed brushes on each card and the full competition totals in the status strip.

## Recording and the game day

The recorder snapshots the current duration and timestamp when a configured toothbrush leaves `running`. It waits 30 seconds. A return to `running` cancels that pending entry. After a full pause, a snapshot of at least 20 seconds is stored. The snapshot rounds to a whole second. Each toothbrush runs its timer independently.

The default game day begins at 03:00 in Home Assistant's configured time zone. A session at 02:59 counts toward the previous day. A session at 03:00 counts toward the new day. A player's first recorded game day starts their totals by default. Administrators can specify a different start date. Earlier sessions remain visible in history.

## Points for each brush

Every recorded brush, including any intermediate brushes, earns the points for its duration.

| Duration in seconds | Points |
| --- | ---: |
| Below 15 | 0 |
| 15–29 | −3 |
| 30–49 | −2 |
| 50–69 | 0 |
| 70–89 | +3 |
| 90–119 | +5 |
| 120–179 | +7 |
| 180 or more | +10 |

Live recording starts at 20 seconds. Imported positive durations may fall into earlier bands. The score on each day's profile card sums the displayed brushes. The scoreboard includes penalties and Master Brush bonuses.

## Penalties

- An ended game day with no brushes costs 15 points.
- On an ended day with at least one brush, missing the morning window costs 5 points. The default window is 04:00 inclusive to 12:00 exclusive.
- On an ended day with at least one brush, missing the evening window costs 5 points. The default window is 18:00 inclusive to 04:00 exclusive, across midnight.
- Any session in the window satisfies it. The 03:00–04:00 part of the evening window belongs to the new game day.
- Penalties start on the participant's game start date and apply once a day has ended. An inactive participant keeps their history and is left out of the leaderboard. On reactivation, the score covers the full span since their game start, including days they were inactive.

## Master Brush, Golden Card and streak

A brush of at least 180 seconds counts as a Master Brush. The engine adds the number of Master Brushes on a game day to a running count. Reaching three or more awards 20 bonus points once for that day and resets the count to zero. Extra Master Brushes on the same day are consumed by that reset. A completed day without a Master Brush also resets the count.

A participant receives the Golden Card glow for the current game day after at least one Master Brush. A strong brush for missions, Sink Mood and the streak is at least 120 seconds. The streak counts consecutive days with a strong brush, beginning with today and looking back at most 14 days.

## Leaderboards, timeline and Sink Mood

The current week begins on Monday. Weekly and monthly champions come from the previous completed week and calendar month. The highest positive total wins. Equal totals retain profile order. The Wall of Fame displays these champions. The daily winner uses the sum of the duration points for the selected day and breaks ties by total brushing time. A highest score of zero leaves the day without a winner.

The timeline shows the first session at the sun marker, the last session at the moon marker if there is a second session, and every session between them in order. Select an intermediate marker to reveal its length.

Sink Mood is **Clean House** when every active participant has a strong brush for the selected day, **Chaos Mode** when nobody has one, and **Someone Is Slacking** in between. Teams are profile labels.

Administrators can adjust scoring brackets, points, penalties, Master Brush and mission thresholds, and time windows. Changing these settings recalculates all history. The 30-second recording pause and 20-second minimum are fixed.
