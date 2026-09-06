// Last-commit dates for templates that carry no `updated` front matter (the methodology and Flag Plant
// pages): { "methodology": "2026-09-05T22:09:38-04:00", ... }. Falls back to build time when the file has
// never been committed or git isn't available (a fresh checkout on CI always has git).
const { execSync } = require("child_process");
const path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const FILES = { methodology: "src/methodology.njk", flagPlant: "src/flag-plant.njk" };

function lastCommit(file) {
  try {
    const out = execSync(`git log -1 --format=%cI -- ${JSON.stringify(file)}`, { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    return out || null;
  } catch { return null; }
}

module.exports = () => {
  const now = new Date().toISOString();
  return Object.fromEntries(Object.entries(FILES).map(([k, f]) => [k, lastCommit(f) || now]));
};
