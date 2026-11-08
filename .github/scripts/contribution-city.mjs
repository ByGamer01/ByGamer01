const themes = {
  dark: {
    bg: "#0a1420", border: "#244052", grid: "#173349", text: "#eef8ff", muted: "#a0b9ca",
    accent: "#6af6ce", ground: "#102535", top: "#73ffcf", front: "#259b91", side: "#176879",
  },
  light: {
    bg: "#f3faf9", border: "#b9d9d4", grid: "#c3dfdc", text: "#122c37", muted: "#466570",
    accent: "#066553", ground: "#e0f0ed", top: "#51d8b0", front: "#168a7e", side: "#0b6574",
  },
};

const dateLabel = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });
const date = (day) => new Date(day + "T00:00:00Z");
const number = new Intl.NumberFormat("en-US");
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayMs = 86_400_000;

// Week columns and weekday rows follow GitHub's Sunday-start contribution calendar.
function cellsFor(rows) {
  const first = date(rows[0][0]);
  const origin = first.getTime() - first.getUTCDay() * dayMs;
  return rows.map(([day, count]) => {
    const offset = (date(day).getTime() - origin) / dayMs;
    return { day, count, week: Math.floor(offset / 7), weekday: offset % 7 };
  });
}

const project = (week, weekday, height = 0) => [252 + 9.2 * week - 5.5 * weekday, 194 + 0.94 * week + 5.7 * weekday - height];
const points = (...coords) => coords.map((p) => p.map((n) => n.toFixed(2)).join(",")).join(" ");

export function renderContributionCity(rows, theme) {
  const t = themes[theme];
  const cells = cellsFor(rows);
  const total = cells.reduce((sum, cell) => sum + cell.count, 0);
  const active = cells.filter((cell) => cell.count > 0);
  const peak = Math.max(0, ...active.map((cell) => cell.count));
  const from = dateLabel.format(date(rows[0][0]));
  const to = dateLabel.format(date(rows.at(-1)[0]));

  // Paint back to front; square-root scaling preserves small days without letting peaks fill the card.
  cells.sort((a, b) => a.week * 0.94 + a.weekday * 5.7 - (b.week * 0.94 + b.weekday * 5.7));
  const city = cells.map(({ day, count, week, weekday }) => {
    const tile = (h, w = 0, d = 0) => project(week + w, weekday + d, h);
    const a = tile(0), b = tile(0, .89), c = tile(0, .89, .87), d = tile(0, 0, .87);
    if (!count) return '<polygon fill="' + t.ground + '" points="' + points(a, b, c, d) + '"/>';
    const h = 3 + 112 * Math.sqrt(count / peak);
    const at = tile(h), bt = tile(h, .89), ct = tile(h, .89, .87), dt = tile(h, 0, .87);
    return [
      '<g data-day="' + day + '" data-count="' + count + '" data-week="' + week + '" data-weekday="' + weekday + '">',
      '<title>' + weekdays[weekday] + ', ' + dateLabel.format(date(day)) + ': ' + count + ' contributions</title>',
      '<polygon fill="' + t.side + '" points="' + points(at, dt, d, a) + '"/>',
      '<polygon fill="' + t.front + '" points="' + points(dt, ct, c, d) + '"/>',
      '<polygon fill="' + t.top + '" points="' + points(at, bt, ct, dt) + '"/>',
      '</g>',
    ].join("");
  }).join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="780" height="330" viewBox="0 0 780 330" role="img" aria-labelledby="title desc">
<title id="title">Contribution City</title>
<desc id="desc">${number.format(total)} contributions across ${number.format(active.length)} active days from ${from} to ${to}. Each building represents an active day; taller buildings indicate more contributions.</desc>
<defs>
  <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".8" fill="${t.grid}"/></pattern>
  <clipPath id="frame"><rect x="1" y="1" width="778" height="328" rx="19"/></clipPath>
</defs>
<g clip-path="url(#frame)">
  <rect width="780" height="330" fill="${t.bg}"/>
  <rect x="205" width="575" height="330" fill="url(#grid)"/>
  <path d="M28 285.5H752" stroke="${t.border}"/>
  ${city}
</g>
<rect x=".5" y=".5" width="779" height="329" rx="19" fill="none" stroke="${t.border}"/>
<g font-family="ui-monospace, Consolas, monospace" font-size="12" fill="${t.muted}">
  <text x="28" y="33" fill="${t.accent}" font-weight="700" letter-spacing="1.4">GITHUB / CONTRIBUTION CITY</text>
  <text x="752" y="33" text-anchor="end">ROLLING 365 DAYS</text>
  <text x="28" y="138">contributions</text>
  <text x="28" y="185"><tspan fill="${t.text}" font-weight="700">${number.format(active.length)}</tspan> active days</text>
  <text x="28" y="208"><tspan fill="${t.text}" font-weight="700">${number.format(peak)}</tspan> busiest day</text>
  <text x="28" y="311">${from} – ${to}</text>
  <text x="752" y="311" text-anchor="end">HEIGHT = DAILY ACTIVITY</text>
</g>
<text x="27" y="114" font-family="system-ui, sans-serif" font-size="47" font-weight="750" fill="${t.text}">${number.format(total)}</text>
</svg>
`;
}
