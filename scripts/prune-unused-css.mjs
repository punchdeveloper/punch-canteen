/**
 * Second clean-up pass for src/app/styles/v63.css (kept for traceability).
 *
 * Removes selectors that reference a class or id that appears NOWHERE in the
 * rebuilt source (src/**), e.g. the leftover v15–v51 home designs. The token
 * scan is deliberately generous — any word anywhere in a source file counts —
 * so a rule is only dropped when nothing could possibly render it.
 * Rules made only of element selectors (body, h1, nav a…) are always kept.
 * Usage: node scripts/prune-unused-css.mjs
 */
import fs from "node:fs";
import path from "node:path";
import postcss from "postcss";

const CSS = "src/app/styles/v63.css";

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : /\.(tsx|ts|css)$/.test(e.name) && !p.endsWith("v63.css") ? [p] : [];
  });
}

const tokens = new Set();
for (const file of walk("src")) {
  for (const t of fs.readFileSync(file, "utf8").split(/[^\w-]+/)) if (t) tokens.add(t);
}
// Body classes and ids that exist only at runtime.
["staff", "login-view"].forEach((t) => tokens.add(t));

const root = postcss.parse(fs.readFileSync(CSS, "utf8"));
const dropped = [];
root.walkRules((rule) => {
  if (rule.parent.type === "atrule" && /keyframes$/i.test(rule.parent.name)) return;
  const keep = rule.selectors.filter((sel) => [...sel.matchAll(/[.#]([\w-]+)/g)].every((m) => tokens.has(m[1])));
  rule.selectors.filter((s) => !keep.includes(s)).forEach((s) => dropped.push(s));
  if (!keep.length) rule.remove();
  else if (keep.length !== rule.selectors.length) rule.selectors = keep;
});
root.walkAtRules((at) => {
  if (/^(media|supports)$/.test(at.name) && !at.nodes?.length) at.remove();
});
fs.writeFileSync(CSS, root.toString().replace(/\n{3,}/g, "\n\n"));
console.log(`dropped ${dropped.length} selectors; ${fs.statSync(CSS).size} bytes left`);
console.log(dropped.join("  |  "));
