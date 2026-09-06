const fs = require("fs");
const path = require("path");
const DATA_DIR = path.join(__dirname, "..", "..", "data");

function loadJSON(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return fallback; }
}
const HEADSHOTS = loadJSON(path.join(DATA_DIR, "headshots.json"), {});

// Badges after the player name — two-word archetypes computed from the projected shares in each
// player's `stats`, never typed (same rule as the change column). Thresholds live here and are
// referenced from metrics/WEIGHTS.md.
const BADGES = {
  RB: { bellCow: 0.60, leadBack: 0.45, passDownTargetShare: 0.12 },   // carryShare; targetShare for the add-on
  WR: { alpha: 0.26, volume: 0.18 },                                   // targetShare
  TE: { alpha: 0.26, featured: 0.18 },                                 // targetShare
  QB: { dualThreatRushYds: 500 }                                       // projected rushing yards
};
function badgesFor(p) {
  const s = p.stats || {}, out = [];
  const carry = +s.carryShare || 0, tgt = +s.targetShare || 0;
  if (p.pos === "RB") {
    if (carry >= BADGES.RB.bellCow) out.push("Bell cow");
    else if (carry >= BADGES.RB.leadBack) out.push("Lead back");
    else out.push("Committee");
    if (tgt >= BADGES.RB.passDownTargetShare) out.push("Pass-down role");
  } else if (p.pos === "WR") {
    if (tgt >= BADGES.WR.alpha) out.push("Alpha target");
    else if (tgt >= BADGES.WR.volume) out.push("Volume WR2");
  } else if (p.pos === "TE") {
    if (tgt >= BADGES.TE.alpha) out.push("Alpha target");
    else if (tgt >= BADGES.TE.featured) out.push("Featured TE");
  } else if (p.pos === "QB") {
    if ((+s.rushYds || 0) > BADGES.QB.dualThreatRushYds) out.push("Dual threat");
  }
  return out;
}

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
      // the edition's own Open Graph card, when brand/make_rankings_card.py has written it
      ogImage: fs.existsSync(path.join(__dirname, "..", "assets", "img", "og", `${slug}.png`)) ? `/assets/img/og/${slug}.png` : null,
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
               headshot: p.headshot || HEADSHOTS[keyOf(p.player)] || null, badges: badgesFor(p) };
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
    // If Healthy: players carrying a band typed on the board ("55–65") — a band for the week he's back, never a rank
    const ifHealthy = players.filter(p => p.bandIfHealthy && String(p.bandIfHealthy).trim())
      .map(p => ({ player: p.player, pos: p.pos, team: p.team, rank: p.rank, band: String(p.bandIfHealthy).trim(), note: p.note || "", risk: p.risk || "" }));
    // OTS is 0 for everyone preseason; the column hides until a real trend exists (Week 3+)
    const hasOts = players.some(p => typeof p.ots === "number" && p.ots !== 0);
    const seoDescription = wk.isPreseason
      ? `Half-PPR ${wk.season} preseason fantasy football rankings: the top ${players.length} players for the rest of the season, tiered at value cliffs, with movement from last week shown once the season starts.`
      : `Half-PPR rest-of-season fantasy football rankings for Week ${wk.week}, ${wk.season}: the top ${players.length} players, tiered at value cliffs, with movement from last week shown.`;
    return { ...wk, players, tierSummary, cusp, fellOff, ifHealthy, hasOts, seoDescription, prevLabel: prev ? prev.label : null,
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

// ── receipts: data/football/receipts/2026-week-NN.json → each week's graded calls and the season tally ──
const GRADES = ["hit", "push", "miss"];
function loadReceipts(sport) {
  const dir = path.join(DATA_DIR, sport, "receipts");
  if (!fs.existsSync(dir)) return [];
  const weeks = fs.readdirSync(dir).filter(f => /^\d{4}-week-\d{2}\.json$/.test(f)).sort().map(f => {
    const raw = loadJSON(path.join(dir, f), {});
    const week = typeof raw.week === "number" ? raw.week : parseInt(f.match(/week-(\d+)/)[1], 10);
    const calls = (Array.isArray(raw.calls) ? raw.calls : []).filter(c => c && c.player).map(c => ({
      player: String(c.player), call: String(c.call || ""), result: String(c.result || ""),
      grade: GRADES.includes(String(c.grade || "").toLowerCase()) ? String(c.grade).toLowerCase() : "push"
    }));
    return { week, season: parseInt(f.slice(0, 4), 10), label: `Week ${week}`, calls };
  });
  const tally = { hit: 0, push: 0, miss: 0, calls: 0 };
  return weeks.map(w => {
    w.calls.forEach(c => { tally[c.grade] += 1; tally.calls += 1; });
    return { ...w, tally: { ...tally }, line: `Season: ${tally.hit} hit · ${tally.push} push · ${tally.miss} miss` };
  });
}
function withReceipts(weeks, receipts) {
  return weeks.map(wk => ({ ...wk, receipts: receipts.find(r => r.week === wk.week && r.season === wk.season) || null }));
}

const receipts = loadReceipts("football");
const football = withReceipts(withMovement(loadSport("football")), receipts);
const basketball = withMovement(loadSport("basketball"));

// ── player pages: the union of every player who appeared in any football edition ──────────────
const ARTICLES_DIR = path.join(__dirname, "..", "articles");
function articleIndex() {
  if (!fs.existsSync(ARTICLES_DIR)) return [];
  return fs.readdirSync(ARTICLES_DIR).filter(f => f.endsWith(".md")).map(f => {
    const raw = fs.readFileSync(path.join(ARTICLES_DIR, f), "utf8");
    const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    const fm = m ? m[1] : "", body = m ? m[2] : raw;
    const get = k => { const r = fm.match(new RegExp(`^${k}:\\s*"?(.*?)"?\\s*$`, "m")); return r ? r[1] : ""; };
    return { url: `/articles/${f.replace(/\.md$/, "")}/`, title: get("title"), summary: get("summary"), date: get("date"), body };
  });
}
const SHARE_KEY = { RB: ["carryShare", "teamRushAtt", "carries"], WR: ["targetShare", "teamTargets", "targets"], TE: ["targetShare", "teamTargets", "targets"], QB: ["passAttShare", "teamPassAtt", "attempts"] };
function buildPlayers(weeks) {
  const articles = articleIndex();
  const latest = weeks[weeks.length - 1];
  const byName = new Map();
  weeks.forEach(wk => wk.players.forEach(p => {
    const e = byName.get(p.player) || { player: p.player, editions: [] };
    e.editions.push({ slug: wk.slug, label: wk.label, url: wk.url, published: wk.published, isPreseason: wk.isPreseason,
                      modelRank: p.modelRank ?? null, rank: p.rank, change: wk.firstEdition ? null : p.change, note: p.note || "" });
    e.last = p; e.lastWeek = wk;                                   // the most recent edition he appeared in
    byName.set(p.player, e);
  }));
  return [...byName.values()].map(e => {
    const p = e.last, wk = e.lastWeek, s = p.stats || {};
    const [shareKey, totalKey, unit] = SHARE_KEY[p.pos] || [null, null, ""];
    const room = (wk.players.filter(q => q.team === p.team && q.pos === p.pos && q.player !== p.player)
      .map(q => ({ player: q.player, rank: q.rank, share: q.stats ? q.stats[shareKey] : null, onSite: true })))
      .concat((wk.cusp || []).filter(c => c.team === p.team && c.pos === p.pos).map(c => ({ player: c.player, rank: null, share: null, onSite: false })))
      .sort((a, b) => (b.share || 0) - (a.share || 0));
    const sgRaw = (wk.signals || []).find(sg => sg.player === p.player) || null;
    const sgGroup = sgRaw ? (wk.signalGroups || []).find(g => g.id === sgRaw.group) : null;
    const signal = sgRaw ? { ...sgRaw, groupLabel: sgGroup ? sgGroup.label : sgRaw.group } : null;
    const mentions = articles.filter(a => a.body.includes(p.player)).sort((a, b) => (a.date < b.date ? 1 : -1))
      .map(({ url, title, summary, date }) => ({ url, title, summary, date }));
    return {
      player: p.player, pos: p.pos, team: p.team, season: latest.season, onLatest: wk === latest, latestLabel: wk.label, latestUrl: wk.url,
      rank: p.rank, modelRank: p.modelRank ?? null, posRank: p.posRank ?? null, adp: p.adp ?? null, ppg: p.ppg ?? null, vorp: p.vorp ?? null,
      vsMarket: (typeof p.adp === "number" && typeof p.rank === "number") ? Math.round(p.adp - p.rank) : null,
      games: s.games ?? null, tier: p.tier ?? null, tierName: p.tierName || "", risk: p.risk || "", note: p.note || "", badges: p.badges || [],
      headshot: p.headshot || null, stats: p.stats || null, share: shareKey ? s[shareKey] : null, shareTotal: totalKey ? s[totalKey] : null, shareUnit: unit,
      bandIfHealthy: p.bandIfHealthy || "", signal, editions: e.editions, mentions, room
    };
  }).sort((a, b) => a.player.localeCompare(b.player));
}
const players = buildPlayers(football);

module.exports = { football, basketball,
  latestFootball: football[football.length - 1] || null,
  latestBasketball: basketball[basketball.length - 1] || null,
  players, playerNames: players.map(p => p.player),
  receipts, receiptsTally: receipts.length ? receipts[receipts.length - 1].tally : { hit: 0, push: 0, miss: 0, calls: 0 } };
