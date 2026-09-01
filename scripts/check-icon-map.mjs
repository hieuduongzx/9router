#!/usr/bin/env node
/**
 * Report every icon name referenced in src/ that the <Icon /> map doesn't cover.
 *
 * An unmapped name renders nothing, which is a silent failure — this makes it a
 * loud one. Run after touching icon call sites or ICON_MAP.
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const mapSource = readFileSync("src/shared/components/ui/icon.js", "utf8");
const mapBody = mapSource.slice(
  mapSource.indexOf("const ICON_MAP = {"),
  mapSource.indexOf("/** Names that should spin"),
);
const mapped = new Set([...mapBody.matchAll(/^\s{2}([a-z0-9_]+):/gm)].map((m) => m[1]));

const files = execFileSync("rg", ["-l", "", "src", "-g", "*.js"], { encoding: "utf8" })
  .split("\n")
  .map((s) => s.trim())
  .filter(Boolean);

// Names reaching <Icon />: the direct `name="x"` form, an expression form
// (`name={cond ? "a" : "b"}`), and the `icon:` / `icon=` props that feed one.
// `icon="icon"` is excluded — that literal only appears in Icon's own
// pass-through wrappers, not as a glyph name.
const LITERAL_PATTERNS = [
  /<Icon[^/>]*\bname="([a-z0-9_]+)"/g,
  /\bicon:\s*"([a-z0-9_]+)"/g,
  /\bicon="([a-z0-9_]+)"/g,
  /\biconRight="([a-z0-9_]+)"/g,
];

const EXPRESSION_PATTERN = /<Icon[^/>]*\bname=\{([^}]*)\}/g;

const IGNORE = new Set(["icon"]);

/**
 * Collect the glyph names an `<Icon name={...}>` expression can resolve to.
 *
 * Only strings in a *result* position count. A ternary's condition often
 * compares against an unrelated string (`copied === "trace" ? …`), and treating
 * that as a glyph name is what produced false positives here.
 */
function namesFromExpression(expr) {
  const out = [];
  const whole = expr.trim().match(/^"([a-z0-9_]+)"$/);
  if (whole) return [whole[1]];
  for (const match of expr.matchAll(/[?:]\s*"([a-z0-9_]+)"/g)) out.push(match[1]);
  return out;
}

const missing = new Map();

function record(name, file) {
  if (mapped.has(name) || IGNORE.has(name)) return;
  if (!missing.has(name)) missing.set(name, new Set());
  missing.get(name).add(file);
}

for (const file of files) {
  if (/ui[\\/]icon\.js$/.test(file)) continue;
  const src = readFileSync(file, "utf8");
  for (const pattern of LITERAL_PATTERNS) {
    for (const match of src.matchAll(pattern)) record(match[1], file);
  }
  for (const match of src.matchAll(EXPRESSION_PATTERN)) {
    for (const name of namesFromExpression(match[1])) record(name, file);
  }
}

if (missing.size === 0) {
  console.log(`all icon names resolve (${mapped.size} mapped)`);
  process.exit(0);
}

console.log(`unmapped icon names (${missing.size}):`);
for (const [name, where] of [...missing].sort()) {
  console.log(`  ${name}  <- ${[...where].slice(0, 3).join(", ")}${where.size > 3 ? ` +${where.size - 3}` : ""}`);
}
process.exitCode = 1;
