const DAY_MS = 86_400_000;

export function shiftDay(key, days) {
  const date = new Date(`${key}T00:00:00Z`);
  return new Date(date.getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

function weekday(key) {
  return new Date(`${key}T00:00:00Z`).getUTCDay();
}

export function gameCalendar(timeZone, dayStart) {
  const clock = new Intl.DateTimeFormat("en-GB", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  function local(timestamp) {
    const parts = Object.fromEntries(
      clock.formatToParts(new Date(timestamp)).map(({ type, value }) => [type, value]),
    );
    return {
      date: `${parts.year.padStart(4, "0")}-${parts.month}-${parts.day}`,
      minute: Number(parts.hour) * 60 + Number(parts.minute),
    };
  }
  function dayFor({ date, minute }) {
    return minute < dayStart ? shiftDay(date, -1) : date;
  }
  return { local, dayFor, dayKey: (timestamp) => dayFor(local(timestamp)) };
}

const dayNames = {
  bg: ["НЕД", "ПОН", "ВТО", "СРЯ", "ЧЕТ", "ПЕТ", "СЪБ"],
  en: ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"],
  lt: ["SEK", "PRM", "ANT", "TRE", "KET", "PEN", "ŠEŠ"],
};
const relativeNames = {
  bg: ["ДНЕС", "ВЧЕРА"], en: ["TODAY", "YESTERDAY"], lt: ["ŠIANDIEN", "VAKAR"],
};

export function dayLabel(today, offset, language) {
  const fullDate = shiftDay(today, -offset);
  const date = new Intl.DateTimeFormat(language, {
    timeZone: "UTC", day: "numeric", month: "numeric",
  }).format(new Date(`${fullDate}T00:00:00Z`));
  return { label: relativeNames[language][offset] ?? dayNames[language][weekday(fullDate)], date, fullDate };
}

export function scoreBrush(duration, rules) {
  const band = rules.thresholds.findIndex((threshold) => duration < threshold);
  return band < 0 ? rules.points.at(-1) : rules.points[band];
}

export function inWindow(minute, start, end) {
  return start < end ? minute >= start && minute < end : minute >= start || minute < end;
}

export function sessionIndex(sessions, calendar) {
  const people = new Map();
  const logs = sessions.map((row) => {
    const local = calendar.local(row.timestamp);
    return { ...row, debugDateKey: calendar.dayFor(local), minute: local.minute };
  }).sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp));
  for (const log of logs) {
    if (!people.has(log.userId)) people.set(log.userId, new Map());
    const days = people.get(log.userId);
    if (!days.has(log.debugDateKey)) days.set(log.debugDateKey, []);
    days.get(log.debugDateKey).push(log);
  }
  for (const days of people.values()) {
    for (const brushes of days.values()) brushes.reverse();
  }
  return { people, logs };
}

export function computeStats(profiles, people, today, rules) {
  const monday = shiftDay(today, 1 - (weekday(today) || 7));
  const lastMonday = shiftDay(monday, -7);
  const month = today.slice(0, 7);
  const lastMonth = shiftDay(`${month}-01`, -1).slice(0, 7);
  const stats = {};

  for (const user of profiles) {
    const days = people.get(user.id) ?? new Map();
    const start = user.start ?? [...days.keys()].sort()[0];
    const record = stats[user.id] = {
      totalScore: 0, currentWeekScore: 0, lastWeekScore: 0, currentMonthScore: 0,
      lastMonthScore: 0, hasStartedGame: Boolean(start && start <= today),
      hasGoldenCardToday: false, streak: 0,
    };
    if (!record.hasStartedGame) continue;

    for (let offset = 0; offset < 14; offset++) {
      const key = shiftDay(today, -offset);
      if (key < start || !days.get(key)?.some((brush) => brush.duration >= rules.targetDuration)) break;
      record.streak++;
    }

    let masterStreak = 0;
    for (let day = start; day <= today; day = shiftDay(day, 1)) {
      const brushes = days.get(day) ?? [];
      let score = brushes.reduce((sum, brush) => sum + scoreBrush(brush.duration, rules), 0);
      const masters = brushes.filter((brush) => brush.duration >= rules.masterDuration).length;
      if (masters) {
        masterStreak += masters;
        if (masterStreak >= rules.masterCount) {
          score += rules.masterBonus;
          masterStreak = 0;
        }
      } else if (day !== today) {
        masterStreak = 0;
      }

      if (day === today) {
        record.hasGoldenCardToday = masters > 0;
      } else if (!brushes.length) {
        score += rules.missedDay;
      } else {
        if (!brushes.some(({ minute }) => inWindow(minute, rules.morningStart, rules.morningEnd))) {
          score += rules.missingMorning;
        }
        if (!brushes.some(({ minute }) => inWindow(minute, rules.eveningStart, rules.eveningEnd))) {
          score += rules.missingEvening;
        }
      }

      record.totalScore += score;
      if (day >= monday) record.currentWeekScore += score;
      else if (day >= lastMonday) record.lastWeekScore += score;
      if (day.startsWith(month)) record.currentMonthScore += score;
      else if (day.startsWith(lastMonth)) record.lastMonthScore += score;
    }
  }
  return stats;
}

export function champion(profiles, stats, field) {
  let winner = null;
  for (const user of profiles) {
    if (!user.active || !stats[user.id]?.hasStartedGame) continue;
    const score = stats[user.id][field];
    if (score > (winner?.score ?? 0)) winner = { name: user.name, score, id: user.id };
  }
  return winner;
}

export function winnerOfDay(profiles, usersData, rules) {
  const leaders = profiles.filter((user) => user.active).map((user) => {
    const brushes = usersData[user.id] ?? [];
    return {
      user, score: brushes.reduce((sum, brush) => sum + scoreBrush(brush.duration, rules), 0),
      duration: brushes.reduce((sum, brush) => sum + brush.duration, 0),
    };
  }).sort((left, right) => right.score - left.score || right.duration - left.duration);
  return leaders[0]?.score ? leaders[0] : null;
}
