# Restored or renewed?

Interactive companion site to the manuscript *Restored or Renewed? What
Happens to Severely Damaged Houses after Florida Hurricanes, 2004 to
2024* (Paper 2 of the series).

Static site: plain HTML, CSS and ES modules, no build step, no
framework, no external requests, light mode only. Every chart is
hand-drawn SVG from the JSON files in `data/`, which are generated
from the analysis outputs in `02_analysis/`. The site is anonymous (no
author, no affiliation) and does not name the journal.

## Where it lives

GitHub: <https://github.com/ac5907846/restored-or-renewed-site>.
Hosted on Cloudflare Pages as project `restored-or-renewed`
(<https://restored-or-renewed.pages.dev>, custom domain
<https://housing.electriai.com>, attached to the project; it resolves
once the DNS record `housing CNAME restored-or-renewed.pages.dev`,
proxied, exists in the electriai.com zone). To publish a change:
rebuild the data layer, bump `VERSION` in `js/shell.js` and the `?v=`
query on the assets in the four HTML files, test, commit, then

```
py -3 tools/deploy.py
```

which exports the last commit to a temporary folder and runs
`npx wrangler pages deploy <folder> --project-name restored-or-renewed --branch main`,
so the deployment holds exactly the committed files (deploying `.`
directly would also upload `_archive/`).

## Run it

A browser will not read `data/` over `file://`, so serve the folder:

```
cd 05_webapp
py -3 -m http.server 8000
```

Then open <http://localhost:8000>. `serve.bat` does the same in one
double-click.

## Rebuild the data layer

```
py -3 tools/build_data.py --check
```

Reads `02_analysis/a05, a08, a09, a10, a12, a13, a17, a18, a19, a20,
a21/results/*` (and a06 for the Lee County parcel centroids) and
rewrites everything under `data/`; `--check` then prints the published
values beside the ones the paper’s claims file quotes. The county
outlines in `data/geo/counties.json` and `context.json` are shared with
the Paper 1 site. No number is typed into a page.

## Pages

Four tabs, each one chart block with a one-line title and at most one
sentence under it; every other number lives in the hover tooltips and
the tour captions. The study area first, then the paper's three tiers.

| File | Tab | Paper item | Reads |
|---|---|---|---|
| `index.html` | Sixteen storms | Fig. 2 as a storm map in the series' style (county fill, severe-loss circles, track and landfall, damage counties), with the data register in one line at the foot | `storms.json`, `geo/` |
| `renewal.html` | Renewal window | Fig. 3 (hazard, cumulative exit, timing) and Fig. 4 (what stands on the lot by vintage band) | `window.json`, `pathways.json`, `overview.json` |
| `threshold.html` | Redevelopment threshold | Fig. 5 (the index curve, the value-left by land-share plane, replaced or cleared); Table 2 and the income check in the tooltips | `threshold.json`, `overview.json` |
| `exposure.html` | Next storm | Fig. 6 (the recovery plane and every adjusted estimate) and Fig. 7 (raw rates and stakes in the tooltips), with the Lee County map of the Charley cohort at Ian | `exposure.json`, `overview.json`, `geo/` |

The site plays itself (`js/lib/tour.js`): the landing page's tour starts
on arrival, and when a page's tour ends the site moves to the next tab
and runs that tour, through all four tabs, then starts over; the lap
counter and the position travel in `sessionStorage`, the first lap runs
at double speed and later laps at normal speed. Any click, key, wheel or
touch pauses the lap and the Play/Pause button resumes it; a page opened
by hand while paused stays paused; reduced-motion settings skip it all.
The storm map draws the tracks as the paper's Fig. 2 does: HURDAT2
fixes within the figure's frame (-88.7, -78.0, 24.3, 31.2) plus a 2
degree margin, split where a storm leaves and returns, only the pass
that made the landfall, a centripetal Catmull-Rom curve through the
fixes, the symbol resting at the landfall of `a13 storm_labels.csv` and
an open circle for a storm that did not land. The
masthead and tab bar are static markup, so the frame paints before the
data arrives; `js/shell.js` holds the `PAGES` array, marks the active
tab and loads only the files a page declares in `js/pages/<id>.js`.
The seven-tab version of 2026-09-23 is in `_archive/2026-09-24_seven_tabs/`.

## Testing without a browser session

```
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --disable-gpu --window-size=1400,3000 --virtual-time-budget=15000 --screenshot=out.png http://127.0.0.1:8000/index.html
```

`_archive/` holds the modules and data files of the earlier draft of the
site and is not deployed.
