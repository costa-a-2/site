// The caveat block at the top of /signals/: the "Read this first" section of
// content/what_the_metrics_tell_us.md, rendered from markdown at build time. Only that
// section is published — the rest of the file is a working draft.
const fs = require("fs");
const path = require("path");
const SRC = path.join(__dirname, "..", "..", "..", "content", "what_the_metrics_tell_us.md");

module.exports = () => {
  let md = "";
  try { md = fs.readFileSync(SRC, "utf8"); } catch { return { title: "", html: "" }; }
  const m = md.match(/^##\s+(Read this first[^\n]*)\n([\s\S]*?)(?=\n---|\n## )/m);
  if (!m) return { title: "", html: "" };
  const MarkdownIt = require("markdown-it");
  const html = new MarkdownIt({ html: false, typographer: true }).render(m[2].trim());
  return { title: m[1].trim(), html };
};
