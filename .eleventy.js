module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });

  // ── Filters ───────────────────────────────────────────────
  eleventyConfig.addFilter("date", (value, fmt) => {
    const d = value instanceof Date ? value : new Date(value + "T12:00:00");
    const months = ["January","February","March","April","May","June",
                    "July","August","September","October","November","December"];
    if (fmt === "short") return `${months[d.getMonth()].slice(0,3)} ${d.getDate()}`;
    if (fmt === "long")  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    return d.toISOString().slice(0, 10);
  });

  // Movement display: returns {sym, cls, abs}
  // firstEdition: there is no prior edition at all, so a null change means "nothing to compare
  // against yet" (—), not "new to the list" (NEW).
  eleventyConfig.addFilter("movement", (change, firstEdition) => {
    if (firstEdition) return { sym: "—", cls: "is-flat", abs: "" };
    if (change === null || change === undefined) return { sym: "NEW", cls: "is-new", abs: "" };
    if (change === 0) return { sym: "—", cls: "is-flat", abs: "" };
    return change > 0
      ? { sym: "▲", cls: "is-up",   abs: String(Math.abs(change)) }
      : { sym: "▼", cls: "is-down", abs: String(Math.abs(change)) };
  });

  eleventyConfig.addFilter("limit", (arr, n) => (arr || []).slice(0, n));

  // Risk label (Low / Medium / High, typed on the Rankings tab) → css class for the dot.
  // The dot is an ink-weight scale (--rule / --muted / --ink), never a color: red means "fell" only.
  eleventyConfig.addFilter("riskClass", (label) =>
    ({ low: "risk-low", medium: "risk-medium", high: "risk-high" })[String(label || "").trim().toLowerCase()] || "");

  // Inline SVG sparkline from an array of ranks (lower rank = higher on chart). nulls break the line.
  eleventyConfig.addFilter("sparkline", (history, w = 64, h = 16) => {
    const pts = (history || []).filter(v => typeof v === "number");
    if (pts.length < 2) return "";
    const min = Math.min(...pts), max = Math.max(...pts), span = Math.max(1, max - min);
    const n = history.length, step = (w - 4) / Math.max(1, n - 1);
    let d = "", segs = [];
    history.forEach((v, i) => {
      if (typeof v !== "number") { if (d) segs.push(d); d = ""; return; }
      const x = (2 + i * step).toFixed(1), y = (2 + ((v - min) / span) * (h - 4)).toFixed(1);
      d += (d ? " " : "") + `${x},${y}`;
    });
    if (d) segs.push(d);
    const last = history[history.length - 1], prev = [...history].reverse().find((v, i) => i > 0 && typeof v === "number");
    const lx = (2 + (n - 1) * step).toFixed(1), ly = typeof last === "number" ? (2 + ((last - min) / span) * (h - 4)).toFixed(1) : null;
    const col = (typeof last === "number" && typeof prev === "number") ? (last < prev ? "var(--up)" : last > prev ? "var(--down)" : "var(--muted)") : "var(--muted)";
    const lines = segs.map(s => `<polyline points="${s}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/>`).join("");
    const dot = ly ? `<circle cx="${lx}" cy="${ly}" r="2" fill="${col}"/>` : "";
    return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${lines}${dot}</svg>`;
  });

  eleventyConfig.addFilter("time", (iso) => {
    if (!iso) return "";
    const d = new Date(iso); if (isNaN(d)) return "";
    const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    let hh = d.getHours(), mm = String(d.getMinutes()).padStart(2, "0"); const ap = hh >= 12 ? "PM" : "AM"; hh = hh % 12 || 12;
    return `${days[d.getDay()]} ${hh}:${mm} ${ap}`;
  });

  eleventyConfig.addFilter("where", (arr, key, val) =>
    (arr || []).filter((x) => x[key] === val));

  // Group ranked players into tier blocks, preserving order
  eleventyConfig.addFilter("byTier", (players) => {
    const out = [];
    let cur = null;
    (players || []).forEach((p) => {
      if (!cur || cur.tier !== p.tier) {
        cur = { tier: p.tier, name: p.tierName || `Tier ${p.tier}`, players: [] };
        out.push(cur);
      }
      cur.players.push(p);
    });
    return out;
  });

  // ── Collections ───────────────────────────────────────────
  eleventyConfig.addCollection("articles", (api) =>
    api.getFilteredByGlob("src/articles/*.md").reverse());

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data"
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk"
  };
};
