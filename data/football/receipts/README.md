# Receipts — one file per week

`2026-week-NN.json`, written the Monday after the games, grading the calls the board made the previous
Tuesday. The site renders the latest week's file in the rail on the homepage and the rankings pages and
lists every week at /accuracy/ with the running season tally. No file, no box.

```json
{
  "week": 1,
  "calls": [
    { "player": "Jadarian Price", "call": "RB17 in Week 1", "result": "19 carries, 2 catches, a goal-line score", "grade": "hit" },
    { "player": "Derrick Henry",  "call": "top-10 PPG",       "result": "RB14 on the week",                        "grade": "push" },
    { "player": "Cam Skattebo",   "call": "fade at RB16",     "result": "22 touches, RB6",                         "grade": "miss" }
  ]
}
```

`grade` is `hit`, `push` or `miss` (anything else reads as push). `player` links to his page when he has one.

## Season-long calls — `2026-season.json`

One file per season for the calls that cannot be graded on a Monday: the bold predictions, the Tyson call,
anything with a "through Week 17" in it. Same shape as a weekly call plus two fields:

```json
{
  "season": 2026,
  "calls": [
    { "player": "Jadarian Price", "call": "Price finishes 2026 with more half-PPR points than Walker.",
      "rule": "Total half-PPR points, Weeks 1 through 17. No games-played adjustment; if either one gets hurt, that is part of the call.",
      "grade": "open", "standing": "", "made": "2026-09-08", "source": "/articles/bold-predictions-2026/" }
  ]
}
```

`grade` starts as `open` and becomes `hit`, `push` or `miss` when the call settles. `open` never counts in the
season tally; a settled season call does. `standing` is the running "where it stands" column, filled by hand on
Mondays and blank until then. `made` and `source` are optional. Renders as "On the Record" at /accuracy/.
