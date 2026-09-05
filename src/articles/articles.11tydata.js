// Directory data for src/articles/*.md — the layout, the collection tag, a default read time, and the
// page type that switches the head's Open Graph and JSON-LD. Kept out of the front matter so the
// Pages CMS editor never sees or rewrites it.
module.exports = {
  layout: "layouts/article.njk",
  tags: "articles",
  readtime: "5 min",
  eleventyComputed: {
    pageType: (data) => (data.page && data.page.fileSlug === "about-costa" ? "person" : "article")
  }
};
