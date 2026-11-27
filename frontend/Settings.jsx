import React, { useEffect, useState } from "react";
import { avatars } from "./i18n.js";

const roles = ["state", "duration", "battery"];
const emptyProfile = {
  name: "", team: "", color: "#2563eb", avatar: "initial", active: true, start: null,
  device: null, manual: {},
};

function readPhoto(file) {
  if (file.size > 2 * 1024 * 1024) return Promise.reject({ code: "image_too_large" });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = () => reject({ code: "invalid_image" });
    reader.readAsDataURL(file);
  });
}

function ProfileForm({ profile, setProfile, model, run, t, busy }) {
  const set = (key, value) => setProfile({ ...profile, [key]: value });
  const device = model.devices.find(({ id }) => id === profile.device);
  const sensors = model.sensors.filter((sensor) => !profile.device || !sensor.device || sensor.device === profile.device);

  const save = (event) => {
    event.preventDefault();
    run(async (request) => {
      await request("profile", profile);
      setProfile(null);
    }, true);
  };

  function manual(role, value) {
    const next = { ...profile.manual };
    if (value) next[role] = value;
    else delete next[role];
    set("manual", next);
  }

  return (
    <form onSubmit={save} className="settings-form">
      <label>{t("name")}<input required maxLength={80} value={profile.name} onChange={(event) => set("name", event.target.value)} /></label>
      <label>{t("team")}<input maxLength={60} value={profile.team} onChange={(event) => set("team", event.target.value)} /></label>
      <label>{t("color")}<input type="color" value={profile.color} onChange={(event) => set("color", event.target.value)} /></label>
      <label>{t("avatar")}
        <select value={profile.avatar} onChange={(event) => set("avatar", event.target.value)}>
          {Object.entries(avatars).map(([id, emoji]) => <option key={id} value={id}>{emoji || t("initial")}</option>)}
        </select>
      </label>
      <label>{t("gameStart")}
        <input type="date" value={profile.start ?? ""} onChange={(event) => set("start", event.target.value || null)} />
        <small>{t("gameStartHint")}</small>
      </label>
      <label className="self-start">
        <span><input type="checkbox" checked={profile.active} onChange={(event) => set("active", event.target.checked)} /> {t("active")}</span>
      </label>
      <label className="settings-wide">{t("brush")}
        <select value={profile.device ?? ""} onChange={(event) => setProfile({
          ...profile, device: event.target.value || null, manual: {},
        })}>
          <option value="">{t("unassigned")}</option>
          {!device && profile.device && <option value={profile.device}>{t("missing")}</option>}
          {model.devices.map(({ id, name, mapping }) => (
            <option key={id} value={id}>{name}{mapping.state && mapping.duration ? "" : ` · ${t("manual")}`}</option>
          ))}
        </select>
        {!model.devices.length && <small>{t("noBrushes")}</small>}
      </label>
      <details className="settings-wide" open={Object.keys(profile.manual).length ? true : undefined}>
        <summary>{t("manual")}</summary>
        <div className="settings-form">
          {roles.map((role) => (
            <label key={role}>{t(role)}
              <select value={profile.manual[role] ?? ""} onChange={(event) => manual(role, event.target.value)}>
                <option value="">{t("auto")} · {device?.mapping[role] ?? t("missing")}</option>
                {profile.manual[role] && !sensors.some(({ id }) => id === profile.manual[role]) &&
                  <option value={profile.manual[role]}>{t("missing")}</option>}
                {sensors.map(({ id, entity }) => <option key={id} value={id}>{entity}</option>)}
              </select>
            </label>
          ))}
        </div>
      </details>
      {profile.id && (
        <div className="settings-wide settings-form">
          <label>{t("upload")}
            <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy}
              onChange={(event) => {
                const [file] = event.target.files;
                event.target.value = "";
                if (file) run(async (request) => request("avatar", {
                  person: profile.id, image: await readPhoto(file),
                }), true);
              }} />
            <small>{t("photoHelp")}</small>
          </label>
          <button type="button" className="settings-button self-start" disabled={busy}
            onClick={() => run((request) => request("avatar", { person: profile.id, image: null }), true)}>
            {t("removePhoto")}
          </button>
        </div>
      )}
      <div className="settings-wide flex flex-wrap gap-2">
        <button className="settings-button primary" disabled={busy}>{t("save")}</button>
        <button className="settings-button" type="button" onClick={() => setProfile(null)}>{t("cancel")}</button>
      </div>
    </form>
  );
}

const scoringFields = {
  thresholds: "list", points: "list", missingMorning: "points", missingEvening: "points",
  missedDay: "points", masterDuration: "positive", masterCount: "positive",
  masterBonus: "points", targetDuration: "positive", dayStart: "time", morningStart: "time",
  morningEnd: "time", eveningStart: "time", eveningEnd: "time",
};

function ruleFields(rules) {
  return Object.fromEntries(Object.entries(rules).map(([key, value]) => {
    if (scoringFields[key] !== "time") return [key, String(value)];
    const clock = [Math.floor(value / 60), value % 60].map((part) => String(part).padStart(2, "0")).join(":");
    return [key, clock];
  }));
}

function Rules({ model, t, run, busy }) {
  const [values, setValues] = useState(() => ruleFields(model.rules));
  const controls = Object.entries(scoringFields);
  function save(event) {
    event.preventDefault();
    const rules = Object.fromEntries(controls.map(([key, kind]) => {
      const value = values[key];
      if (kind === "list") return [key, value.split(",").map((part) => part.trim() ? Number(part) : null)];
      if (kind === "time") {
        const [hours, minutes] = value.split(":").map(Number);
        return [key, hours * 60 + minutes];
      }
      return [key, Number(value)];
    }));
    run((request) => request("rules", rules), true);
  }
  return (
    <details className="soft-panel settings-section">
      <summary>{t("game")}</summary>
      <p className="text-sm mb-3">{t("rulesHelp")}</p>
      <form onSubmit={save} className="settings-form">
        {controls.map(([key, kind]) => (
          <label key={key}>{t(key === "points" ? "rulePoints" : key)}
            <input required type={kind === "list" ? "text" : kind === "time" ? "time" : "number"}
              min={kind === "positive" ? 1 : kind === "points" ? -1000 : undefined}
              max={kind === "positive" ? 3600 : kind === "points" ? 1000 : undefined}
              value={values[key]} onChange={(event) => setValues({ ...values, [key]: event.target.value })} />
          </label>
        ))}
        <div className="settings-wide flex flex-wrap gap-2">
          <button className="settings-button primary" disabled={busy}>{t("save")}</button>
          <button className="settings-button" type="button" onClick={() => setValues(ruleFields(model.defaults))}>{t("defaults")}</button>
        </div>
      </form>
    </details>
  );
}

function History({ model, t, run, busy }) {
  const [preview, setPreview] = useState(null);
  const [mapping, setMapping] = useState({});
  const [report, setReport] = useState(null);
  function fileChanged(event) {
    const [file] = event.target.files;
    event.target.value = "";
    if (!file) return;
    setPreview(null);
    setReport(null);
    run(async (request) => {
      if (file.size > 1024 * 1024) throw { code: "import_too_large" };
      const text = await file.text();
      const result = await request("preview", { text });
      setMapping(Object.fromEntries(result.sources.map((source) => {
        const match = model.profiles.find(({ id }) => source === id);
        return [source, match?.id ?? ""];
      })));
      setPreview({ ...result, text });
    });
  }
  function importHistory() {
    run(async (request) => {
      const result = await request("import", {
        text: preview.text, mapping: Object.fromEntries(Object.entries(mapping).filter(([, id]) => Boolean(id))),
      });
      setReport(result);
    }, true);
  }
  function exportHistory() {
    run(async (request) => {
      const text = await request("export");
      const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "family-sink-brush-log.txt";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }
  return (
    <details className="soft-panel settings-section">
      <summary>{t("importExport")}</summary>
      <div className="settings-form">
        <label>{t("importFile")}<input type="file" accept=".txt,text/plain" onChange={fileChanged} disabled={busy} /></label>
        <button className="settings-button self-start" type="button" onClick={exportHistory} disabled={busy}>{t("export")}</button>
        {preview && (
          <>
            <div className="settings-wide">
              <p className="text-sm">{t("valid")} {preview.valid} · {t("invalid")} {preview.invalid}</p>
              <p className="text-sm">{t("importHint")}</p>
            </div>
            {preview.sources.map((source) => (
              <label key={source} className="break-all">{source}
                <select value={mapping[source]} onChange={(event) => setMapping({ ...mapping, [source]: event.target.value })}>
                  <option value="">{t("none")}</option>
                  {model.profiles.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
                </select>
              </label>
            ))}
            <button className="settings-button primary self-start" type="button" onClick={importHistory}
              disabled={busy || !Object.values(mapping).some(Boolean)}>{t("import")}</button>
          </>
        )}
        {report && <p role="status" className="settings-wide text-sm">
          {Object.entries(report).map(([key, value]) => `${t(key)} ${value}`).join(" · ")}
        </p>}
      </div>
    </details>
  );
}

export function Settings({ call, t, onClose, onChanged }) {
  const [model, setModel] = useState(null);
  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const request = (action, data = {}) => call({ type: "family_sink/admin", action, data });
  const refresh = async () => setModel(await request("settings"));

  async function run(operation, changed = false) {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await operation(request);
      if (changed) {
        await Promise.all([refresh(), onChanged()]);
        setStatus("saved");
      }
    } catch (failure) {
      setError(failure.code ?? "unknown_error");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { run(refresh); }, []);

  return (
    <main className="settings-page">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">{t("settings")}</h1>
        <button type="button" className="settings-button" onClick={onClose}>{t("closeSettings")}</button>
      </header>
      {error && <p role="alert" className="text-red-700 font-semibold">{t(error)}</p>}
      {status && <p role="status" className="text-green-700 font-semibold">{t(status)}</p>}
      {!model && !error && <p role="status">{t("loading")}</p>}
      {!model && error && <button className="settings-button" onClick={() => run(refresh)}>{t("refreshNow")}</button>}
      {model && <>
        <section className="soft-panel settings-section">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="text-lg font-black">{t("profiles")}</h2>
            <button className="settings-button" type="button" onClick={() => setProfile({ ...emptyProfile })}>{t("addProfile")}</button>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            {model.profiles.map((person) => (
              <button key={person.id} className="settings-button" type="button" aria-pressed={profile?.id === person.id}
                onClick={() => setProfile(person)}>
                <span className="profile-dot" style={{ background: person.color }} />
                {person.name}{!person.active && ` · ${t("inactive")}`}
              </button>
            ))}
          </div>
          {profile && <ProfileForm key={profile.id ?? "new"} {...{ profile, setProfile, model, run, t, busy }} />}
        </section>
        <Rules {...{ model, t, run, busy }} />
        <History {...{ model, t, run, busy }} />
        <details className="soft-panel settings-section">
          <summary>{t("diagnostics")}</summary>
          <p className="my-2 text-sm">{t("count")} {model.sessionCount}</p>
          <button type="button" className="settings-button" onClick={() => run(refresh)} disabled={busy}>{t("refreshNow")}</button>
          <ul className="space-y-3 mt-3 text-sm">
            {model.diagnostics.map(({ person, entities, conflict, pending }) => (
              <li key={person}>
                <strong>{model.profiles.find(({ id }) => id === person)?.name}</strong>
                {conflict && <p className="text-red-700">{t("duplicate_brush")}</p>}
                {pending && <p className="text-blue-700">{t("pending")}</p>}
                {roles.map((role) => <div key={role} className="break-all">
                  {t(role)} · {entities[role].entity ?? t("missing")}
                  {entities[role].entity && !entities[role].available && ` · ${t("missing")}`}
                </div>)}
              </li>
            ))}
          </ul>
        </details>
      </>}
    </main>
  );
}
