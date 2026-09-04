# The Weekly Rank

Rest-of-season fantasy rankings for football and basketball, with the movement shown.

## Local development

```bash
npm install
npm start          # dev server at http://localhost:8080
npm run build      # production build into _site/
```

## Design system (v2)

Cinzel for the furniture (masthead, nav, section labels, kickers). Playfair Display for headlines. Lora for body.
Full-color photography on cream paper. Color only ever encodes data — movement in oxidized green and newsprint red — plus one ink-red "Updated" stamp on the rankings page.

Elements: ears and skybox strip above the nameplate · headline plate over the lead image · reversed-out section labels ·
six-week sparklines and headshots in the rankings table · movers ladder · byline with mug and wire-service dateline.

## One-time setup

```bash
python3 pull_headshots.py       # fills data/headshots.json from nflverse
```
Drop a photo of yourself at `src/assets/img/costa.jpg` for the byline mug (square, 200px+).

## Publishing a week's rankings

1. Drop a new file in `data/football/` named `2026-week-NN.json`
2. Format: `{published, updatedAt (ISO, optional — drives the stamp), format, players:[{rank, player, pos, team, tier, tierName, ots, note}]}`
3. The change column is computed automatically against the previous week — never enter it by hand
4. Commit and push. GitHub Actions builds the site and deploys it to GitHub Pages (`.github/workflows/pages.yml`).

## Structure

```
src/
  _data/rankings.js     loads week files, computes movement
  _includes/            layouts and partials
  articles/             weekly write-ups (markdown)
  assets/               css and images
data/
  football/             one JSON per week
  basketball/
```
