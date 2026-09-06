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
