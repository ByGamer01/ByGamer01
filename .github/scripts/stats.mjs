#!/usr/bin/env node
// Renders the "GitHub activity" cards of the profile README from the contributions calendar.
//
// Zero dependencies, Node 20+ (global fetch). Environment:
//   GITHUB_TOKEN  required. Any token that can read public user data; the Actions GITHUB_TOKEN works.
//   STATS_USER    login to render (default: ByGamer01)
//   OUT_DIR       output directory (default: ./stats-out)
//   PREV_SVG      optional path to the previously published activity SVG (baseline for the drop check).
//                 A missing file means "first run"; a file without readable metadata is an error.
//   ALLOW_DROP    "true" to publish even if the totals dropped versus PREV_SVG, the baseline is
//                 unreadable, or the API reports no private contributions
//   STATS_TODAY   optional YYYY-MM-DD override of "today" (reproducible test runs)
//
// "Today" is the last day of the API's default calendar, i.e. the day in the time zone the API
// uses for this token (the owner's zone for a personal token, most likely UTC for the Actions
// token). The day boundaries of the data follow that same zone, so the two always agree.
//
// Output: activity-{light,dark}.svg and monthly-{light,dark}.svg.
// Same data and same "today" always produce byte-identical files.
// On an API failure or implausible data it exits non-zero BEFORE writing anything,
// so the cards published by the previous run stay live.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const LOGIN = process.env.STATS_USER || "ByGamer01";
const OUT_DIR = resolve(process.env.OUT_DIR || "stats-out");
const MAX_DROP = 0.1; // all-time total may shrink at most 10% versus the previous run
const DAY_MS = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

class DataError extends Error {}
const fail = (message) => {
  throw new DataError(message);
};

// ---------------------------------------------------------------------------
// Dates (YYYY-MM-DD strings, arithmetic in UTC so DST never shifts a day)

const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
const ymd = (day) => ({ y: +day.slice(0, 4), m: +day.slice(5, 7), d: +day.slice(8, 10) });
const fmtDay = (day) => `${MONTHS[ymd(day).m - 1]} ${ymd(day).d}`;
const fmtDate = (day) => `${fmtDay(day)}, ${ymd(day).y}`;
const fmtMonth = (y, m) => `${MONTHS[m - 1]} ${y}`;
const fmtInt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const count = (n, word) => `${fmtInt(n)} ${word}${n === 1 ? "" : "s"}`;
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);

// ---------------------------------------------------------------------------
// GitHub GraphQL. Errors arrive as HTTP 200 with an "errors" array, so both are checked.

async function graphql(query, variables) {
  let lastProblem = "";
  for (const waitMs of [0, 5_000, 15_000]) {
    if (waitMs) await new Promise((r) => setTimeout(r, waitMs));
    let res;
    try {
      res = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers: {
          Authorization: `bearer ${process.env.GITHUB_TOKEN}`,
          "Content-Type": "application/json",
          "User-Agent": "profile-stats",
        },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (err) {
      lastProblem = `network error: ${err.message}`;
      continue; // retry
    }
    if (res.status >= 500) {
      lastProblem = `HTTP ${res.status}`;
      continue; // retry
    }
    const body = await res.json().catch(() => null);
    if (!res.ok || !body || body.errors?.length || !body.data?.user) {
      fail(`GraphQL request failed: HTTP ${res.status} ${JSON.stringify(body?.errors ?? body?.message ?? null)}`);
    }
    return body.data.user;
  }
  fail(`GraphQL request failed after 3 attempts: ${lastProblem}`);
}

const calendarDays = (collection) =>
  (collection?.contributionCalendar?.weeks ?? []).flatMap((week) => week?.contributionDays ?? []);

// "Today" for this token: the last day of the default calendar (its days end today, in the
// API's time zone for the viewer). It must be within a day of the UTC date.
function viewerToday(collection) {
  const last = calendarDays(collection).at(-1)?.date ?? "";
  const utcToday = new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(last) || Math.abs(daysBetween(utcToday, last)) > 1) {
    fail(`implausible current day from the API: ${JSON.stringify(last)} (UTC date ${utcToday})`);
  }
  return last;
}

// Half-year calendars (Jan 1-Jun 30, Jul 1-Dec 31). The API returns at most 53 weeks: a full year
// that spans 54 weeks (e.g. 2028) silently loses its first days while totalContributions still
// counts them, so a whole-year range is not safe. Every chunk is checked for exactly the days
// from..to and for a day sum equal to its totalContributions, so any truncation fails loudly.
async function fetchContributions(login, todayOverride) {
  const head = await graphql(
    `query($login: String!) { user(login: $login) {
      createdAt
      current: contributionsCollection { startedAt contributionCalendar { weeks { contributionDays { date } } } }
    } }`,
    { login },
  );
  const { createdAt } = head;
  if (!/^\d{4}-\d{2}-\d{2}T/.test(createdAt ?? "")) fail(`unexpected createdAt: ${JSON.stringify(createdAt)}`);
  const today = todayOverride || viewerToday(head.current);
  const createdDay = createdAt.slice(0, 10);

  const chunks = [];
  for (let y = +createdAt.slice(0, 4); y <= ymd(today).y; y++) {
    for (const [half, from, to] of [[1, `${y}-01-01`, `${y}-06-30`], [2, `${y}-07-01`, `${y}-12-31`]]) {
      if (to >= createdDay && from <= today) chunks.push({ key: `c${y}h${half}`, y, from, to });
    }
  }
  const fields = chunks
    .map(
      ({ key, from, to }) => `${key}: contributionsCollection(from: "${from}T00:00:00Z", to: "${to}T23:59:59Z") {
        restrictedContributionsCount
        contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } }
      }`,
    )
    .join("\n");
  const user = await graphql(`query($login: String!) { user(login: $login) { ${fields} } }`, { login });

  const days = new Map();
  const restrictedByYear = {};
  for (const { key, y, from, to } of chunks) {
    const collection = user[key];
    const total = collection?.contributionCalendar?.totalContributions;
    const restricted = collection?.restrictedContributionsCount;
    if (!Array.isArray(collection?.contributionCalendar?.weeks) || !Number.isInteger(total) || !Number.isInteger(restricted)) {
      fail(`calendar ${from}..${to} is missing or malformed`);
    }
    const list = calendarDays(collection);
    let sum = 0;
    for (const { date, contributionCount } of list) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(contributionCount) || contributionCount < 0) {
        fail(`invalid calendar day ${JSON.stringify({ date, contributionCount })}`);
      }
      if (date < from || date > to || days.has(date)) fail(`unexpected day ${date} in calendar ${from}..${to}`);
      days.set(date, contributionCount);
      sum += contributionCount;
    }
    const first = list[0]?.date;
    const last = list.at(-1)?.date;
    if (first !== from || last !== to || list.length !== daysBetween(from, to) + 1) {
      fail(`calendar ${from}..${to} is incomplete: ${list.length} days, ${first}..${last}`);
    }
    if (sum !== total) fail(`calendar ${from}..${to}: day sum ${sum} differs from totalContributions ${total}`);
    restrictedByYear[y] = (restrictedByYear[y] ?? 0) + restricted;
  }
  return { createdAt, today, calendarStartedAt: head.current?.startedAt ?? null, days, restrictedByYear };
}

// ---------------------------------------------------------------------------
// Metrics (pure)

function computeStats({ createdAt, days, restrictedByYear }, today) {
  const createdDay = createdAt.slice(0, 10);
  if (createdDay > today) fail(`account creation date ${createdDay} is after today ${today}`);

  // Every day from account creation to today must be present (the calendars run to the end of
  // each half-year, future days included with 0).
  const series = [];
  for (let day = createdDay; day <= today; day = addDays(day, 1)) {
    const c = days.get(day);
    if (c === undefined) fail(`calendar has no entry for ${day}`);
    series.push([day, c]);
  }

  const windowStart = [createdDay, addDays(today, -364)].sort().at(-1);
  const window = series.filter(([day]) => day >= windowStart);
  const accountIsOlderThanWindow = createdDay <= addDays(today, -364);
  if (accountIsOlderThanWindow && window.length < 360) fail(`only ${window.length} days in the last-365-days window`);

  const sum = (rows) => rows.reduce((s, [, c]) => s + c, 0);
  const active = (rows) => rows.filter(([, c]) => c > 0).length;

  // Longest streak over the whole history (first one wins a tie).
  let run = null;
  let longest = { len: 0, start: null, end: null };
  for (const [day, c] of series) {
    run = c > 0 ? { len: (run?.len ?? 0) + 1, start: run?.start ?? day, end: day } : null;
    if (run && run.len > longest.len) longest = { ...run };
  }

  // Current streak: a day without contributions breaks it, except today (the day is not over).
  let i = series.at(-1)[1] > 0 ? series.length - 1 : series.length - 2;
  const current = { len: 0, start: null, end: i >= 0 ? series[i][0] : null };
  for (; i >= 0 && series[i][1] > 0; i--) {
    current.len++;
    current.start = series[i][0];
  }
  const lastActive = [...series].reverse().find(([, c]) => c > 0)?.[0] ?? null;

  // 12 calendar months ending with the current (partial) month.
  const { y: ty, m: tm } = ymd(today);
  const months = [];
  for (let k = 11; k >= 0; k--) {
    let y = ty;
    let m = tm - k;
    while (m < 1) {
      m += 12;
      y--;
    }
    months.push({ y, m, key: `${y}-${String(m).padStart(2, "0")}`, total: 0 });
  }
  const monthIndex = new Map(months.map((mo, idx) => [mo.key, idx]));
  for (const [day, c] of series) {
    const idx = monthIndex.get(day.slice(0, 7));
    if (idx !== undefined) months[idx].total += c;
  }

  return {
    login: LOGIN,
    today,
    createdDay,
    includesPrivate: Object.values(restrictedByYear).some((n) => n > 0),
    restrictedByYear,
    last365: { from: windowStart, to: today, total: sum(window), activeDays: active(window), days: window.length },
    allTime: { total: sum(series), activeDays: active(series), days: series.length },
    current: { ...current, lastActive },
    longest,
    months,
  };
}

const OVERRIDE = "Re-run with allow_drop to publish anyway.";

// Absolute checks always run, so a first run (no baseline) cannot publish a near-empty card either.
function validate(stats, prev, allowDrop) {
  if (stats.last365.total <= 0) fail("0 contributions in the last 365 days; refusing to publish an empty card");
  if (stats.allTime.total <= 0 || stats.longest.len <= 0) fail("no contributions at all; refusing to publish");
  if (stats.last365.total > stats.allTime.total) fail("last-365-days total exceeds the all-time total");
  const problems = [];
  if (!stats.includesPrivate) {
    problems.push("the API reports no private contributions (was 'Include private contributions on my profile' switched off?)");
  }
  if (prev) {
    const drops = [];
    if (stats.allTime.total < prev.allTime * (1 - MAX_DROP)) drops.push(`all-time total ${prev.allTime} -> ${stats.allTime.total}`);
    if (stats.longest.len < prev.longestStreak) drops.push(`longest streak ${prev.longestStreak} -> ${stats.longest.len}`);
    if (drops.length) problems.push(`implausible drop versus the previous run: ${drops.join("; ")}`);
  }
  if (!problems.length) return;
  if (!allowDrop) fail(`${problems.join("; ")}. ${OVERRIDE}`);
  console.warn(`::warning::publishing anyway (ALLOW_DROP): ${problems.join("; ")}`);
}

// The previous run's numbers live in the published SVG's <metadata>, so the stats branch
// needs no extra data file. No file = first run. A file without a readable baseline is an
// error: silently skipping the drop check would let a bad card become the next baseline.
function readPrevious(path, allowDrop) {
  if (!path || !existsSync(path)) return null;
  const match = readFileSync(path, "utf8").match(/<metadata id="stats-data">([^<]*)<\/metadata>/);
  try {
    const prev = JSON.parse(unescapeXml(match?.[1] ?? ""));
    if (Number.isInteger(prev.allTime) && Number.isInteger(prev.longestStreak)) return prev;
  } catch {
    // fall through
  }
  if (!allowDrop) fail(`no readable baseline in ${path}. ${OVERRIDE}`);
  console.warn(`::warning::no readable baseline in ${path}; skipping the drop check (ALLOW_DROP)`);
  return null;
}

// ---------------------------------------------------------------------------
// Rendering (pure)

const THEMES = {
  light: { bg: "#ffffff", border: "#d1d9e0", fg: "#1f2328", muted: "#59636e", accent: "#8A3FFC" },
  dark: { bg: "#0d1117", border: "#3d444d", fg: "#f0f6fc", muted: "#9198a1", accent: "#A371F7" },
};
const W = 380; // card width (viewBox units)
const H = 276; // viewBox height: 264 card + 12 transparent gap so stacked cards never touch
const CARD_H = 264;
const PAD = 20;
const X0 = PAD;
const X1 = W - PAD;
const FONT = `-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",Helvetica,Arial,sans-serif`;

// Arial/Helvetica advance widths (1/1000 em) for ASCII 32..126. Arial runs wider than
// Segoe UI and about as wide as SF, so it is a safe upper estimate for the fit checks.
// prettier-ignore
const ASCII_WIDTHS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, // space ! " # $ % & ' ( ) * + , - . /
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, // 0-9 : ; < = > ?
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, // @ A-O
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, // P-Z [ \ ] ^ _
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, // ` a-o
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584, // p-z { | } ~
];
const OTHER_WIDTHS = { "–": 556, "·": 333 };
function textWidth(text, size, bold = false) {
  let units = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0);
    units += code >= 32 && code <= 126 ? ASCII_WIDTHS[code - 32] : (OTHER_WIDTHS[ch] ?? 600);
  }
  return (units / 1000) * size * (bold ? 1.1 : 1) * 1.03;
}

const escapeXml = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/[^\x20-\x7e\n]/gu, (ch) => `&#x${ch.codePointAt(0).toString(16).toUpperCase()};`);
const unescapeXml = (s) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
const n = (v) => String(Math.round(v * 100) / 100);

function card({ theme, id, title, desc, body, metadata }) {
  const t = THEMES[theme];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${id}-t ${id}-d">
<title id="${id}-t">${escapeXml(title)}</title>
<desc id="${id}-d">${escapeXml(desc)}</desc>${metadata ? `\n<metadata id="stats-data">${escapeXml(JSON.stringify(metadata))}</metadata>` : ""}
<style>
text{font-family:${FONT}}
.bg{fill:${t.bg};stroke:${t.border};stroke-width:1}
.h{font-size:14px;font-weight:600;fill:${t.fg}}
.meta,.foot,.tick,.end{font-size:13px;font-weight:400;fill:${t.muted}}
.peak{font-size:13px;font-weight:600;fill:${t.fg}}
.hero{font-size:40px;font-weight:600;fill:${t.fg}}
.cap,.lbl{font-size:14px;font-weight:400;fill:${t.muted}}
.val{font-size:14px;font-weight:600;fill:${t.fg}}
.det{font-weight:400;fill:${t.muted}}
.rule{stroke:${t.border};stroke-width:1}
.bar{fill:${t.accent}}
.bar-partial{fill:${t.bg};stroke:${t.accent};stroke-width:1.5}
</style>
<rect class="bg" x="0.5" y="0.5" width="${W - 1}" height="${CARD_H - 1}" rx="6"/>
${body}
</svg>
`;
}

// A label on the left and a right-aligned "value · detail"; the first detail that fits wins.
function valueRow(top, label, value, details) {
  const budget = X1 - X0 - textWidth(label, 14) - 16;
  const detail = details.find((d) => !d || textWidth(value, 14, true) + textWidth(d, 14) <= budget) ?? "";
  const y = top + 21;
  return {
    detail,
    svg: `<line class="rule" x1="${X0}" y1="${n(top + 0.5)}" x2="${X1}" y2="${n(top + 0.5)}"/>
<text class="lbl" x="${X0}" y="${y}">${escapeXml(label)}</text>
<text class="val" x="${X1}" y="${y}" text-anchor="end">${escapeXml(value)}${detail ? `<tspan class="det">${escapeXml(detail)}</tspan>` : ""}</text>`,
  };
}

function renderActivity(stats, theme) {
  const { today, current, longest, last365 } = stats;
  const sameYearAsToday = (day) => ymd(day).y === ymd(today).y;

  const currentDetails = current.len
    ? [` · since ${sameYearAsToday(current.start) ? fmtDay(current.start) : fmtDate(current.start)}`, ""]
    : current.lastActive
      ? [` · last active ${fmtDate(current.lastActive)}`, ` · last active ${fmtDay(current.lastActive)}`, ""]
      : [""];

  const s = ymd(longest.start);
  const e = ymd(longest.end);
  const longestDetails = [
    longest.len === 1
      ? ` · ${fmtDate(longest.start)}`
      : s.y === e.y
        ? ` · ${fmtDay(longest.start)} – ${fmtDay(longest.end)}, ${e.y}`
        : ` · ${fmtDate(longest.start)} – ${fmtDate(longest.end)}`,
    s.y === e.y && s.m === e.m
      ? ` · ${fmtMonth(s.y, s.m)}`
      : ` · ${fmtMonth(s.y, s.m)} – ${fmtMonth(e.y, e.m)}`,
    "",
  ];

  const rows = [
    valueRow(126, "Current streak", count(current.len, "day"), currentDetails),
    valueRow(158, "Longest streak", count(longest.len, "day"), longestDetails),
    valueRow(190, "Active days", fmtInt(last365.activeDays), [` of the last ${fmtInt(last365.days)}`, ` of ${fmtInt(last365.days)}`]),
  ];

  const updated = `Updated ${fmtDate(today)}`;
  const footer = stats.includesPrivate
    ? [`${updated} · includes private contributions`, `${updated} · incl. private contributions`].find(
        (f) => textWidth(f, 13) <= X1 - X0,
      ) ?? updated
    : updated;

  const body = `<text class="h" x="${X0}" y="36">Contributions</text>
<text class="meta" x="${X1}" y="36" text-anchor="end">Member since ${fmtMonth(ymd(stats.createdDay).y, ymd(stats.createdDay).m)}</text>
<text class="hero" x="${X0}" y="88">${fmtInt(stats.allTime.total)}</text>
<text class="cap" x="${X0}" y="110">since joining GitHub</text>
${rows.map((r) => r.svg).join("\n")}
<text class="foot" x="${X0}" y="244">${escapeXml(footer)}</text>`;

  const currentText = current.len
    ? `Current streak: ${count(current.len, "day")}, since ${fmtDate(current.start)}.`
    : `Current streak: 0 days${current.lastActive ? `, last active ${fmtDate(current.lastActive)}` : ""}.`;
  const desc = [
    `${fmtInt(stats.allTime.total)} contributions since joining GitHub in ${fmtMonth(ymd(stats.createdDay).y, ymd(stats.createdDay).m)}${stats.includesPrivate ? ", including private contributions" : ""}.`,
    currentText,
    `Longest streak: ${count(longest.len, "day")}, ${longest.len === 1 ? fmtDate(longest.start) : `${fmtDate(longest.start)} to ${fmtDate(longest.end)}`}.`,
    `Active on ${fmtInt(last365.activeDays)} of the last ${fmtInt(last365.days)} days.`,
    `Updated ${fmtDate(today)}.`,
  ].join(" ");

  return card({
    theme,
    id: "act",
    title: `GitHub contributions of ${stats.login}`,
    desc,
    body,
    metadata: { schema: 1, login: stats.login, date: today, allTime: stats.allTime.total, longestStreak: longest.len },
  });
}

function renderMonthly(stats, theme) {
  const { months } = stats;
  const band = (X1 - X0) / months.length;
  const barW = 16;
  const base = 196;
  const plotH = 120;
  const max = Math.max(...months.map((m) => m.total));
  const peakIdx = max > 0 ? months.findIndex((m) => m.total === max) : -1;
  const lastIdx = months.length - 1;

  const bars = months.map((m, idx) => {
    const cx = X0 + band * (idx + 0.5);
    const x = cx - barW / 2;
    const h = m.total > 0 ? Math.max(2, Math.round((m.total / max) * plotH)) : 0;
    return { ...m, idx, cx, x, h, top: base - h };
  });

  let svg = `<line class="rule" x1="${X0}" y1="${base + 0.5}" x2="${X1}" y2="${base + 0.5}"/>`;
  let outlined = false;
  for (const b of bars) {
    if (!b.h) continue;
    if (b.idx === lastIdx && b.h >= 6) {
      // Month to date: outlined, inset by half the stroke so it keeps the solid bars' footprint.
      outlined = true;
      const ix = b.x + 0.75;
      const iw = barW - 1.5;
      const it = b.top + 0.75;
      const r = 3.25;
      svg += `\n<path class="bar-partial" d="M${n(ix)} ${base}V${n(it + r)}A${r} ${r} 0 0 1 ${n(ix + r)} ${n(it)}H${n(ix + iw - r)}A${r} ${r} 0 0 1 ${n(ix + iw)} ${n(it + r)}V${base}"/>`;
    } else {
      const r = Math.min(4, b.h, barW / 2);
      svg += `\n<path class="bar" d="M${n(b.x)} ${base}V${n(b.top + r)}A${r} ${r} 0 0 1 ${n(b.x + r)} ${n(b.top)}H${n(b.x + barW - r)}A${r} ${r} 0 0 1 ${n(b.x + barW)} ${n(b.top + r)}V${base}Z"/>`;
    }
  }

  // Value labels: the peak month always; the current month unless it would collide.
  const label = (b, cls) => {
    const text = fmtInt(b.total);
    const w = textWidth(text, 13, cls === "peak");
    const x = Math.min(Math.max(b.cx, X0 + w / 2), X1 - w / 2);
    const y = b.top - 6;
    return { text, cls, x, y, box: { l: x - w / 2, r: x + w / 2, t: y - 10, b: y + 3 } };
  };
  const overlaps = (a, c) => a.l < c.r && c.l < a.r && a.t < c.b && c.t < a.b;
  const labels = [];
  if (peakIdx >= 0) labels.push(label(bars[peakIdx], "peak"));
  if (peakIdx !== lastIdx && bars[lastIdx].h) {
    const cur = label(bars[lastIdx], "end");
    const hitsBar = bars.some((b) => b.idx !== lastIdx && b.h && overlaps(cur.box, { l: b.x, r: b.x + barW, t: b.top, b: base }));
    const hitsLabel = labels.some((l) => overlaps(cur.box, l.box) || (Math.abs(cur.y - l.y) < 16 && cur.box.l < l.box.r && l.box.l < cur.box.r));
    if (!hitsBar && !hitsLabel) labels.push(cur);
  }
  for (const l of labels) svg += `\n<text class="${l.cls}" x="${n(l.x)}" y="${n(l.y)}" text-anchor="middle">${l.text}</text>`;
  for (const b of bars) svg += `\n<text class="tick" x="${n(b.cx)}" y="216" text-anchor="middle">${MONTHS[b.m - 1]}</text>`;

  const first = months[0];
  const last = months[lastIdx];
  const lastName = fmtMonth(last.y, last.m);
  const body = `<text class="h" x="${X0}" y="36">Monthly contributions</text>
<text class="meta" x="${X1}" y="36" text-anchor="end">${escapeXml(`${fmtMonth(first.y, first.m)} – ${lastName}`)}</text>
${svg}
<text class="foot" x="${X0}" y="244">${outlined ? `Outlined bar: ${lastName}, month to date` : `${lastName}: month to date`}</text>`;

  const desc =
    `Contributions per calendar month, ${fmtMonth(first.y, first.m)} to ${lastName} (${lastName} month to date): ` +
    months.map((m) => `${MONTHS[m.m - 1]} ${fmtInt(m.total)}`).join(", ") +
    ".";
  return card({ theme, id: "mon", title: `Monthly GitHub contributions of ${stats.login}`, desc, body });
}

// ---------------------------------------------------------------------------

async function main() {
  const [major] = process.versions.node.split(".").map(Number);
  if (major < 20) fail(`Node 20+ required, found ${process.versions.node}`);
  if (!process.env.GITHUB_TOKEN) fail("GITHUB_TOKEN is not set");
  const override = process.env.STATS_TODAY || "";
  if (override && (!/^\d{4}-\d{2}-\d{2}$/.test(override) || addDays(override, 0) !== override)) {
    fail(`invalid STATS_TODAY: ${override}`);
  }
  const allowDrop = process.env.ALLOW_DROP === "true";

  const raw = await fetchContributions(LOGIN, override);
  const { today } = raw;
  const stats = computeStats(raw, today);
  validate(stats, readPrevious(process.env.PREV_SVG, allowDrop), allowDrop);

  // Render everything first, write only when all four files exist in memory.
  const files = {};
  for (const theme of Object.keys(THEMES)) {
    files[`activity-${theme}.svg`] = renderActivity(stats, theme);
    files[`monthly-${theme}.svg`] = renderMonthly(stats, theme);
  }
  mkdirSync(OUT_DIR, { recursive: true });
  for (const [name, svg] of Object.entries(files)) writeFileSync(join(OUT_DIR, name), svg);

  // Non-sensitive summary for the job log.
  console.log(
    JSON.stringify({
      login: stats.login,
      today,
      calendarStartedAt: raw.calendarStartedAt, // time of day = the API's day boundary for this token
      includesPrivate: stats.includesPrivate,
      restrictedByYear: stats.restrictedByYear,
      last365: stats.last365,
      allTime: stats.allTime,
      currentStreak: { len: stats.current.len, start: stats.current.start, lastActive: stats.current.lastActive },
      longestStreak: stats.longest,
      months: Object.fromEntries(stats.months.map((m) => [m.key, m.total])),
      files: Object.keys(files),
      outDir: OUT_DIR,
    }),
  );
}

main().catch((err) => {
  console.error(`::error::${err instanceof DataError ? err.message : err.stack}`);
  process.exitCode = 1; // not process.exit(): let open fetch sockets close cleanly first
});
