const fs = require("fs");
const path = require("path");

const bad = [
  "hasRouter2k",
  "sk_Router2k",
  "decolua/Router2k",
  "npx Router2k",
  "~/.Router2k",
  "package/Router2k",
  'NPM_PACKAGE_NAME = "Router2k"',
  'APP_NAME = "Router2k"',
  "npm i -g Router2k",
  "custom:Router2k",
];

function walk(d, acc = []) {
  try {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name === ".git" || e.name === ".next") continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p, acc);
      else if (/\.(js|jsx|css|svg|json|md)$/.test(e.name)) acc.push(p);
    }
  } catch {}
  return acc;
}

const files = walk("src").concat(walk("public"));
const hits = {};
for (const f of files) {
  const c = fs.readFileSync(f, "utf8");
  for (const b of bad) {
    if (c.includes(b)) {
      (hits[b] ||= []).push(f);
    }
  }
}
console.log(JSON.stringify(hits, null, 2));

// Count remaining 9Router brand in UI paths
let brandLeft = 0;
for (const f of files) {
  if (!f.includes(`${path.sep}app${path.sep}`) && !f.includes(`${path.sep}shared${path.sep}`)) continue;
  const c = fs.readFileSync(f, "utf8");
  const m = c.match(/9Router/g);
  if (m) {
    brandLeft += m.length;
    console.log("still 9Router:", f, m.length);
  }
}
console.log("remaining 9Router count:", brandLeft);
