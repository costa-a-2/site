"""
The Weekly Rank — build data/headshots.json from nflverse player records

Official NFL.com headshot URLs, keyed by normalized player name. The site's
data layer joins these onto the rankings automatically.

    pip3 install nflreadpy
    python3 pull_headshots.py            # active QB/RB/WR/TE
"""
import json, re, sys
from pathlib import Path
try:
    import nflreadpy as nfl
except ImportError:
    sys.exit("pip3 install nflreadpy")

def norm(n):
    n = str(n or "").lower()
    n = re.sub(r"\s+(jr|sr|ii|iii|iv|v)\.?$", "", n.strip())
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", "", n)).strip()

df = nfl.load_players().to_pandas()
cols = set(df.columns)
name_col = next((c for c in ("display_name","full_name","player_name") if c in cols), None)
url_col  = next((c for c in ("headshot","headshot_url") if c in cols), None)
pos_col  = next((c for c in ("position","position_group") if c in cols), None)
if not (name_col and url_col):
    sys.exit(f"Unexpected columns: {sorted(cols)[:40]}")

out = {}
for _, r in df.iterrows():
    if pos_col and str(r.get(pos_col)) not in ("QB","RB","WR","TE"): continue
    url = r.get(url_col)
    if not url or str(url) == "nan": continue
    out[norm(r[name_col])] = str(url)

p = Path(__file__).resolve().parent / "data" / "headshots.json"
p.write_text(json.dumps(out, indent=1, sort_keys=True))
print(f"  ✓ {len(out)} headshots → {p}")
print("  Rebuild the site and the rankings table will show faces.")
