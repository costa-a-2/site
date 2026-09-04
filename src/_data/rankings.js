const fs = require("fs");
const path = require("path");
const DATA_DIR = path.join(__dirname, "..", "..", "data");

function loadJSON(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return fallback; }
}
const HEADSHOTS = loadJSON(path.join(DATA_DIR, "headshots.json"), {});

function loadSport(sport) {
  const dir = path.join(DATA_DIR, sport);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith(".json")).sort().map(file => {
    const raw = loadJSON(path.join(dir, file), {});
    const slug = file.replace(/\.json$/, "");
    const isPre = /preseason/.test(slug);
    const weekNum = isPre ? 0 : parseInt((slug.match(/week-(\d+)/) || [])[1] || "0", 10);
    return {
      slug, sport, week: weekNum, isPreseason: isPre,
      label: isPre ? "Preseason" : `Week ${weekNum}`,
      published: raw.published || null,
      updatedAt: raw.updatedAt || null,
      format: raw.format || (sport === "football" ? "Half-PPR" : "9-Cat Roto"),
      players: raw.players || raw
    };
  });
}

/** change vs prior week + up to 6 weeks of rank history for sparklines */
function withMovement(weeks) {
  return weeks.map((wk, i) => {
    const prev = i > 0 ? weeks[i - 1] : null;
    const prevMap = new Map(); if (prev) prev.players.forEach(p => prevMap.set(p.player, p.rank));
    // history window: this week and up to 5 before
    const window = weeks.slice(Math.max(0, i - 5), i + 1);
    const players = wk.players.map(p => {
      const before = prevMap.has(p.player) ? prevMap.get(p.player) : null;
      const history = window.map(w => { const f = w.players.find(x => x.player === p.player); return f ? f.rank : null; });
      const key = p.player.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+(jr|sr|ii|iii|iv)$/, "").trim();
      return { ...p, prevRank: before, change: before === null ? null : before - p.rank, history,
               headshot: p.headshot || HEADSHOTS[key] || null };
    });
    const movers = players.filter(p => typeof p.change === "number" && p.change !== 0)
                          .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
    // tier summary for the cliff bar
    const tierMap = new Map();
    players.forEach(p => {
      const t = tierMap.get(p.tier) || { tier: p.tier, name: p.tierName || `Tier ${p.tier}`, count: 0, ppgSum: 0, ppgN: 0 };
      t.count++; if (typeof p.ppg === "number") { t.ppgSum += p.ppg; t.ppgN++; }
      tierMap.set(p.tier, t);
    });
    const tierSummary = [...tierMap.values()].sort((a, b) => a.tier - b.tier)
      .map(t => ({ ...t, avgPpg: t.ppgN ? +(t.ppgSum / t.ppgN).toFixed(1) : null }));
    // firstEdition: no earlier file exists, so every change is null. Templates show "—" rather than
    // "NEW" (NEW means "not in the prior edition", which needs a prior edition to mean anything).
    return { ...wk, players, tierSummary, firstEdition: prev === null,
      risers: movers.filter(p => p.change > 0).slice(0, 5),
      fallers: movers.filter(p => p.change < 0).slice(0, 5),
      // Watch / Volatile players, in rank order — rendered with their notes under the table
      flags: players.filter(p => p.risk && !/^steady$/i.test(String(p.risk).trim())),
      count: players.length, tiers: [...new Set(players.map(p => p.tier))].length };
  });
}

const football = withMovement(loadSport("football"));
const basketball = withMovement(loadSport("basketball"));
module.exports = { football, basketball,
  latestFootball: football[football.length - 1] || null,
  latestBasketball: basketball[basketball.length - 1] || null };
