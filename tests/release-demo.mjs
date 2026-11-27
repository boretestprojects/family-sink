// Synthetic data for screenshots of the built integration panel.
export const demoClock = "2026-11-27T20:30:00+01:00";

const family = [
  ["rowan", "Rowan", "#2563eb", "fox", "Blue", 78],
  ["avery", "Avery", "#0f766e", "bear", "Mint", 62],
  ["casey", "Casey", "#7e22ce", "rabbit", "Lilac", 46],
  ["morgan", "Morgan", "#a16207", "owl", "Gold", 94],
];
const roles = ["state", "duration", "battery"];

function demoHistory() {
  const sessions = [];
  for (let age = 55; age >= 0; age--) {
    const date = new Date(Date.UTC(2026, 10, 27 - age)).toISOString().slice(0, 10);
    const offset = date < "2026-10-25" ? "+02:00" : "+01:00";
    for (const [index, [userId]] of family.entries()) {
      if ((age + index * 2) % 23 === 4) continue;
      const morning = 108 + (age * 7 + index * 9) % 32;
      const evening = 113 + (age * 11 + index * 13) % 36;
      const recent = [
        [128, 67, 182], [126, 91, 123], [113, 75, 126], [125, 54, 132],
      ][index];
      const slot = [
        [`07:${30 + index * 6}:00`, age === 0 ? recent[0] : morning],
        [`12:${15 + index * 5}:00`, age === 0 ? recent[1] : 52 + (age * 11 + index * 5) % 47],
        [`19:${String(5 + index * 8).padStart(2, "0")}:00`, age === 0 ? recent[2] : evening],
      ];
      for (const [position, [time, duration]] of slot.entries()) {
        if (age > 0 && position === 1 && (age + index + 3) % 4 !== 0) continue;
        if (age === 0 && index === 1 && position === 2) continue;
        sessions.push({ id: `${userId}-${date}-${position}`, userId, duration, timestamp: `${date}T${time}${offset}` });
      }
    }
  }
  return sessions;
}

export function setupReleaseDemo(element, rules, admin) {
  const profiles = family.map(([id, name, color, avatar], index) => ({
    id, name, color, avatar, team: index < 2 ? "leader" : "kids",
    active: true, start: null, device: `demo-${id}`, manual: {},
  }));
  const devices = family.map(([id, , , , handle]) => ({
    id: `demo-${id}`, name: `${handle} brush`,
    mapping: Object.fromEntries(roles.map((role) => [role, `sensor.demo_${id}_${role}`])),
  }));
  const states = {};
  for (const [index, device] of devices.entries()) {
    states[device.mapping.state] = { state: index === 3 ? "charging" : "idle", attributes: {} };
    states[device.mapping.duration] = { state: index === 0 ? "182" : index === 1 ? "123" : "126", attributes: { unit_of_measurement: "s" } };
    states[device.mapping.battery] = { state: String(family[index][5]), attributes: {} };
  }
  const sessions = demoHistory();
  let hass = {
    language: "en", connected: true, user: { is_admin: admin }, states,
    async callWS({ type, action, history_revision }) {
      if (type === "family_sink/dashboard") return {
        profiles: profiles.map((person, index) => ({
          ...person, avatarRevision: null, entities: devices[index].mapping,
        })),
        rules, historyRevision: "release-demo", timeZone: "Europe/Oslo",
        ...(history_revision !== "release-demo" && { sessions }),
      };
      if (type === "family_sink/admin" && admin && action === "settings") return {
        profiles, rules, defaults: rules, devices,
        sensors: devices.flatMap((device) => Object.entries(device.mapping).map(([role, entity]) => ({
          id: entity, device: device.id, entity, name: role,
        }))),
        diagnostics: devices.map((device, index) => ({
          person: profiles[index].id, conflict: false, pending: false,
          entities: Object.fromEntries(Object.entries(device.mapping).map(([role, entity]) => [role, { entity, available: true }])),
        })),
        sessionCount: sessions.length,
      };
      throw { code: "unauthorized" };
    },
  };
  element.setProperties({ narrow: innerWidth < 600, hass });
  window.updateReleaseBrush = (duration) => {
    hass = {
      ...hass,
      states: {
        ...hass.states,
        "sensor.demo_avery_state": { state: "running", attributes: {} },
        "sensor.demo_avery_duration": { state: String(duration), attributes: { unit_of_measurement: "s" } },
      },
    };
    element.setProperties({ hass });
  };
}
