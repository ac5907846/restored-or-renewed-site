/* Sixteen hurricanes on the assessment rolls (Fig. 2), drawn the way the
   series' storm maps are drawn: one storm at a time, county fill from a
   chosen rate, circles scaled by the severe losses, the track with its
   landfall, the damage counties outlined. Hover a county for its
   numbers; click to pin it. The tour walks the storms in landfall order. */

import { el, svg, clear, control, segmented, select } from "../lib/dom.js";
import { figure } from "../lib/chart.js";
import { boundsOf, centroid, pathOf, projector, trackPath } from "../lib/geo.js";
import * as fmt from "../lib/format.js";
import { INK, LAND, MUTED, NODATA, PINK, NAVY } from "../lib/palette.js";
import * as tip from "../lib/tooltip.js";
import { tour } from "../lib/tour.js";

const MW = 640;
const MH = 600;
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (a, b, t) => "#" + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, "0")).join("");
const sequential = (t) => mix(hex("#dce6f0"), hex(NAVY), Math.max(0, Math.min(1, t)));

const FILLS = {
  excess_substantial_per100: { label: "Excess severe-loss rate per 100 structures", max: 10, fmt: (v) => fmt.num(v, 1) },
  substantial_per100: { label: "Severe-loss rate per 100 structures, storm roll pair", max: 10, fmt: (v) => fmt.num(v, 1) },
  n_destroyed_per100_parcels: { label: "FEMA-inspected destroyed dwellings per 100 parcels", max: 1, fmt: (v) => fmt.num(v, 2) },
};
const CIRCLES = {
  n_substantial: "Severe losses on the roll",
  n_destroyed: "FEMA destroyed dwellings",
  none: "No circles",
};

export function stormsChart(host, app) {
  const meta = app.meta;
  const catalog = app.storms.catalog.slice().sort((a, b) => a.season - b.season || a.fl_landfall_time.localeCompare(b.fl_landfall_time));
  const state = { storm: "ian_2022", fill: "excess_substantial_per100", circle: "n_substantial", pinned: null };
  const color = (k) => meta.storm_colors[k] || "#8c8c8c";

  const tourHost = el("div");
  const bar = el("div.controls");
  const figHost = el("div.figure");
  const legendHost = el("div", { style: { marginTop: ".6rem" } });
  const side = el("div.sidecard");
  const cap = el("p.caption");
  clear(host).append(tourHost, bar, el("div.panelgrid", {}, [el("div", {}, [figHost, legendHost]), side]), cap);

  const seg = segmented(catalog.map((s) => ({ key: s.storm, label: `${s.name} ${s.season}`, color: color(s.storm) })),
    state.storm, (v) => { state.storm = v; state.pinned = null; draw(); renderSide(); }, { storms: true });
  bar.appendChild(control("Storm", seg));
  bar.appendChild(control("County fill", select(Object.entries(FILLS).map(([k, v]) => ({ key: k, label: v.label })), state.fill, (v) => { state.fill = v; draw(); })));
  bar.appendChild(control("Circles", select(Object.entries(CIRCLES).map(([k, v]) => ({ key: k, label: v })), state.circle, (v) => { state.circle = v; draw(); })));

  const project = projector(pad2(boundsOf(app.geo.counties)), MW, MH, 10);
  function pad2([a, b, c, d]) {
    const px = (b - a) * 0.04;
    const py = (d - c) * 0.04;
    return [a - px, b + px, c - py, d + py];
  }
  const centers = new Map(app.geo.counties.map((c) => [c.fips, project(...centroid(c.rings))]));
  const rowsOf = () => {
    const m = new Map();
    for (const r of app.storms.county) if (r.storm === state.storm) m.set(r.county_fips, r);
    return m;
  };

  function fillColor(r) {
    const spec = FILLS[state.fill];
    if (!r || !r.is_primary) return NODATA;
    const v = r[state.fill];
    if (v === null || v === undefined) return NODATA;
    return sequential(Math.min(1, Math.max(0, v) / spec.max));
  }

  function rowsFor(c, r) {
    if (!r) return [["", "not declared for Individual Assistance"]];
    return [
      ["Declared for", meta.storms[r.storm] || r.storm],
      ["Analyzed under", meta.storms[r.primary_storm] || r.primary_storm],
      ["Pre-storm structures", fmt.count(r.structures)],
      ["Severe losses", fmt.count(r.n_substantial)],
      ["Severe-loss rate, storm pair", `${fmt.num(r.substantial_per100, 2)} per 100`],
      ["Routine rate, prior pair", r.baseline_substantial_per100 === null ? "n/a" : `${fmt.num(r.baseline_substantial_per100, 2)} per 100`],
      ["Excess", r.excess_substantial_per100 === null ? "n/a" : `${fmt.num(r.excess_substantial_per100, 2)} per 100`],
      ["FEMA destroyed dwellings", `${fmt.count(r.n_destroyed)} (${fmt.num(r.n_destroyed_per100_parcels, 2)} per 100 parcels)`],
      ["Distance to the track", `${fmt.num(r.dist_track_km, 0)} km`],
      ["Damage county", r.damage_county ? "yes" : "no"],
    ];
  }

  function draw() {
    const f = figure(figHost, { width: MW, height: MH, label: "Storm map", margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    const rows = rowsOf();
    f.add(svg("path", { d: pathOf(app.geo.context.rings, project), fill: LAND, stroke: "#fff", "stroke-width": 0.6 }));
    for (const c of app.geo.counties) {
      const r = rows.get(c.fips);
      const p = f.add(svg("path", { d: pathOf(c.rings, project), fill: fillColor(r), stroke: "#fff", "stroke-width": 0.6, style: { cursor: "pointer" } }));
      if (r && r.is_primary) {
        f.add(svg("path", { d: pathOf(c.rings, project), fill: "none", stroke: INK, "stroke-width": 0.5, "stroke-dasharray": r.damage_county ? null : "2 2",
          "pointer-events": "none", opacity: r.damage_county ? 0.9 : 0.5 }));
      }
      if (r && r.damage_county) {
        f.add(svg("path", { d: pathOf(c.rings, project), fill: "none", stroke: INK, "stroke-width": 1.6, "pointer-events": "none" }));
      }
      p.addEventListener("mousemove", (ev) => tip.show(ev, { title: `${c.name} County`, rows: rowsFor(c, r),
        note: r && r.damage_county ? "Damage county: excess of at least 1 per 100, or at least .25 destroyed per 100 parcels." : "Select to pin this county." }));
      p.addEventListener("mouseleave", tip.hide);
      p.addEventListener("click", () => { state.pinned = state.pinned === c.fips ? null : c.fips; draw(); renderSide(); });
      if (state.pinned === c.fips) {
        f.add(svg("path", { d: pathOf(c.rings, project), fill: "none", stroke: PINK, "stroke-width": 2.4, "pointer-events": "none" }));
      }
    }
    if (state.circle !== "none") {
      for (const c of app.geo.counties) {
        const r = rows.get(c.fips);
        if (!r || !r.is_primary) continue;
        const v = r[state.circle];
        if (!(v > 0)) continue;
        const [cx, cy] = centers.get(c.fips);
        f.add(svg("circle", { cx, cy, r: 2 + 0.28 * Math.sqrt(v), fill: PINK, "fill-opacity": 0.45, stroke: PINK, "stroke-width": 1, "pointer-events": "none" }));
      }
    }
    const trk = app.geo.tracks[state.storm];
    const s = catalog.find((q) => q.storm === state.storm);
    if (trk) {
      const keep = trk.lon.map((_, k) => k).filter((k) => trk.lon[k] > -92 && trk.lon[k] < -76 && trk.lat[k] > 21 && trk.lat[k] < 34);
      if (keep.length > 1) {
        const d = trackPath(keep.map((k) => trk.lon[k]), keep.map((k) => trk.lat[k]), project);
        f.add(svg("path", { d, fill: "none", stroke: "#fff", "stroke-width": 5, opacity: 0.85, "pointer-events": "none" }));
        f.add(svg("path", { d, fill: "none", stroke: color(state.storm), "stroke-width": 2, "pointer-events": "none" }));
      }
      const i = s ? trk.time.indexOf(s.fl_landfall_time) : -1;
      if (i >= 0) {
        const [lx, ly] = project(trk.lon[i], trk.lat[i]);
        const g = svg("g", { style: { cursor: "default" } }, [
          svg("circle", { cx: lx, cy: ly, r: 7, fill: "none", stroke: color(state.storm), "stroke-width": 2.2 }),
          svg("circle", { cx: lx, cy: ly, r: 2, fill: color(state.storm) }),
        ]);
        g.addEventListener("mousemove", (ev) => tip.show(ev, { title: `${s.name} ${s.season}`,
          rows: [[s.landfall_source === "landfall_record" ? "Strongest Florida landfall" : "Nearest fix to the coast (no landfall)", `${fmt.dateLabel(s.fl_landfall_time)}, ${fmt.num(s.fl_landfall_vmax_kt, 0)} kt`],
            ["Peak intensity", `${fmt.num(s.peak_vmax_kt, 0)} kt`], ["FEMA declaration", `DR-${String(s.disaster_numbers).split(";")[0]}`]] }));
        g.addEventListener("mouseleave", tip.hide);
        f.add(g);
      }
    }
    drawLegend();
  }

  function drawLegend() {
    const spec = FILLS[state.fill];
    const w = 320;
    const h = 40;
    const sv = svg("svg", { viewBox: `0 0 ${w} ${h}`, width: w, height: h, style: { maxWidth: "100%" } });
    const grad = svg("linearGradient", { id: "fillgrad", x1: 0, x2: 1 });
    for (let i = 0; i <= 10; i += 1) grad.appendChild(svg("stop", { offset: `${i * 10}%`, "stop-color": sequential(i / 10) }));
    sv.appendChild(svg("defs", {}, [grad]));
    sv.appendChild(svg("rect", { x: 0, y: 4, width: w, height: 10, fill: "url(#fillgrad)" }));
    for (const t of [0, 0.5, 1]) {
      sv.appendChild(svg("text", { x: t * w, y: 26, "text-anchor": t === 0 ? "start" : t === 1 ? "end" : "middle", "font-size": 10, fill: MUTED,
        text: t === 0 ? "0" : spec.fmt(t * spec.max) + (t === 1 ? "+" : "") }));
    }
    sv.appendChild(svg("text", { x: 0, y: 38, "font-size": 10, fill: MUTED, text: spec.label }));
    clear(legendHost).append(sv, el("div.legend", {}, [
      el("span.item", { text: "Heavy outline: damage county; dotted: analyzed under this storm; gray: not analyzed" }),
      el("span.item", {}, [el("span.dot", { style: { background: PINK, opacity: .6 } }), ` ${CIRCLES[state.circle]}`]),
    ]));
  }

  function renderSide() {
    clear(side);
    const s = catalog.find((q) => q.storm === state.storm);
    const tot = app.storms.totals.find((q) => q.storm === state.storm);
    if (!state.pinned) {
      side.append(el("h4", { text: `${s.name} ${s.season}` }));
      const dl = el("dl");
      const add = (k, v) => dl.append(el("dt", { text: k }), el("dd", { text: v }));
      add(s.landfall_source === "landfall_record" ? "Landfall" : "Nearest fix to the coast", `${fmt.dateLabel(s.fl_landfall_time)}, ${fmt.num(s.fl_landfall_vmax_kt, 0)} kt`);
      add("Declared counties", fmt.count(s.n_ia_counties));
      add("Roll pair", `${s.pre_roll} to ${String(s.post_rolls).split(";")[0]}, ${s.n_post_rolls} post-storm rolls`);
      add("Damage measure", s.damage_measure === "jv_only" ? "just value and removal" : "deleted value and just value");
      if (tot) {
        add("Damage counties", fmt.count(tot.damage_counties));
        add("Pre-storm structures", fmt.count(tot.structures));
        add("Severe losses", fmt.count(tot.substantial));
        add("Excess over routine", fmt.count(Math.max(0, tot.excess_substantial)));
        add("FEMA destroyed dwellings", fmt.count(tot.ihp_destroyed));
      }
      side.append(dl);
      return;
    }
    const c = app.geo.counties.find((q) => q.fips === state.pinned);
    side.append(el("h4", { text: `${c.name} County, ${s.name} ${s.season}` }));
    const r = rowsOf().get(state.pinned);
    const dl = el("dl");
    for (const [k, v] of rowsFor(c, r)) dl.append(el("dt", { text: k }), el("dd", { text: v }));
    side.append(dl);
  }

  cap.textContent = "A severe loss is a structure removed, written down by half or more, or with just value below half on the first post-storm roll; each county-season is analyzed once, under the storm of that season whose track passed closest.";

  draw();
  renderSide();

  const steps = catalog.map((s) => {
    const tot = app.storms.totals.find((q) => q.storm === s.storm);
    return {
      cap: tot ? `${s.name} ${s.season}: ${fmt.count(tot.substantial)} severe losses, ${tot.damage_counties} damage ${tot.damage_counties === 1 ? "county" : "counties"}` : `${s.name} ${s.season}`,
      ms: 2200,
      run: (c) => { state.storm = s.storm; state.pinned = null; seg.setValue(s.storm); draw(); renderSide(); return c.sleep(2200); },
    };
  });
  tour({ name: "the sixteen storms", steps, loops: 1, rest: () => {} }).attach(tourHost);
}
