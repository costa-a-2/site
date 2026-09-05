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
    const season = parseInt(slug.slice(0, 4), 10) || null;
    const pathPart = isPre ? "preseason" : `week-${String(weekNum).padStart(2, "0")}`;
    return {
      slug, sport, week: weekNum, isPreseason: isPre, season,
      label: isPre ? "Preseason" : `Week ${weekNum}`,
      // the edition's permanent page; /rankings/ always shows the latest one
      url: `/rankings/${season}/${pathPart}/`,
      seoTitle: isPre ? `${season} Preseason Fantasy Football Rankings — Rest of Season`
                      : `Week ${weekNum} Fantasy Football Rest-of-Season Rankings (${season})`,
      published: raw.published || null,
      updatedAt: raw.updatedAt || null,
      format: raw.format || (sport === "football" ? "Half-PPR" : "9-Cat Roto"),
      players: raw.players || raw,
      // on the cusp: the ten under the cusp divider on the board — no rank, no change, no order
      cusp: Array.isArray(raw.cusp) ? raw.cusp : [],
      firstEditionFlag: raw.firstEdition === true,
      // signals: where a metric and the market agree or disagree with the model (rankings_to_json.py)
      signals: Array.isArray(raw.signals) ? raw.signals : [],
      signalsMeta: raw.signalsMeta || null
    };
  });
}

const keyOf = name => String(name || "").toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+(jr|sr|ii|iii|iv)$/, "").trim();

// the four signal groups in order, labels from the file's signalsMeta when it carries them
const SIGNAL_GROUPS = [["backs-over", "Metric backs model over market"], ["backs-under", "Metric backs model under market"],
                       ["disagree", "Metric and shares disagree"], ["share-only", "Share-driven gap, no metric"]];
function groupSignals(wk, players) {
  const labels = new Map(SIGNAL_GROUPS);
  ((wk.signalsMeta && wk.signalsMeta.groups) || []).forEach(g => { if (g && g.id && g.label) labels.set(g.id, g.label); });
  const byName = new Map(players.map(p => [p.player, p]));
  const signals = (wk.signals || []).filter(s => s && s.player).map(s => {
    const p = byName.get(s.player) || null;
    if (p) labels.has(s.group) || labels.set(s.group, s.group);
    return { ...s, onPage: !!p, finalRank: (typeof s.finalRank === "number") ? s.finalRank : (p ? p.rank : null),
             headshot: (p && p.headshot) || HEADSHOTS[keyOf(s.player)] || null };
  });
  return [...labels.keys()].map(id => ({ id, label: labels.get(id),
    items: signals.filter(s => s.group === id).sort((a, b) => Math.abs(b.gap || 0) - Math.abs(a.gap || 0)) }))
    .filter(g => g.items.length);
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
      return { ...p, prevRank: before, change: before === null ? null : before - p.rank, history,
               headshot: p.headshot || HEADSHOTS[keyOf(p.player)] || null };
    });
    const signalGroups = groupSignals(wk, players);
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
    const cusp = (wk.cusp || []).filter(c => c && c.player).map(c => ({ ...c, headshot: c.headshot || HEADSHOTS[keyOf(c.player)] || null }));
    // fell off the board: on the previous edition, not on this one (empty on the first edition)
    const onBoard = new Set(players.map(p => p.player));
    const fellOff = prev ? prev.players.filter(p => !onBoard.has(p.player))
      .map(p => ({ player: p.player, pos: p.pos, team: p.team, prevRank: p.rank, headshot: p.headshot || HEADSHOTS[keyOf(p.player)] || null }))
      .sort((a, b) => a.prevRank - b.prevRank) : [];
    // OTS is 0 for everyone preseason; the column hides until a real trend exists (Week 3+)
    const hasOts = players.some(p => typeof p.ots === "number" && p.ots !== 0);
    const seoDescription = wk.isPreseason
      ? `Half-PPR ${wk.season} preseason fantasy football rankings: the top ${players.length} players for the rest of the season, tiered at value cliffs, with movement from last week shown once the season starts.`
      : `Half-PPR rest-of-season fantasy football rankings for Week ${wk.week}, ${wk.season}: the top ${players.length} players, tiered at value cliffs, with movement from last week shown.`;
    return { ...wk, players, tierSummary, cusp, fellOff, hasOts, seoDescription, prevLabel: prev ? prev.label : null,
      isLatest: i === weeks.length - 1, firstEdition: prev === null || wk.firstEditionFlag,
      risers: movers.filter(p => p.change > 0).slice(0, 5),
      fallers: movers.filter(p => p.change < 0).slice(0, 5),
      // The Flags: Medium/High players WITH a note, in rank order — the note is the reason, so a flag
      // without one stays a dot in the Risk column and nothing more (first editions export those)
      flags: players.filter(p => p.risk && !/^(steady|low)$/i.test(String(p.risk).trim()) && p.note && String(p.note).trim()),
      signalGroups, signalCount: signalGroups.reduce((n, g) => n + g.items.length, 0),
      count: players.length, tiers: [...new Set(players.map(p => p.tier))].length };
  });
}

const football = withMovement(loadSport("football"));
const basketball = withMovement(loadSport("basketball"));
module.exports = { football, basketball,
  latestFootball: football[football.length - 1] || null,
  latestBasketball: basketball[basketball.length - 1] || null };
