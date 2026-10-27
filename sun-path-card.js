/*
 * Sun Path Card (FR) — carte 2 en 1 soleil / lune
 * Carte Home Assistant « soleil » inspirée de lunar-phase-card : ciel qui change selon l'élévation
 * (nuit étoilée, aube, jour, crépuscule), arc du soleil avec sa position réelle, azimut / élévation,
 * et frise chronologique des prochains événements (aube, lever, midi, coucher, crépuscule, minuit).
 * Thème clair/sombre automatique, éditeur visuel, textes en français.
 */
const CARD_VERSION = "1.2.0";
// Photos de lune (31 images, une par jour du cycle) : copie hébergée dans ce dépôt, puis dépôt d'origine de lunar-phase-card (Viet Ngoc, MIT) en secours
const MOON_URLS = [
  (i) => `https://cdn.jsdelivr.net/gh/Johan854/sun-path-card@v1.2.0/moon_pic/${i}_moon.webp`,
  (i) => `https://cdn.jsdelivr.net/gh/ngocjohn/lunar-phase-card@1.14.0/moon_pic/${i}_moon.png`,
];

const DEFAULTS = {
  title: "Soleil",
  theme: "auto",
  sun_entity: "sun.sun",
  azimuth_entity: "sensor.sun_solar_azimuth",
  elevation_entity: "sensor.sun_solar_elevation",
  rising_entity: "binary_sensor.sun_solar_rising",
  dawn_entity: "sensor.sun_next_dawn",
  sunrise_entity: "sensor.sun_next_rising",
  noon_entity: "sensor.sun_next_noon",
  sunset_entity: "sensor.sun_next_setting",
  dusk_entity: "sensor.sun_next_dusk",
  midnight_entity: "sensor.sun_next_midnight",
  show_events: true,
  show_stars: true,
  mode: "both", // sun | moon | both
  moon_position: "left",
  moon_style: "real", // real | drawn
  moon_rotate: true,
  default_view: "base",
  hide_starfield: false,
  hide_buttons: false,
  moon_title: "Phase de la lune",
  latitude: "",
  longitude: "",
  southern_hemisphere: false,
};

const EVENTS = [
  ["dawn_entity", "Aube", "mdi:weather-sunset-up"],
  ["sunrise_entity", "Lever du soleil", "mdi:white-balance-sunny"],
  ["noon_entity", "Midi solaire", "mdi:weather-sunny"],
  ["sunset_entity", "Coucher du soleil", "mdi:weather-sunset-down"],
  ["dusk_entity", "Crépuscule", "mdi:weather-sunset"],
  ["midnight_entity", "Minuit solaire", "mdi:weather-night"],
];

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (st) => (st && st.state !== "unknown" && st.state !== "unavailable" && st.state !== "" && !isNaN(Number(st.state)) ? Number(st.state) : null);
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => c1.map((v, i) => Math.round(lerp(v, c2[i], Math.max(0, Math.min(1, t)))));
const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;

// Palette du ciel selon l'élévation (haut, bas)
const SKY = [
  [-18, [8, 10, 28], [18, 20, 48]],
  [-6, [24, 28, 66], [70, 50, 96]],
  [0, [70, 70, 140], [240, 140, 90]],
  [8, [90, 140, 210], [250, 190, 120]],
  [30, [40, 120, 220], [130, 190, 240]],
  [90, [30, 100, 210], [120, 185, 240]],
];
function sky(el) {
  if (el <= SKY[0][0]) return [SKY[0][1], SKY[0][2]];
  for (let i = 1; i < SKY.length; i++) {
    if (el <= SKY[i][0]) {
      const t = (el - SKY[i - 1][0]) / (SKY[i][0] - SKY[i - 1][0]);
      return [mix(SKY[i - 1][1], SKY[i][1], t), mix(SKY[i - 1][2], SKY[i][2], t)];
    }
  }
  return [SKY[5][1], SKY[5][2]];
}

/* Calculs lunaires (algorithmes de SunCalc, précision d'environ une minute d'arc) */
const MoonCalc = (() => {
  const PI = Math.PI, rad = PI / 180, DAY = 86400000, J1970 = 2440588, J2000 = 2451545, E = rad * 23.4397, SYN = 29.530588853;
  const days = (d) => d.valueOf() / DAY - 0.5 + J1970 - J2000;
  const ra = (l, b) => Math.atan2(Math.sin(l) * Math.cos(E) - Math.tan(b) * Math.sin(E), Math.cos(l));
  const dec = (l, b) => Math.asin(Math.sin(b) * Math.cos(E) + Math.cos(b) * Math.sin(E) * Math.sin(l));
  const moon = (d) => {
    const L = rad * (218.316 + 13.176396 * d), M = rad * (134.963 + 13.064993 * d), F = rad * (93.272 + 13.22935 * d);
    const l = L + rad * 6.289 * Math.sin(M), b = rad * 5.128 * Math.sin(F);
    return { ra: ra(l, b), dec: dec(l, b), dist: 385001 - 20905 * Math.cos(M) };
  };
  const refr = (h) => { if (h < 0) h = 0; return 0.0002967 / Math.tan(h + 0.00312536 / (h + 0.08901179)); };
  function pos(date, lat, lng) {
    const lw = rad * -lng, phi = rad * lat, d = days(date), c = moon(d);
    const H = rad * (280.16 + 360.9856235 * d) - lw - c.ra;
    let alt = Math.asin(Math.sin(phi) * Math.sin(c.dec) + Math.cos(phi) * Math.cos(c.dec) * Math.cos(H));
    alt += refr(alt);
    const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(c.dec) * Math.cos(phi));
    const pa = Math.atan2(Math.sin(H), Math.tan(phi) * Math.cos(c.dec) - Math.sin(c.dec) * Math.cos(H));
    return { altitude: alt / rad, azimuth: (az / rad + 180 + 360) % 360, distance: c.dist, pa: pa / rad };
  }
  function illum(date) {
    const d = days(date), M = rad * (357.5291 + 0.98560028 * d);
    const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
    const L = M + C + rad * 102.9372 + PI, sd = dec(L, 0), sr = ra(L, 0), m = moon(d), sdist = 149598000;
    const phi = Math.acos(Math.sin(sd) * Math.sin(m.dec) + Math.cos(sd) * Math.cos(m.dec) * Math.cos(sr - m.ra));
    const inc = Math.atan2(sdist * Math.sin(phi), m.dist - sdist * Math.cos(phi));
    const angle = Math.atan2(Math.cos(sd) * Math.sin(sr - m.ra), Math.sin(sd) * Math.cos(m.dec) - Math.cos(sd) * Math.sin(m.dec) * Math.cos(sr - m.ra));
    return { fraction: (1 + Math.cos(inc)) / 2, phase: 0.5 + (0.5 * inc * (angle < 0 ? -1 : 1)) / PI };
  }
  function times(date, lat, lng) {
    const t = new Date(date); t.setHours(0, 0, 0, 0);
    const hc = 0.133, alt = (i) => pos(new Date(t.getTime() + i * 3600000), lat, lng).altitude - hc;
    let h0 = alt(0), rise, set;
    for (let i = 1; i <= 24; i += 2) {
      const h1 = alt(i), h2 = alt(i + 1), a = (h0 + h2) / 2 - h1, b = (h2 - h0) / 2, xe = -b / (2 * a), ye = (a * xe + b) * xe + h1, dd = b * b - 4 * a * h1;
      let roots = 0, x1, x2;
      if (dd >= 0) { const dx = Math.sqrt(dd) / (Math.abs(a) * 2); x1 = xe - dx; x2 = xe + dx; if (Math.abs(x1) <= 1) roots++; if (Math.abs(x2) <= 1) roots++; if (x1 < -1) x1 = x2; }
      if (roots === 1) { if (h0 < 0) rise = i + x1; else set = i + x1; }
      else if (roots === 2) { rise = i + (ye < 0 ? x2 : x1); set = i + (ye < 0 ? x1 : x2); }
      if (rise !== undefined && set !== undefined) break;
      h0 = h2;
    }
    const f = (x) => (x === undefined ? null : new Date(t.getTime() + x * 3600000));
    return { rise: f(rise), set: f(set) };
  }
  function next(target, from) {
    const f = (t) => { let x = illum(new Date(t)).phase - target; if (x < -0.5) x += 1; if (x > 0.5) x -= 1; return x; };
    let t = from.getTime(), prev = f(t);
    for (let i = 0; i < 24 * 32; i++) {
      const n = t + 3600000, v = f(n);
      if (prev < 0 && v >= 0) { let lo = t, hi = n; for (let k = 0; k < 20; k++) { const mid = (lo + hi) / 2; if (f(mid) < 0) lo = mid; else hi = mid; } return new Date(hi); }
      t = n; prev = v;
    }
    return new Date(from.getTime() + SYN * DAY / 2);
  }
  function name(p) {
    const l = p < 0.03 || p >= 0.97 ? ["Nouvelle lune", "mdi:moon-new"] : p < 0.22 ? ["Premier croissant", "mdi:moon-waxing-crescent"] : p < 0.28 ? ["Premier quartier", "mdi:moon-first-quarter"]
      : p < 0.47 ? ["Gibbeuse croissante", "mdi:moon-waxing-gibbous"] : p < 0.53 ? ["Pleine lune", "mdi:moon-full"] : p < 0.72 ? ["Gibbeuse décroissante", "mdi:moon-waning-gibbous"]
      : p < 0.78 ? ["Dernier quartier", "mdi:moon-last-quarter"] : ["Dernier croissant", "mdi:moon-waning-crescent"];
    return { label: l[0], icon: l[1] };
  }
  let uid = 0;
  function svg(phase, r, o = {}) {
    const id = "mc" + ++uid, cx = 64, cy = 64, R = 60, waxing = phase < 0.5, q = waxing ? phase : 1 - phase;
    const k = Math.cos(2 * PI * q), rx = Math.abs(k) * R;
    const lit = q < 0.0015 ? "" : `M ${cx} ${cy - R} A ${R} ${R} 0 0 1 ${cx} ${cy + R} A ${rx.toFixed(2)} ${R} 0 0 ${k > 0 ? 0 : 1} ${cx} ${cy - R} Z`;
    const flip = o.south ? waxing : !waxing;
    const disc = `M ${cx - R} ${cy} A ${R} ${R} 0 1 0 ${cx + R} ${cy} A ${R} ${R} 0 1 0 ${cx - R} ${cy} Z`;
    const maria = o.big ? [[-18, -16, 17, 13], [10, -26, 12, 9], [18, 4, 15, 12], [-22, 20, 12, 9], [0, 28, 8, 7], [-6, -2, 9, 7], [30, -14, 8, 6]]
      .map(([x, y, a, b]) => `<ellipse cx="${cx + x}" cy="${cy + y}" rx="${a}" ry="${b}" fill="#8e93a8" opacity=".32"/>`).join("") : "";
    const tex = o.big ? `<radialGradient id="${id}g" cx=".38" cy=".35" r=".8"><stop offset="0" stop-color="#fffbe6"/><stop offset=".7" stop-color="#e8e1c4"/><stop offset="1" stop-color="#bdb79c"/></radialGradient>` : "";
    return `<svg viewBox="0 0 128 128" width="${r * 2}" height="${r * 2}" aria-hidden="true">
      <defs>${tex}<filter id="${id}b" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1.1"/></filter><clipPath id="${id}c"><path d="${disc}"/></clipPath></defs>
      <g clip-path="url(#${id}c)">${o.img ? `<rect width="128" height="128" fill="#111"/><image class="mimgreal" href="${o.img}" x="0" y="0" width="128" height="128" preserveAspectRatio="xMidYMid slice" ${o.south ? 'transform="rotate(180 64 64)"' : ""}/>`
        : `<rect x="0" y="0" width="128" height="128" fill="${o.big ? `url(#${id}g)` : "#f6efcf"}"/>${maria}`}
        <path d="${disc} ${lit}" fill-rule="evenodd" fill="${o.big ? "#03040f" : "#232842"}" fill-opacity="${o.img ? 0.93 : o.big ? 0.9 : 1}" ${o.img ? `filter="url(#${id}b)"` : ""} transform="${flip ? "translate(128 0) scale(-1 1)" : ""}" style="${lit ? "" : "fill-opacity:1"}"/></g>
      <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="rgba(255,255,255,.2)"/></svg>`;
  }
  return { illum, pos, times, next, name, svg, SYN };
})();

class SunPathCard extends HTMLElement {
  static getConfigElement() { return document.createElement("sun-path-card-editor"); }
  static getStubConfig() { return { ...DEFAULTS }; }

  constructor() { super(); this.attachShadow({ mode: "open" }); this._sig = ""; }

  setConfig(config) {
    if (!config) throw new Error("Configuration invalide");
    this._config = { ...DEFAULTS, ...config };
    this._sig = "";
    if (this._hass) this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    const sig = this._ids().map((e) => { const s = hass.states[e]; return s ? s.state : "x"; }).join("|") + (this._isDark() ? "d" : "l") + Math.floor(Date.now() / 60000);
    if (sig !== this._sig) { this._sig = sig; this._render(); }
  }

  getCardSize() { return 6; }

  _ids() {
    const c = this._config;
    return [c.sun_entity, c.azimuth_entity, c.elevation_entity, c.rising_entity, ...EVENTS.map((e) => c[e[0]])].filter(Boolean);
  }

  _isDark() {
    const t = this._config && this._config.theme;
    if (t === "dark") return true;
    if (t === "light") return false;
    const dm = this._hass && this._hass.themes && this._hass.themes.darkMode;
    if (typeof dm === "boolean") return dm;
    return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  }

  _lang() { return (this._hass && this._hass.locale && this._hass.locale.language) || "fr"; }

  _more(id) { if (id) this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId: id } })); }

  _dur(ms) {
    const m = Math.max(0, Math.round(ms / 60000));
    const h = Math.floor(m / 60), r = m % 60;
    return h > 0 ? `${h} h ${String(r).padStart(2, "0")}` : `${r} min`;
  }


  /* ---------- Vue lune (style lunar-phase-card) ---------- */
  _moonData(date) {
    const c = this._config, h = this._hass;
    const lat = Number(c.latitude ?? (h.config && h.config.latitude)), lng = Number(c.longitude ?? (h.config && h.config.longitude));
    const ill = MoonCalc.illum(date);
    const pos = MoonCalc.pos(date, lat, lng);
    return { lat, lng, ill, pos };
  }

  _moonView() {
    const c = this._config, h = this._hass, now = new Date();
    const lang = this._lang();
    const { lat, lng, ill, pos } = this._moonData(now);
    const phase = ill.phase, age = phase * MoonCalc.SYN;
    const name = MoonCalc.name(phase);
    const tf = new Intl.DateTimeFormat(lang, { hour: "2-digit", minute: "2-digit" });
    const dfm = new Intl.DateTimeFormat(lang, { weekday: "short", day: "numeric", month: "short" });
    const view = this._mv || c.default_view || "base";
    const south = !!c.southern_hemisphere;
    const nf = (n, d = 0) => new Intl.NumberFormat(lang, { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
    const times = MoonCalc.times(now, lat, lng);
    const t2 = (d) => (d ? tf.format(d) : "—");
    const nextFull = MoonCalc.next(0.5, now), nextNew = MoonCalc.next(0, now);
    const rel = (d) => { const x = (d - now) / 86400000; return x < 1 ? "dans " + Math.max(1, Math.round(x * 24)) + " h" : "dans " + Math.round(x) + " j"; };

    // étoiles
    const W = 340;
    const stars = Array.from({ length: 70 }, (_, i) => {
      const r1 = Math.sin(i * 91.7) * 43758.5453, r2 = Math.sin(i * 12.9898 + 4.1) * 24634.6345;
      return `<circle cx="${((r1 - Math.floor(r1)) * 100).toFixed(1)}%" cy="${((r2 - Math.floor(r2)) * 100).toFixed(1)}%" r="${(0.5 + (i % 3) * 0.4).toFixed(1)}" fill="#fff" opacity="${(0.3 + (i % 5) / 8).toFixed(2)}" class="tw" style="animation-delay:${(i % 9) * 0.35}s"/>`;
    }).join("");

    const rows = [
      ["mdi:moon-waning-crescent", "Phase", name.label],
      ["mdi:brightness-6", "Illumination", nf(ill.fraction * 100, 1) + " %"],
      ["mdi:calendar-clock", "Âge", nf(age, 1) + " jours"],
      ["mdi:map-marker-distance", "Distance", nf(pos.distance) + " km"],
      ["mdi:angle-acute", "Altitude", nf(pos.altitude, 1) + "°"],
      ["mdi:compass-outline", "Azimut", nf(pos.azimuth, 1) + "°"],
      ["mdi:weather-moonset-up", "Lever de lune", t2(times.rise)],
      ["mdi:weather-moonset-down", "Coucher de lune", t2(times.set)],
      ["mdi:moon-full", "Prochaine pleine lune", dfm.format(nextFull).replace(".", "") + " · " + rel(nextFull)],
      ["mdi:moon-new", "Prochaine nouvelle lune", dfm.format(nextNew).replace(".", "") + " · " + rel(nextNew)],
    ].map((r) => `<div class="row"><ha-icon icon="${r[0]}"></ha-icon><span class="rl">${r[1]}</span><b>${esc(r[2])}</b></div>`).join("");

    let body = "";
    if (view === "base") {
      body = `<div class="base ${c.moon_position === "right" ? "mr" : ""}"><div class="mimg">${(c.moon_style === "drawn" || (this._imgStage || 0) >= MOON_URLS.length)
          ? MoonCalc.svg(phase, 64, { south, big: true })
          : `<img class="mireal" alt="${esc(name.label)}" draggable="false" src="${MOON_URLS[this._imgStage || 0](Math.round(phase * 30) % 31)}" style="${c.moon_rotate ? `transform:rotate(${pos.pa.toFixed(1)}deg)` : ""}">`}
        <div class="mn">${esc(name.label)}</div></div><div class="data">${rows}</div></div>`;
    } else if (view === "horizon") {
      const d0 = new Date(now); d0.setHours(0, 0, 0, 0);
      const pts = []; let mx = { a: -90, i: 0 };
      for (let i = 0; i <= 96; i++) { const t = new Date(d0.getTime() + i * 15 * 60000), a = MoonCalc.pos(t, lat, lng).altitude; pts.push(a); if (a > mx.a) mx = { a, i }; }
      const GW = 320, GH = 150, base = 100, sc = 0.9; const X = (i) => (i / 96) * GW, Y = (a) => base - a * sc;
      const line = pts.map((a, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(a).toFixed(1)).join(" ");
      const ni = Math.min(96, (now - d0) / (15 * 60000));
      const na = MoonCalc.pos(now, lat, lng).altitude;
      body = `<div class="graph"><svg viewBox="0 0 ${GW} ${GH}"><defs><clipPath id="up"><rect x="0" y="0" width="${GW}" height="${base}"/></clipPath></defs>
        <rect x="0" y="${base}" width="${GW}" height="${GH - base}" fill="rgba(0,0,0,.35)"/>
        <path d="${line} L ${GW} ${base} L 0 ${base} Z" fill="rgba(246,239,207,.22)" clip-path="url(#up)"/>
        <path d="${line}" fill="none" stroke="#f6efcf" stroke-width="2"/>
        <line x1="0" y1="${base}" x2="${GW}" y2="${base}" stroke="rgba(255,255,255,.6)"/>
        ${[0, 6, 12, 18, 24].map((hh) => `<text x="${Math.min(GW - 14, Math.max(2, (hh / 24) * GW - 8))}" y="${GH - 6}" fill="#aab" font-size="9">${String(hh % 24).padStart(2, "0")}h</text>`).join("")}
        <line x1="${X(ni).toFixed(1)}" y1="6" x2="${X(ni).toFixed(1)}" y2="${base + 30}" stroke="rgba(255,255,255,.35)" stroke-dasharray="3 3"/>
        <circle cx="${X(ni).toFixed(1)}" cy="${Y(na).toFixed(1)}" r="6" fill="#ffd23d" stroke="#fff" stroke-width="1.5"/>
        ${mx.a > 0 ? `<circle cx="${X(mx.i).toFixed(1)}" cy="${Y(mx.a).toFixed(1)}" r="3.5" fill="#fff"/><text x="${Math.min(GW - 60, X(mx.i) + 6).toFixed(1)}" y="${(Y(mx.a) - 6).toFixed(1)}" fill="#fff" font-size="9">max ${nf(mx.a, 0)}°</text>` : ""}</svg>
        <div class="gl"><span>Lever ${t2(times.rise)}</span><span>Altitude ${nf(na, 1)}°</span><span>Coucher ${t2(times.set)}</span></div></div>`;
    } else {
      const off = this._calOff || 0;
      const m0 = new Date(now.getFullYear(), now.getMonth() + off, 1);
      const title = new Intl.DateTimeFormat(lang, { month: "long", year: "numeric" }).format(m0);
      const start = (m0.getDay() + 6) % 7, dim = new Date(m0.getFullYear(), m0.getMonth() + 1, 0).getDate();
      const wd = ["L", "M", "M", "J", "V", "S", "D"].map((x) => `<span class="wd">${x}</span>`).join("");
      let cells = "";
      for (let i = 0; i < start; i++) cells += "<span></span>";
      for (let d = 1; d <= dim; d++) {
        const dt = new Date(m0.getFullYear(), m0.getMonth(), d, 12), ph = MoonCalc.illum(dt).phase;
        const today = dt.toDateString() === now.toDateString();
        cells += `<span class="cd ${today ? "today" : ""}">${MoonCalc.svg(ph, 12, { south })}<i>${d}</i></span>`;
      }
      body = `<div class="cal"><div class="ch"><button data-cal="-1">‹</button><b>${esc(title)}</b><button data-cal="1">›</button></div><div class="cg">${wd}${cells}</div></div>`;
    }

    const tabs = [["base", "Lune", "mdi:moon-waning-crescent"], ["horizon", "Horizon", "mdi:chart-bell-curve"], ["calendar", "Calendrier", "mdi:calendar-month"]]
      .map(([k, l, ic]) => `<button class="tab ${view === k ? "on" : ""}" data-view="${k}"><ha-icon icon="${ic}"></ha-icon>${l}</button>`).join("");
    const both = c.mode === "both" || c.mode === "both";
    return `<style>
      * { box-sizing:border-box; }
      ha-card { container-type:inline-size; position:relative; overflow:hidden; color:#f4f6fb; border-radius:24px; border:1px solid rgba(255,255,255,.14);
        background:linear-gradient(170deg,#070918 0%,#10173a 60%,#1b1636 100%); box-shadow:0 .6em 2em rgba(0,0,0,.4); padding:16px; display:flex; flex-direction:column; gap:12px; }
      .stars { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; } .tw { animation:tw 3s ease-in-out infinite alternate; } @keyframes tw { to { opacity:.12; } }
      .z { position:relative; display:flex; flex-direction:column; gap:12px; }
      ha-icon { --mdc-icon-size:1.15em; flex:none; }
      button { font:inherit; color:inherit; background:none; border:0; padding:0; cursor:pointer; -webkit-tap-highlight-color:transparent; }
      .hd { display:flex; justify-content:space-between; align-items:center; } .hd .t { font-weight:700; font-size:1.05em; }
      .tg { display:flex; align-items:center; gap:.3em; font-size:.8em; padding:.35em .7em; border-radius:99px; background:rgba(255,255,255,.1); border:1px solid rgba(255,255,255,.15); }
      .base { display:grid; grid-template-columns:minmax(8em,.9fr) 1.4fr; gap:14px; align-items:center; } .base.mr { direction:rtl; } .base.mr > * { direction:ltr; }
      .mimg { display:flex; flex-direction:column; align-items:center; gap:.5em; } .mimg svg, .mimg img { width:100%; max-width:11em; height:auto; filter:drop-shadow(0 0 1.2em rgba(246,239,207,.25)); } .mireal { aspect-ratio:1; object-fit:contain; transition:transform .4s; }
      .mn { font-weight:700; font-size:.95em; text-align:center; }
      .data { display:flex; flex-direction:column; } .row { display:grid; grid-template-columns:auto 1fr auto; gap:.55em; align-items:center; padding:.42em 0; border-top:1px solid rgba(255,255,255,.1); font-size:.84em; }
      .row:first-child { border-top:0; } .row ha-icon { color:#f6e9a8; } .rl { color:#b9bfd6; } .row b { text-align:right; font-variant-numeric:tabular-nums; }
      @container (max-width: 360px) { .base { grid-template-columns:1fr; } .mimg svg, .mimg img { max-width:9em; } }
      .graph svg, .cal svg { display:block; width:100%; height:auto; } .graph { border-radius:16px; background:rgba(255,255,255,.05); padding:8px; border:1px solid rgba(255,255,255,.1); }
      .gl { display:flex; justify-content:space-between; font-size:.78em; color:#c7cce0; padding:4px 4px 0; }
      .cal { border-radius:16px; background:rgba(255,255,255,.05); padding:10px; border:1px solid rgba(255,255,255,.1); } .ch { display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; text-transform:capitalize; }
      .ch button { font-size:1.4em; padding:0 .5em; } .cg { display:grid; grid-template-columns:repeat(7,1fr); gap:4px; text-align:center; }
      .wd { font-size:.7em; color:#9aa2bd; } .cd { display:flex; flex-direction:column; align-items:center; gap:2px; padding:3px 0; border-radius:8px; } .cd i { font-style:normal; font-size:.72em; color:#c7cce0; }
      .cd.today { background:rgba(246,233,168,.2); outline:1px solid rgba(246,233,168,.6); }
      .tabs { display:flex; gap:6px; justify-content:center; } .tab { display:flex; align-items:center; gap:.35em; font-size:.8em; padding:.45em .8em; border-radius:99px; color:#c7cce0; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.1); }
      .tab.on { background:rgba(246,233,168,.22); color:#fff; border-color:rgba(246,233,168,.55); }
      @media (prefers-reduced-motion: reduce) { .tw { animation:none; } }
    </style>
    <ha-card>
      ${c.hide_starfield ? "" : `<svg class="stars" preserveAspectRatio="none">${stars}</svg>`}
      <div class="z">
        <div class="hd"><span class="t">${esc(c.moon_title || "Phase de la lune")}</span>${both ? `<button class="tg" data-tg="1"><ha-icon icon="mdi:weather-sunny"></ha-icon>Soleil</button>` : ""}</div>
        ${body}
        ${c.hide_buttons ? "" : `<div class="tabs">${tabs}</div>`}
      </div>
    </ha-card>`;
  }

  _render() {
    const c = this._config, h = this._hass;
    if (!c || !h) return;
    const dark = this._isDark();
    const sun = h.states[c.sun_entity];
    const sunEl = (() => { const x = num(h.states[c.elevation_entity]); return x !== null ? x : (sun ? num({ state: sun.attributes.elevation }) : null); })();
    const wantMoon = c.mode === "moon" ? true : c.mode === "sun" ? false : (this._force !== undefined ? this._force : (sunEl !== null ? sunEl < -6 : false));
    if (wantMoon) {
      this.shadowRoot.innerHTML = this._moonView();
      const R = this.shadowRoot;
      R.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => { this._mv = b.dataset.view; this._sig = ""; this._render(); }));
      R.querySelectorAll("[data-cal]").forEach((b) => b.addEventListener("click", () => { this._calOff = (this._calOff || 0) + Number(b.dataset.cal); this._sig = ""; this._render(); }));
      const im = R.querySelector(".mireal");
      if (im) im.addEventListener("error", () => { this._imgStage = (this._imgStage || 0) + 1; this._sig = ""; this._render(); });
      const t = R.querySelector("[data-tg]");
      if (t) t.addEventListener("click", () => { this._force = false; this._sig = ""; this._render(); });
      return;
    }
    const az = num(h.states[c.azimuth_entity]) ?? (sun && num({ state: sun.attributes.azimuth }));
    let el = num(h.states[c.elevation_entity]);
    if (el === null && sun) el = num({ state: sun.attributes.elevation });
    const have = az !== null && el !== null;
    const rising = h.states[c.rising_entity] ? h.states[c.rising_entity].state === "on" : (sun ? sun.attributes.rising === true : false);
    const e = have ? el : -30, a = have ? az : 180;

    let phase, pIcon;
    if (e >= 0) { phase = e > 55 ? "Plein soleil" : "Jour"; pIcon = "mdi:white-balance-sunny"; }
    else if (e >= -6) { phase = rising ? "Aube" : "Crépuscule"; pIcon = rising ? "mdi:weather-sunset-up" : "mdi:weather-sunset-down"; }
    else if (e >= -12) { phase = "Heure nautique"; pIcon = "mdi:weather-night"; }
    else { phase = "Nuit"; pIcon = "mdi:weather-night"; }

    // Géométrie : arc du jour (azimut 90°→270°) en haut, arc de nuit (270°→450°) sous l'horizon
    const W = 320, H = 170, hy = 112, rx = 130, ryUp = 80, ryDn = 34, cx = W / 2;
    let theta, onDay;
    if (a >= 90 && a <= 270) { theta = (a - 90) / 180; onDay = true; }
    else { theta = ((a < 90 ? a + 360 : a) - 270) / 180; onDay = false; }
    const ang = Math.PI * (1 - theta);
    const sx = cx + rx * Math.cos(ang);
    let sy;
    if (e >= 0 && onDay) sy = hy - ryUp * Math.sin(ang) * Math.min(1, Math.max(0.15, e / 60 + 0.25));
    else sy = hy + ryDn * Math.sin(Math.PI * theta) * Math.min(1, Math.max(0.2, -e / 30 + 0.2));
    if (e >= 0 && !onDay) sy = hy - 4;
    if (e < 0 && onDay) sy = hy + 6 + Math.min(30, -e);
    const [top, bot] = sky(e);
    const night = e < -6;
    const stars = c.show_stars && e < 0 ? Array.from({ length: 36 }, (_, i) => {
      const r1 = Math.sin(i * 91.7) * 43758.5453, r2 = Math.sin(i * 12.9898 + 4.1) * 24634.6345;
      const x = (r1 - Math.floor(r1)) * W, y = (r2 - Math.floor(r2)) * (hy - 6);
      const op = Math.max(0, Math.min(1, -e / 12)) * (0.4 + ((i * 7) % 6) / 10);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.6 + (i % 3) * 0.4).toFixed(1)}" fill="#fff" opacity="${op.toFixed(2)}" class="tw" style="animation-delay:${(i % 7) * 0.4}s"/>`;
    }).join("") : "";
    const up = e >= 0;
    const glow = Math.max(0, 1 - Math.abs(e) / 14);
    const archD = (ry, flip) => `M ${cx - rx} ${hy} A ${rx} ${ry} 0 0 ${flip ? 0 : 1} ${cx + rx} ${hy}`;
    const sunFill = up ? "#ffd23d" : "#ffb347";

    // Événements triés par proximité
    const now = Date.now();
    const evs = EVENTS.map(([k, label, icon]) => {
      const id = c[k]; const s = id && h.states[id];
      if (!s || s.state === "unknown" || s.state === "unavailable") return null;
      const d = new Date(s.state); if (isNaN(d)) return null;
      return { id, label, icon, d, ms: d.getTime() - now };
    }).filter(Boolean).sort((x, y) => x.d - y.d);
    const tf = new Intl.DateTimeFormat(this._lang(), { hour: "2-digit", minute: "2-digit" });
    const df = new Intl.DateTimeFormat(this._lang(), { weekday: "short" });
    const nextEv = evs[0];
    const rise = evs.find((x) => x.id === c.sunrise_entity), set = evs.find((x) => x.id === c.sunset_entity);
    let dayInfo = "";
    if (up && set) dayInfo = `Il reste ${this._dur(set.ms)} de jour`;
    else if (rise) dayInfo = `Le soleil se lève dans ${this._dur(rise.ms)}`;

    const evHtml = c.show_events && evs.length ? `<div class="evs">${evs.map((x, i) => {
      const today = x.d.toDateString() === new Date().toDateString();
      return `<button class="ev ${i === 0 ? "next" : ""}" data-more="${esc(x.id)}"><ha-icon icon="${x.icon}"></ha-icon>
        <span class="en">${esc(x.label)}</span><span class="et">${tf.format(x.d)}${today ? "" : ` <small>${esc(df.format(x.d).replace(".", ""))}</small>`}</span><span class="ed">dans ${this._dur(x.ms)}</span></button>`;
    }).join("")}</div>` : "";

    this.shadowRoot.innerHTML = `
    <style>
      * { box-sizing:border-box; }
      ha-card.dark { --sp-text:#f4f6fb; --sp-muted:#a9afc0; --sp-bg:linear-gradient(160deg,#1b1e32 0%,#241a2a 55%,#2d1519 100%); --sp-border:rgba(255,255,255,.14);
        --sp-shadow:0 .6em 2em rgba(0,0,0,.35); --sp-glass:rgba(255,255,255,.07); --sp-glass-b:rgba(255,255,255,.13); --sp-acc:#ffc83d; }
      ha-card.light { --sp-text:#1c2030; --sp-muted:#5d6477; --sp-bg:linear-gradient(160deg,#f8f9fd 0%,#eef1f8 55%,#f8eff0 100%); --sp-border:rgba(20,24,40,.12);
        --sp-shadow:0 .4em 1.4em rgba(20,24,40,.12); --sp-glass:rgba(255,255,255,.7); --sp-glass-b:rgba(20,24,40,.1); --sp-acc:#d68a00; }
      ha-card { container-type:inline-size; display:flex; flex-direction:column; gap:12px; padding:16px; color:var(--sp-text); overflow:hidden;
        border-radius:24px; border:1px solid var(--sp-border); background:var(--sp-bg); box-shadow:var(--sp-shadow); }
      ha-icon { --mdc-icon-size:1.2em; flex:none; }
      button { font:inherit; color:inherit; background:none; border:0; padding:0; text-align:left; cursor:pointer; -webkit-tap-highlight-color:transparent; }
      .hd { display:flex; justify-content:space-between; align-items:center; }
      .hd .t { font-weight:700; font-size:1.05em; } .tg { color:var(--sp-muted); display:flex; } .hd .ph { display:flex; align-items:center; gap:.4em; font-size:.85em; color:var(--sp-acc); font-weight:650; }
      .skyw { position:relative; border-radius:20px; overflow:hidden; border:1px solid var(--sp-glass-b); background:linear-gradient(${rgb(top)},${rgb(bot)}); }
      svg { display:block; width:100%; height:auto; }
      .tw { animation:tw 3s ease-in-out infinite alternate; } @keyframes tw { to { opacity:.15; } }
      .halo { animation:pulse 4s ease-in-out infinite alternate; transform-box:fill-box; transform-origin:center; } @keyframes pulse { to { transform:scale(1.15); } }
      .info { position:absolute; left:0; right:0; bottom:0; display:flex; justify-content:space-between; padding:.5em .8em; font-size:.8em; color:#fff; text-shadow:0 1px 3px rgba(0,0,0,.6); }
      .stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(6em,1fr)); gap:8px; }
      .st { display:flex; flex-direction:column; align-items:center; gap:.15em; padding:.6em .3em; border-radius:1em; background:var(--sp-glass); border:1px solid var(--sp-glass-b);
        -webkit-backdrop-filter:blur(18px) saturate(140%); backdrop-filter:blur(18px) saturate(140%); text-align:center; }
      .st ha-icon { color:var(--sp-acc); } .st b { font-size:1.05em; font-variant-numeric:tabular-nums; } .st span { font-size:.7em; color:var(--sp-muted); }
      .evs { display:flex; flex-direction:column; border-radius:18px; padding:2px 12px; background:var(--sp-glass); border:1px solid var(--sp-glass-b); }
      .ev { display:grid; grid-template-columns:auto 1fr auto auto; align-items:center; gap:.6em; padding:.6em 0; border-top:1px solid var(--sp-glass-b); width:100%; font-size:.88em; }
      .ev:first-child { border-top:0; } .ev ha-icon { color:var(--sp-acc); } .ev .et { font-weight:700; font-variant-numeric:tabular-nums; } .ev small { color:var(--sp-muted); font-weight:500; }
      .ev .ed { color:var(--sp-muted); font-size:.82em; min-width:5.2em; text-align:right; } .ev.next .en { font-weight:700; }
      @container (max-width: 300px) { .ev { grid-template-columns:auto 1fr auto; } .ev .ed { display:none; } }
      @media (prefers-reduced-motion: reduce) { .tw, .halo { animation:none; } }
    </style>
    <ha-card class="${dark ? "dark" : "light"}">
      <div class="hd"><span class="t">${esc(c.title)}</span><span class="ph">${c.mode === "sun" ? "" : `<button class="tg" data-tg="1" title="Afficher la lune"><ha-icon icon="mdi:moon-waning-crescent"></ha-icon></button>`}<ha-icon icon="${pIcon}"></ha-icon>${phase}</span></div>
            <div class="skyw">
        <svg viewBox="0 0 ${W} ${H}" aria-label="Position du soleil">
          ${stars}
          <defs><radialGradient id="g"><stop offset="0" stop-color="${sunFill}" stop-opacity=".75"/><stop offset="1" stop-color="${sunFill}" stop-opacity="0"/></radialGradient>
            <linearGradient id="gr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(0,0,0,.35)"/><stop offset="1" stop-color="rgba(0,0,0,.6)"/></linearGradient></defs>
          ${glow > 0 ? `<ellipse cx="${cx}" cy="${hy}" rx="${rx + 20}" ry="${10 + glow * 16}" fill="${rising ? "#ff9a5a" : "#ff7a4a"}" opacity="${(glow * 0.3).toFixed(2)}"/>` : ""}
          <path d="${archD(ryUp, false)}" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.6" stroke-dasharray="3 5" stroke-linecap="round"/>
          <rect x="0" y="${hy}" width="${W}" height="${H - hy}" fill="url(#gr)"/>
          <path d="${archD(ryDn, true)}" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="1.4" stroke-dasharray="2 5" stroke-linecap="round"/>
          <line x1="0" y1="${hy}" x2="${W}" y2="${hy}" stroke="rgba(255,255,255,.7)" stroke-width="1.4"/>
          <text x="10" y="${hy + 14}" fill="#fff" opacity=".7" font-size="9">E</text><text x="${cx - 3}" y="${hy + 14}" fill="#fff" opacity=".7" font-size="9">S</text><text x="${W - 16}" y="${hy + 14}" fill="#fff" opacity=".7" font-size="9">O</text>
          ${have ? `<circle class="halo" cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="26" fill="url(#g)" opacity="${up ? 1 : 0.5}"/>
          <circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="9" fill="${sunFill}" stroke="#fff" stroke-width="1.6" opacity="${up ? 1 : 0.85}"/>` : ""}
        </svg>
        <div class="info"><span>${esc(dayInfo)}</span><span>${nextEv ? `${esc(nextEv.label)} · ${tf.format(nextEv.d)}` : ""}</span></div>
      </div>

            <div class="stats">
        <button class="st" data-more="${esc(c.azimuth_entity)}"><ha-icon icon="mdi:compass-outline"></ha-icon><b>${have ? a.toFixed(1) + "°" : "—"}</b><span>Azimut</span></button>
        <button class="st" data-more="${esc(c.elevation_entity)}"><ha-icon icon="mdi:angle-acute"></ha-icon><b>${have ? e.toFixed(1) + "°" : "—"}</b><span>Élévation</span></button>
        <button class="st" data-more="${esc(c.rising_entity || c.sun_entity)}"><ha-icon icon="${rising ? "mdi:arrow-up-bold-circle-outline" : "mdi:arrow-down-bold-circle-outline"}"></ha-icon><b>${rising ? "Montant" : "Descendant"}</b><span>Course</span></button>
      </div>

      ${evHtml}
    </ha-card>`;
    const tg = this.shadowRoot.querySelector("[data-tg]");
    if (tg) tg.addEventListener("click", () => { this._force = true; this._sig = ""; this._render(); });
    this.shadowRoot.querySelectorAll("[data-more]").forEach((el) => el.addEventListener("click", () => this._more(el.dataset.more)));
  }
}

const LABELS = { title: "Titre", theme: "Thème", sun_entity: "Entité soleil (sun.sun)", azimuth_entity: "Azimut solaire", elevation_entity: "Élévation solaire",
  rising_entity: "Soleil montant (binary_sensor)", dawn_entity: "Prochaine aube", sunrise_entity: "Prochain lever", noon_entity: "Prochain midi solaire",
  sunset_entity: "Prochain coucher", dusk_entity: "Prochain crépuscule", midnight_entity: "Prochain minuit solaire", show_events: "Afficher la frise des événements", show_stars: "Afficher les étoiles la nuit", mode: "Affichage", moon_position: "Position de la lune", default_view: "Vue par défaut", moon_title: "Titre de la vue lune", moon_style: "Style de la lune", moon_rotate: "Orienter la lune comme dans le ciel", hide_starfield: "Masquer les étoiles", hide_buttons: "Masquer les onglets", latitude: "Latitude (vide = Home Assistant)", longitude: "Longitude (vide = Home Assistant)", southern_hemisphere: "Hémisphère sud" };
const SCHEMA = [
  { type: "grid", name: "", schema: [{ name: "title", selector: { text: {} } },
    { name: "theme", selector: { select: { mode: "dropdown", options: [{ value: "auto", label: "Automatique" }, { value: "light", label: "Clair" }, { value: "dark", label: "Sombre" }] } } }] },
  { type: "grid", name: "", schema: [{ name: "show_events", selector: { boolean: {} } }, { name: "show_stars", selector: { boolean: {} } }] },
  { type: "grid", name: "", schema: [{ name: "mode", selector: { select: { mode: "dropdown", options: [{ value: "sun", label: "Soleil" }, { value: "moon", label: "Lune" }, { value: "both", label: "Les deux (soleil le jour, lune la nuit)" }] } } }, { name: "southern_hemisphere", selector: { boolean: {} } }] },
  { type: "expandable", title: "Options lune", name: "", schema: [
    { type: "grid", name: "", schema: [
      { name: "moon_position", selector: { select: { mode: "dropdown", options: [{ value: "left", label: "Lune à gauche" }, { value: "right", label: "Lune à droite" }] } } },
      { name: "default_view", selector: { select: { mode: "dropdown", options: [{ value: "base", label: "Lune" }, { value: "horizon", label: "Horizon" }, { value: "calendar", label: "Calendrier" }] } } } ] },
    { name: "moon_style", selector: { select: { mode: "dropdown", options: [{ value: "real", label: "Lune réelle (photo)" }, { value: "drawn", label: "Lune dessinée" }] } } },
    { name: "moon_rotate", selector: { boolean: {} } },
    { name: "moon_title", selector: { text: {} } },
    { type: "grid", name: "", schema: [{ name: "hide_starfield", selector: { boolean: {} } }, { name: "hide_buttons", selector: { boolean: {} } }] },
    { type: "grid", name: "", schema: [{ name: "latitude", selector: { number: { mode: "box", step: "any" } } }, { name: "longitude", selector: { number: { mode: "box", step: "any" } } }] } ] },
  { name: "sun_entity", selector: { entity: { domain: "sun" } } },
  { name: "azimuth_entity", selector: { entity: { domain: "sensor" } } },
  { name: "elevation_entity", selector: { entity: { domain: "sensor" } } },
  { name: "rising_entity", selector: { entity: { domain: "binary_sensor" } } },
  { type: "expandable", title: "Événements (capteurs horodatage)", name: "", schema: [
    ...["dawn_entity", "sunrise_entity", "noon_entity", "sunset_entity", "dusk_entity", "midnight_entity"].map((n) => ({ name: n, selector: { entity: { domain: "sensor" } } })) ] },
];

class SunPathCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = { ...DEFAULTS, ...config };
    if (!this._form) this._build(); else this._form.data = this._config;
  }
  set hass(h) { this._hass = h; if (this._form) this._form.hass = h; }
  _build() {
    const f = document.createElement("ha-form");
    f.hass = this._hass; f.data = this._config; f.schema = SCHEMA;
    f.computeLabel = (s) => LABELS[s.name] || s.name;
    f.addEventListener("value-changed", (ev) => {
      ev.stopPropagation(); this._config = { ...ev.detail.value };
      this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this._config }, bubbles: true, composed: true }));
    });
    this._form = f; this.appendChild(f);
  }
}

customElements.define("sun-path-card", SunPathCard);
customElements.define("sun-path-card-editor", SunPathCardEditor);
window.customCards = window.customCards || [];
window.customCards.push({ type: "sun-path-card", name: "Sun Path Card (FR)", description: "Soleil le jour (arc, azimut, élévation, événements), lune la nuit (phase, illumination, prochaines phases).", preview: true });
console.info(`%c SUN-PATH-CARD %c v${CARD_VERSION} `, "color:#fff;background:#d68a00;font-weight:700;border-radius:3px 0 0 3px;padding:2px 4px", "color:#d68a00;background:#fff;font-weight:700;border-radius:0 3px 3px 0;padding:2px 4px");
