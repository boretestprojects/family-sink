import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BigCircle, GhostCircle, IconActivity, IconBattery, IconMoon, IconRefresh, IconSun,
  IconTrophy, ProgressRing, SafeAvatar, SmallCircle, secondsToMissionText,
} from "./BrushVisuals.jsx";
import { champion, computeStats, dayLabel, gameCalendar, scoreBrush, sessionIndex, winnerOfDay } from "./game.js";
import { languages, preference, translate } from "./i18n.js";
import { Settings } from "./Settings.jsx";

const FULL_REFRESH_MS = 30_000;
const unitScale = { ms: 0.001, "µs": 0.000001, min: 60, h: 3600, d: 86400 };

function numeric(state) {
  if (state?.state && Number.isFinite(Number(state.state))) return Number(state.state);
  return null;
}

function useAvatar(call, person, revision, cache) {
  const [photo, setPhoto] = useState(null);
  useEffect(() => {
    if (!revision) {
      cache.delete(person);
      return;
    }
    let cancelled = false;
    let record = cache.get(person);
    if (record?.revision !== revision) {
      const promise = call({ type: "family_sink/avatar", person }).catch(() => {
        if (cache.get(person)?.revision === revision) cache.delete(person);
        return null;
      });
      record = { revision, promise };
      cache.set(person, record);
    }
    record.promise.then((data) => {
      if (!cancelled && data) setPhoto({ revision, source: `data:image/png;base64,${data}` });
    });
    return () => { cancelled = true; };
  }, [call, person, revision, cache]);
  return photo && photo.revision === revision ? photo.source : null;
}

function Portrait({ user, call, cache }) {
  const image = useAvatar(call, user.id, user.avatarRevision, cache);
  return <SafeAvatar key={user.avatarRevision} user={user} image={image} />;
}

const moods = {
  full: {
    text: "😎 CLEAN HOUSE", tone: "bg-emerald-100 text-emerald-700",
    sub: { bg: "Всички са в норма", en: "Everyone is on target", lt: "Visi pasiekė normą" },
  },
  none: {
    text: "💀 CHAOS MODE", tone: "bg-rose-100 text-rose-700",
    sub: { bg: "Никой още не е направил силно миене", en: "No one has done a strong brush yet", lt: "Dar niekas neatliko stipraus valymo" },
  },
  some: {
    text: "😬 SOMEONE IS SLACKING", tone: "bg-amber-100 text-amber-700",
    sub: { bg: "са отметнали мисията", en: "have completed the mission", lt: "įvykdė misiją" },
  },
};

function ScoreSummary({ active, stats, weekly, monthly, mood, winner, t }) {
  return (
    <div className="summary-grid px-4 pt-2 grid gap-2">
      <div className="space-y-2">
        {mood && <div className={`summary-box rounded-2xl px-4 py-2.5 ${mood.tone}`}>
          <div className="text-sm font-black text-balance">{mood.text}</div>
          <div className="text-xs opacity-80 mt-0.5">{mood.description}</div>
        </div>}
        <div className="summary-box rounded-2xl px-4 py-2.5 text-yellow-800">
          <div className="flex items-center gap-2 font-black text-sm mb-1.5 border-b border-yellow-200/50 pb-1">
            <IconTrophy size={14} /><span className="uppercase tracking-tight">{t("wall")}</span>
          </div>
          {[
            [t("lastWeek"), weekly], [t("lastMonth"), monthly],
            [t("winnerOfDay"), winner && { name: winner.user.name, score: winner.score }],
          ].map(([label, person]) => (
            <div key={label} className="flex justify-between items-center gap-2 text-xs mt-1">
              <span className="font-bold opacity-80">{label}</span>
              <span className="font-black text-yellow-700">{person ? `${person.name} (${person.score})` : t("none")}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="summary-box rounded-2xl px-4 py-2.5 text-blue-800 overflow-auto">
        <table className="score-table w-full text-xs">
          <thead><tr className="border-b border-blue-200/50">
            <th scope="col">{t("profiles")}</th>
            <th scope="col">{t("currentWeek")}</th>
            <th scope="col">{t("currentMonth")}</th>
            <th scope="col">{t("lifetime")}</th>
          </tr></thead>
          <tbody>
            {[...active].sort((a, b) => stats[b.id].currentWeekScore - stats[a.id].currentWeekScore).map((user, index) => {
              const score = stats[user.id];
              return <tr key={user.id}>
                <th scope="row"><span className="text-slate-400 mr-1">{index + 1}.</span>{user.name}</th>
                <td className={score.currentWeekScore < 0 ? "text-red-600" : "text-green-700"}>{score.hasStartedGame ? score.currentWeekScore : "–"}</td>
                <td>{score.currentMonthScore}</td>
                <td>{score.totalScore}</td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProfileCard({ user, brushes, stats, states, rules, timeZone, language, t, call, cache, isToday }) {
  const state = states[user.entities.state]?.state;
  const timer = states[user.entities.duration];
  const seconds = Math.max(0, Math.round((numeric(timer) ?? 0) * (unitScale[timer?.attributes.unit_of_measurement] ?? 1)));
  const battery = numeric(states[user.entities.battery]);
  const progress = Math.min(100, seconds / rules.targetDuration * 100);
  const brushPoints = brushes.reduce((sum, brush) => sum + scoreBrush(brush.duration, rules), 0);
  const first = brushes[0];
  const last = brushes.length > 1 ? brushes.at(-1) : null;
  const middle = brushes.slice(1, -1);
  const avatar = (
    <div className={`avatar-shell profile-avatar rounded-full border border-white overflow-hidden bg-white z-10 ${stats.hasGoldenCardToday ? "golden-glow" : ""}`}>
      <Portrait {...{ user, call, cache }} />
    </div>
  );
  return (
    <article className={`premium-card profile-card relative rounded-[28px] p-5 flex flex-col justify-between ${state === "running" ? "is-brushing" : ""} ${user.active ? "" : "opacity-75"}`}
      style={{ "--profile-color": user.color }}>
      {state === "running" && <div className="brushing-pill absolute bg-green-500/95 text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-1.5 shadow-lg border border-white/20 z-10 whitespace-nowrap">
        <IconActivity size={20} className="fs-activity-spin" />
        <span>{t("brushing")} <span className="brushing-seconds">{seconds}</span> {t("seconds")}</span>
      </div>}
      <div className="profile-row flex items-center gap-4 mb-5">
        <div className="relative flex items-center justify-center w-24 h-24 flex-shrink-0">
          {user.active ? <ProgressRing progress={progress} size={98}>{avatar}</ProgressRing> : avatar}
        </div>
        <div className="profile-details flex flex-col flex-1 min-w-0">
          <div className="profile-heading flex justify-between items-start gap-2">
            <h2 className="profile-name font-black leading-none tracking-tight truncate" title={user.name}>{user.name}</h2>
            {user.active && <IconBattery size={24} level={battery} charging={state === "charging"} chargingLabel={t("charging")} className="ml-auto shrink-0" />}
          </div>
          {user.team && <span className="text-xs font-bold text-slate-500 uppercase tracking-[0.12em] opacity-60 mt-1 break-words">
            {user.team === "leader" ? t("teamLeaders") : user.team === "kids" ? t("teamKids") : user.team}
          </span>}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <div className="stats-chip flex items-center gap-1 px-2.5 py-1 rounded-full">
              <IconTrophy size={14} className={stats.currentWeekScore > 20 ? "text-yellow-600" : "text-slate-300"} />
              <span className="text-sm font-bold text-slate-700">
                {stats.hasStartedGame ? `${stats.currentWeekScore} ${t("points")}` : t("awaiting")}
              </span>
            </div>
            {user.active && <div className="stats-chip text-[11px] font-bold px-2.5 py-1 rounded-full text-slate-700">
              🔥 {stats.streak} {t("dayStreak")}
            </div>}
          </div>
          <div className="mt-3 text-sm font-semibold text-slate-600">
            {state === "running" && isToday
              ? `${secondsToMissionText(seconds, rules.targetDuration, language)} • ${seconds} / ${rules.targetDuration} ${t("seconds")}`
              : `${t(isToday ? "todayScore" : "dayScore")} • ${brushPoints} ${t("points")}`}
          </div>
        </div>
      </div>
      <div className="soft-panel rounded-[24px] timeline-panel p-4">
        <div className="flex items-center justify-between relative px-1">
          <div className="flex-shrink-0">
            {first ? <BigCircle brush={first} title={t("start")} iconType="sun" {...{ language, timeZone }} />
              : <GhostCircle title={t("start")} icon={IconSun} />}
          </div>
          <div className="flex-1 min-w-0 timeline-track mx-3 relative rounded-full flex items-center">
            <div className="flex -space-x-1 z-10 overflow-x-auto w-full px-2 py-1 timeline-sessions">
              {middle.map((brush) => <SmallCircle key={brush.id} {...{ brush, language }} target={rules.targetDuration} secondsLabel={t("seconds")} />)}
            </div>
          </div>
          <div className="flex-shrink-0">
            {last ? <BigCircle brush={last} title={t("finish")} iconType="moon" {...{ language, timeZone }} />
              : <GhostCircle title={t("finish")} icon={IconMoon} />}
          </div>
        </div>
      </div>
    </article>
  );
}

export function Dashboard({ hass, call, narrow, onMenu }) {
  const [language, setLanguage] = useState(() => {
    const preferred = preference("language") || hass.language?.slice(0, 2);
    return languages.some(([code]) => code === preferred) ? preferred : "bg";
  });
  const [model, setModel] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now);
  const [offset, setOffset] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [summarySeen, setSummarySeen] = useState(() => preference("summary_seen"));
  const [settings, setSettings] = useState(false);
  const sequence = useRef(0);
  const historyRevision = useRef(null);
  const cache = useRef(new Map()).current;
  const t = (key) => translate(language, key);

  const load = useCallback(async () => {
    const request = ++sequence.current;
    setLoading(true);
    try {
      const result = await call({
        type: "family_sink/dashboard",
        ...(historyRevision.current && { history_revision: historyRevision.current }),
      });
      if (request !== sequence.current) return;
      if (result.sessions) {
        setSessions(result.sessions);
        historyRevision.current = result.historyRevision;
      }
      setModel(result);
      setError("");
      setNow(Date.now());
    } catch (failure) {
      if (request === sequence.current) setError(failure.code ?? "unavailable");
    } finally {
      if (request === sequence.current) setLoading(false);
    }
  }, [call]);

  useEffect(() => {
    if (hass.connected === false) return;
    load();
    const refresh = setInterval(load, FULL_REFRESH_MS);
    return () => {
      ++sequence.current;
      clearInterval(refresh);
    };
  }, [load, hass.connected]);

  const calendar = useMemo(() => model && gameCalendar(model.timeZone, model.rules.dayStart),
    [model?.timeZone, model?.rules.dayStart]);
  const index = useMemo(() => calendar && sessionIndex(sessions, calendar), [sessions, calendar]);
  const today = calendar?.dayKey(now);
  const stats = useMemo(() => calendar && computeStats(model.profiles, index.people, today, model.rules),
    [calendar, model, index, today]);

  if (settings && hass.user?.is_admin) {
    return <Settings call={call} t={t} onClose={() => setSettings(false)} onChanged={load} />;
  }

  const page = Math.floor(offset / 7) * 7;
  const dates = today ? Array.from({ length: 7 }, (_, i) => dayLabel(today, page + i, language)) : [];
  const selected = dates[offset % 7]?.fullDate;
  const active = model?.profiles.filter((user) => user.active) ?? [];
  const usersData = Object.fromEntries((model?.profiles ?? []).map(({ id }) => [
    id, index.people.get(id)?.get(selected) ?? [],
  ]));
  const visibleProfiles = model?.profiles.filter((user) => user.active || (offset > 0 && usersData[user.id].length)) ?? [];
  const weekly = stats && champion(active, stats, "lastWeekScore");
  const monthly = stats && champion(active, stats, "lastMonthScore");
  const completed = active.filter(({ id }) => usersData[id].some(({ duration }) => duration >= model.rules.targetDuration)).length;
  const moodKey = completed === active.length ? "full" : completed === 0 ? "none" : "some";
  const mood = active.length ? {
    ...moods[moodKey], description: `${moodKey === "some" ? `${completed}/${active.length} ` : ""}${moods[moodKey].sub[language]}`,
  } : null;
  const signature = active.length ? JSON.stringify([moodKey, weekly?.id, monthly?.id]) : "";
  const alert = Boolean(signature && signature !== summarySeen);
  const canGoEarlier = Boolean(index?.logs.at(-1) && index.logs.at(-1).debugDateKey < dates.at(-1)?.fullDate);
  const names = Object.fromEntries((model?.profiles ?? []).map(({ id, name }) => [id, name]));

  return (
    <div className="dashboard flex flex-col min-h-full text-slate-800 relative" lang={language}>
      <div className="modern-top-glow" />
      <header className="dashboard-header bg-white/70 glass border-b border-white/70 px-4 py-4 flex justify-between items-center shadow-sm z-30">
        <div className="flex items-center gap-2 min-w-0">
          {narrow && <button type="button" className="header-button" aria-label={t("menu")} onClick={onMenu}>☰</button>}
          <div className="brand-mark w-11 h-11 shrink-0 rounded-2xl bg-gradient-to-br from-blue-100 to-white shadow-sm border border-white flex items-center justify-center text-xl">🦷</div>
          <div className="flex flex-col min-w-0">
            <h1 className="text-xl font-black leading-none tracking-tight text-slate-900 truncate">{t("dashboardTitle")}</h1>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-[0.18em]">Family Sink</span>
          </div>
        </div>
        <div className="header-actions flex flex-wrap items-center justify-end gap-2">
          <div className="header-avatars gap-2">
            {active.map((user) => <div key={user.id} className="relative" title={user.name}>
              <div className={`header-avatar w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-sm ${stats[user.id].hasGoldenCardToday ? "golden-glow" : ""}`}>
                <Portrait {...{ user, call, cache }} />
              </div>
              <div className={`absolute -bottom-1 -right-1 bg-white rounded-full px-1.5 border border-slate-200 text-[8px] font-bold shadow-sm ${!stats[user.id].hasStartedGame ? "text-slate-300" : stats[user.id].currentWeekScore < 0 ? "text-red-600" : "text-slate-600"}`}>
                {stats[user.id].hasStartedGame ? stats[user.id].currentWeekScore : "–"}
              </div>
            </div>)}
          </div>
          <div className="flex items-center gap-1 p-1 rounded-full bg-white/70 border border-white shadow-sm">
            {languages.map(([code, label]) => (
              <button key={code} type="button" onClick={() => { setLanguage(code); preference("language", code); }}
                aria-pressed={language === code}
                className={`px-2 py-1 text-[11px] font-bold rounded-full transition ${language === code ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-white"}`}>{label}</button>
            ))}
          </div>
          <button type="button" onClick={load} className="header-button" title={t("refreshNow")} aria-label={t("refreshNow")}>
            <IconRefresh size={20} className={loading ? "spin-slow" : ""} />
          </button>
          {hass.user?.is_admin && <button type="button" onClick={() => setSettings(true)} className="header-button"
            aria-label={t("settings")} title={t("settings")}>⚙</button>}
        </div>
      </header>
      {error && <p role="alert" className="mx-4 mt-3 text-sm font-semibold text-red-700">{t(error)}</p>}
      {!model && !error && <p role="status" className="m-4">{t("loading")}</p>}
      {model && <>
        {active.length > 0 && <div className="px-4 pt-2">
          <button type="button" aria-expanded={showSummary} onClick={() => {
            if (!showSummary) {
              preference("summary_seen", signature);
              setSummarySeen(signature);
            }
            setShowSummary(!showSummary);
          }} className="relative w-full h-7 flex items-center justify-center">
            <span className={`absolute inset-x-0 h-[2px] rounded-full transition-all duration-300 ${alert ? "bg-slate-500/40 shadow-[0_0_18px_rgba(15,23,42,0.18)]" : "bg-slate-300/70"}`} />
            <span className={`relative px-4 py-1 rounded-full text-xs font-bold border ${alert ? "bg-amber-50 text-amber-700 border-amber-200 pulse-soft" : "bg-white/80 text-slate-600 border-white"}`}>
              <span className={`inline-block mr-2 transition-transform ${showSummary ? "rotate-180" : ""}`}>▾</span>
              {t(alert ? "alertLabel" : showSummary ? "hideStatus" : "showStatus")}
            </span>
          </button>
        </div>}
        {showSummary && active.length > 0 && <ScoreSummary {...{ active, stats, weekly, monthly, mood, t }}
          winner={winnerOfDay(active, usersData, model.rules)} />}
        {model.profiles.length > 0 && <nav className="date-navigation px-4 pt-4 flex items-center gap-2">
          {canGoEarlier && <button type="button" className="header-button" aria-label={t("previous")} onClick={() => setOffset(page + 7)}>‹</button>}
          <div className="date-tabs flex gap-2 flex-1 min-w-0 pb-2">
            {dates.map((day, i) => (
              <button key={day.fullDate} type="button" onClick={(event) => {
                setOffset(page + i);
                event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" });
              }} aria-pressed={page + i === offset}
                className={`tab-polish flex-1 min-w-[70px] flex flex-col items-center py-3 px-1.5 rounded-2xl border ${page + i === offset ? "bg-blue-600 border-blue-600 text-white shadow-lg" : "bg-white/60 border-white text-slate-400 hover:bg-white/85"}`}>
                <span className="text-[10px] font-bold leading-none">{day.label}</span>
                <span className={`text-xs font-bold mt-1 ${page + i === offset ? "text-white" : "text-slate-600"}`}>{day.date}</span>
              </button>
            ))}
          </div>
          {page > 0 && <button type="button" className="header-button" aria-label={t("next")} onClick={() => setOffset(page - 7)}>›</button>}
        </nav>}
        <main className="p-4 pb-10">
          {!visibleProfiles.length && <p className="soft-panel rounded-3xl p-5 font-semibold">
            {t(model.profiles.length ? "allInactive" : "noProfiles")}
          </p>}
          <div className="family-grid grid gap-5">
            {visibleProfiles.map((user) => <ProfileCard key={user.id} {...{ user, language, t, call, cache }}
              brushes={usersData[user.id]} stats={stats[user.id]} rules={model.rules}
              states={hass.states ?? {}} timeZone={model.timeZone} isToday={offset === 0} />)}
          </div>
          {model.profiles.length > 0 && <div className="soft-panel rounded-3xl p-4 mt-5">
            <h3 className="font-black text-xs text-slate-500 mb-3 uppercase tracking-[0.14em] border-b border-slate-200/70 pb-2">{t("history")}</h3>
            <div className="space-y-1">
              {index.logs.slice(0, 8).map((log) => (
                <div key={log.id} className="history-row text-[11px] font-mono border-b border-slate-100/80 pb-1">
                  <span className="font-bold text-slate-700 truncate">{names[log.userId]}</span>
                  <span className="text-slate-600">{new Date(log.timestamp).toLocaleTimeString(language, { timeZone: model.timeZone })} ({log.duration} {t("seconds")})</span>
                  <span className="text-purple-700 font-bold text-right">{log.debugDateKey}</span>
                </div>
              ))}
              {!index.logs.length && <p className="text-xs text-slate-600">{t("emptyHistory")}</p>}
            </div>
          </div>}
        </main>
      </>}
    </div>
  );
}
