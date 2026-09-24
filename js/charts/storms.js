/* Sixteen hurricanes on the assessment rolls (Fig. 2): for one storm at
   a time, the excess severe-loss rate by county, the HURDAT2 track and
   the storm’s totals. The tour walks the storms in order of landfall. */

import { el, svg, clear, control, select } from "../lib/dom.js";
import { figure } from "../lib/chart.js";
import { boundsOf, pathOf, projector, trackPath } from "../lib/geo.js";
import * as fmt from "../lib/format.js";
import { INK, MUTED, NODATA, PINK, NAVY } from "../lib/palette.js";
import * as tip from "../lib/tooltip.js";
import { tour } from "../lib/tour.js";

const MW = 640;
const MH = 560;
const VMAX = 10;
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (a, b, t) => "#" + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, "0")).join("");
const tint = (t) => mix(hex("#f2f0ec"), hex(NAVY), Math.max(0, Math.min(1, t)));

export function stormsChart(host, app) {
  const meta = app.meta;
  const catalog = app.storms.catalog.slice().sort((a, b) => a.season - b.season || a.fl_landfall_time.localeCompare(b.fl_landfall_time));
  const state = { storm: "ian_2022" };

  const tourHost = el("div");
  const bar = el("div.controls");
  const figHost = el("div.figure");
  const legend = el("div.legend");
  const side = el("div.sidecard");
  const capHost = el("p.caption");
  clear(host).append(tourHost, bar, el("div.panelgrid", {}, [el("div", {}, [figHost, legend]), side]), capHost);

  const sel = select(catalog.map((s) => ({ key: s.storm, label: `${s.name} ${s.season}` })), state.storm,
    (v) => { state.storm = v; draw(); renderSide(); });
  bar.appendChild(control("Storm", sel));

  const project = projector(pad(boundsOf(app.geo.counties)), MW, MH, 8);
  function pad([a, b, c, d]) {
    return [a - (b - a) * 0.03, b + (b - a) * 0.03, c - (d - c) * 0.03, d + (d - c) * 0.03];
  }
  const byFips = () => {
    const m = new Map();
    for (const r of app.storms.county) if (r.storm === state.storm) m.set(r.county_fips, r);
    return m;
  };

  function draw() {
    const f = figure(figHost, { width: MW, height: MH, label: "Florida counties", margin: { top: 2, right: 2, bottom: 2, left: 2 } });
    const rows = byFips();
    for (const c of app.geo.counties) {
      const r = rows.get(c.fips);
      let fill = NODATA;
      if (r && r.is_primary) {
        const v = r.excess_substantial_per100 ?? r.substantial_per100 ?? 0;
        fill = tint(v / VMAX);
      }
      const path = svg("path", {
        d: pathOf(c.rings, project), fill,
        stroke: r && r.damage_county ? INK : "#fff",
        "stroke-width": r && r.damage_county ? 1.4 : 0.6,
      });
      path.addEventListener("pointerenter", (e) => tip.show(e, {
        title: `${c.name} County`,
        rows: r ? [
          ["Declared for", meta.storms[r.storm] || r.storm],
          ["Analyzed under", meta.storms[r.primary_storm] || r.primary_storm],
          ["Pre-storm structures", fmt.count(r.structures)],
          ["Severe loss, storm pair", `${fmt.num(r.substantial_per100, 2)} per 100`],
          ["Routine rate, prior pair", r.baseline_substantial_per100 === null ? "n/a" : `${fmt.num(r.baseline_substantial_per100, 2)} per 100`],
          ["Excess", r.excess_substantial_per100 === null ? "n/a" : `${fmt.num(r.excess_substantial_per100, 2)} per 100`],
          ["FEMA destroyed per 100 parcels", r.n_destroyed_per100_parcels === null ? "n/a" : fmt.num(r.n_destroyed_per100_parcels, 2)],
          ["Damage county", r.damage_county ? "yes" : "no"],
        ] : [["", "not declared for Individual Assistance"]],
      }));
      path.addEventListener("pointermove", tip.move);
      path.addEventListener("pointerleave", tip.hide);
      f.add(path);
    }
    const t = app.geo.tracks[state.storm];
    if (t) {
      f.add(svg("path", { d: trackPath(t.lon, t.lat, project), fill: "none", stroke: PINK, "stroke-width": 2, "stroke-linecap": "round" }));
    }
    const s = catalog.find((q) => q.storm === state.storm);
    if (s && s.fl_landfall_time && t) {
      const i = t.time.indexOf(s.fl_landfall_time);
      if (i >= 0) {
        const [x, y] = project(t.lon[i], t.lat[i]);
        f.add(svg("circle", { cx: x, cy: y, r: 6, fill: "#fff", stroke: PINK, "stroke-width": 2 }));
      }
    }
    clear(legend);
    const ramp = el("span.item", {}, [el("span", { text: "Excess severe-loss rate per 100 structures: 0" })]);
    for (let k = 0; k <= 5; k += 1) ramp.appendChild(el("span.swatch", { style: { background: tint(k / 5) } }));
    ramp.appendChild(el("span", { text: ` ${VMAX} or more` }));
    legend.append(ramp,
      el("span.item", { text: "Thick outline: damage county. Gray: not analyzed under this storm." }),
      el("span.item", {}, [el("span.swatch", { style: { background: PINK } }), " HURDAT2 track, circle at the strongest Florida landfall or the fix nearest the coast"]));
  }

  function renderSide() {
    clear(side);
    const s = catalog.find((q) => q.storm === state.storm);
    const tot = app.storms.totals.find((q) => q.storm === state.storm);
    side.appendChild(el("h3", { text: `${s.name} ${s.season}` }));
    const rows = [
      [s.landfall_source === "landfall_record" ? "Landfall (strongest, Florida)" : "Nearest fix to the coast (no landfall)", `${s.fl_landfall_time}, ${fmt.num(s.fl_landfall_vmax_kt, 0)} kt`],
      ["FEMA declaration", `DR-${String(s.disaster_numbers).split(";")[0]}`],
      ["Declared counties", String(s.n_ia_counties)],
      ["Roll pair", `${s.pre_roll} to ${String(s.post_rolls).split(";")[0]}`],
      ["Post-storm rolls", String(s.n_post_rolls)],
      ["Damage measure", s.damage_measure === "jv_only" ? "just value and removal (no deleted value before 2010)" : "deleted value and just value"],
    ];
    if (tot) {
      rows.push(["Damage counties", String(tot.damage_counties)],
        ["Pre-storm structures", fmt.count(tot.structures)],
        ["Severely damaged", fmt.count(tot.substantial)],
        ["Excess over routine", fmt.count(Math.max(0, tot.excess_substantial))],
        ["FEMA destroyed dwellings", fmt.count(tot.ihp_destroyed)]);
    }
    const tbl = el("table.dtable");
    const tb = el("tbody");
    for (const [k, v] of rows) tb.appendChild(el("tr", {}, [el("td", { text: k }), el("td", { text: v })]));
    tbl.appendChild(tb);
    side.appendChild(tbl);
    capHost.textContent = "A county enters the panel when it was declared for Individual Assistance; the 2004, 2022 and 2024 seasons declared some counties for two or more storms, and each county-season is analyzed once, under the storm of that season whose track passed closest. A damage county has an excess severe-loss rate of at least 1 per 100 structures or at least .25 inspector-recorded destroyed dwellings per 100 parcels. Descriptive county rates, no model; the roll records assessed value, not inspected damage.";
  }

  draw();
  renderSide();

  const steps = catalog.map((s) => {
    const tot = app.storms.totals.find((q) => q.storm === s.storm);
    return {
      cap: `${s.name} ${s.season}: ${tot ? `${tot.damage_counties} damage ${tot.damage_counties === 1 ? "county" : "counties"}, ${fmt.count(tot.substantial)} severe losses` : ""}`,
      ms: 2200,
      run: (c) => { state.storm = s.storm; sel.value = s.storm; draw(); renderSide(); return c.sleep(2200); },
    };
  });
  tour({ name: "the sixteen storms", steps, loops: 1, rest: () => {} }).attach(tourHost);
}
