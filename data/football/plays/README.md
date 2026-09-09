# The Plays — one file per season

`2026.json` holds everything that renders at /plays/: the play of the day (props), the survivor pick each
week, and any daily fantasy lineup. Append an entry before the game with `"grade": "open"`, then fill
`result` and `grade` (`hit`, `push`, `miss`) the next morning. Nothing is ever deleted; the record on the
page is the whole record.

```json
{
  "season": 2026,
  "props": [
    { "date": "2026-09-09", "game": "Patriots at Seahawks", "player": "Romeo Doubs", "pos": "WR", "team": "NE",
      "call": "Over 36.5 receiving yards", "line": "36.5 at most books; consensus 35.5",
      "why": "one or two sentences", "result": "", "grade": "open", "post": "https://x.com/theweeklyrank/status/..." }
  ],
  "survivor": [
    { "week": 1, "pick": "SEA", "opponent": "NE", "why": "", "result": "", "grade": "open" }
  ],
  "dfs": [
    { "date": "2026-09-09", "slate": "Wed showdown", "site": "DraftKings", "lineup": ["CPT Jadarian Price", "Drake Maye", "..."],
      "score": null, "note": "", "result": "", "grade": "open" }
  ]
}
```

`line` is the number as seen, with the book or consensus and the date implied by `date`. `post` links the
X post where the play was made public, if there is one. Survivor `grade` is `hit` (alive) or `miss` (out);
DFS `grade` is by your own bar, say cash-line or better = hit. `player` links to his page when he has one.
