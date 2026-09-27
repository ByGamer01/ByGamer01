// Post-processes Platane/snk SVGs so the snake roams the contribution grid without eating it:
// cells keep their colour for the whole loop and the "eaten" progress bar underneath is dropped.
// Usage: node snake-keep-grid.mjs <file.svg>...
// Fails loudly if snk's markup changes, instead of publishing a half-patched image.
import { readFileSync, writeFileSync } from "node:fs";

const BAR_ROWS_PX = 32; // snk reserves 2 extra cell rows (16px each) below the grid for the bar

function keepGrid(svg) {
  let eaten = 0;
  const out = svg
    // .c.c12{fill:var(--c1);animation-name:c12} -> static colour
    .replace(/(\.c\.c\w+\{fill:var\(--c\d\));animation-name:c\w+\}/g, (_, rule) => {
      eaten++;
      return `${rule}}`;
    })
    // @keyframes c12{0.19%{...}0.21%,100%{...}} and the bar's @keyframes u0{...}
    .replace(/@keyframes [cu]\w*\{(?:[^{}]*\{[^{}]*\})*\}/g, "")
    // progress bar rules and rects
    .replace(/\.u(?:\.u\w+)?\{[^}]*\}/g, "")
    .replace(/<rect class="u[^"]*"[^>]*\/>/g, "")
    // crop the space the bar used
    .replace(
      /<svg viewBox="(-?[\d.]+) (-?[\d.]+) ([\d.]+) ([\d.]+)" width="([\d.]+)" height="([\d.]+)"/,
      (_, x, y, w, h, width, height) =>
        `<svg viewBox="${x} ${y} ${w} ${h - BAR_ROWS_PX}" width="${width}" height="${height - BAR_ROWS_PX}"`,
    );

  if (eaten === 0) throw new Error("no eaten-cell rules found: snk markup changed?");
  if (/animation-name:c\w|@keyframes c\w|class="u/.test(out)) {
    throw new Error("leftover eat/bar animation after patching: snk markup changed?");
  }
  return { out, eaten };
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: node snake-keep-grid.mjs <file.svg>...");
  process.exitCode = 1;
} else {
  for (const file of files) {
    const { out, eaten } = keepGrid(readFileSync(file, "utf8"));
    writeFileSync(file, out);
    console.log(`${file}: ${eaten} cells kept`);
  }
}
