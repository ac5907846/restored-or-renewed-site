/* Sixteen hurricanes on the assessment rolls (Fig. 2), drawn the way the
   series' storm maps are drawn: one storm at a time, county fill from a
   chosen rate, circles scaled by the severe losses, the track as a
   smooth curve with the hurricane symbol, the counties passing the
   damage rule outlined. Selecting a storm animates it: the track draws
   itself from the open sea across Florida with the symbol travelling
   along it, and each county fills as the storm reaches it. Hover a
   county for its numbers; click to pin it. The tour walks the storms in
   landfall order. */

import { el, svg, clear, control, segmented, select } from "../lib/dom.js";
import { figure, hurricaneGlyph } from "../lib/chart.js";
import { boundsOf, centroid, pathOf, projector, smoothTrackPath, runsInside } from "../lib/geo.js";
import * as fmt from "../lib/format.js";
import { INK, LAND, MUTED, NODATA, PINK, NAVY } from "../lib/palette.js";
import * as tip from "../lib/tooltip.js";
import { tour, reduced } from "../lib/tour.js";

const MW = 640;
const MH = 600;
const ANIM_MS = 2000;
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (a, b, t) => "#" + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, "0")).join("");
const sequential = (t) => mix(hex("#dce6f0"), hex(NAVY), Math.max(0, Math.min(1, t)));

const FILLS = {
  excess_substantial_per100: { label: "Excess severe-loss rate per 100 structures", max: 10, fmt: (v) => fmt.num(v, 1) },
  substantial_per100: { label: "Severe-loss rate per 100 structures, storm roll pair", max: 10, fmt: (v) => fmt.num(v, 1) },
  n_destroyed_per100_parcels: { label: "FEMA-inspected destroyed dwellings per 100 parcels", max: 1, fmt: (v) => fmt.num(v, 2) },
};
const CIRCLES = {
  n_substantial: "severe losses on the roll",
  n_destroyed: "FEMA destroyed dwellings",
  none: "no circles",
};
const RULE = "A county passes the damage rule when its severe losses exceed the county's no-storm rate by at least 1 per 100 structures, or FEMA inspectors recorded at least .25 destroyed dwellings per 100 residential parcels; only these counties enter the analysis.";
const SEVERE = "A severe loss is a structure removed on the first post-storm roll, or with half or more of its pre-storm improvement value deleted, or with just value below half; the 2004 and 2005 rolls carry no deleted value, so there only removal and just value apply.";
const TERMS = {
  landfall: "The HURDAT2 fix with the highest wind at a Florida landfall; where the storm did not make landfall, the fix nearest the coast.",
  declared: "Counties with a FEMA Individual Assistance declaration for this storm.",
  analyzed: "Each county-season is analyzed once, under the storm of that season whose track passed closest, so a county declared for two storms of one season counts under one of them.",
  rule: RULE,
  rollpair: "The assessment roll before the storm season (1 January) and the first roll after it; damage is read as the change between the two.",
  rolls: "Annual assessment rolls after the storm, through the 2026 preliminary roll, over which each severely damaged house is followed.",
  measure: "Rolls from 2010 record the value the appraiser deleted; earlier rolls record only just value and whether the structure was removed.",
  structures: "Residential structures with a recorded year built on the pre-storm roll of the counties analyzed under this storm.",
  severe: SEVERE,
  excess: "Severe losses above the count the county's routine rate in the roll pair before the season would give; a negative excess is shown as zero.",
  fema: "Dwellings that FEMA inspectors recorded as destroyed among Individuals and Households Program registrants of the analyzed counties.",
  distance: "Distance from the county centroid to the nearest point of the HURDAT2 track.",
};

export function stormsChart(host, app) {
  const meta = app.meta;
  const catalog = app.storms.catalog.slice().sort((a, b) => a.season - b.season || a.fl_landfall_time.localeCompare(b.fl_landfall_time));
  const state = { storm: "ian_2022", fill: "excess_substantial_per100", circle: "n_substantial", pinned: null, anim: null };
  const color = (k) => meta.storm_colors[k] || "#8c8c8c";

  const tourHost = el("div");
  const bar = el("div.controls");
  const figHost = el("div.figure");
  const legendHost = el("div", { style: { marginTop: ".6rem" } });
  const side = el("div.sidecard");
  const cap = el("p.caption");
  clear(host).append(tourHost, bar, el("div.panelgrid", {}, [el("div", {}, [figHost, legendHost]), side]), cap);

  const seg = segmented(catalog.map((s) => ({ key: s.storm, label: `${s.name} ${s.season}`, color: color(s.storm) })),
    state.storm, (v) => { state.storm = v; state.pinned = null; draw(true); renderSide(); }, { storms: true });
  bar.appendChild(control("Storm", seg));
  bar.appendChild(control("County fill", select(Object.entries(FILLS).map(([k, v]) => ({ key: k, label: v.label })), state.fill, (v) => { state.fill = v; draw(false); })));
  bar.appendChild(control("Circles", select(Object.entries(CIRCLES).map(([k, v]) => ({ key: k, label: v[0].toUpperCase() + v.slice(1) })), state.circle, (v) => { state.circle = v; draw(false); })));

  const project = projector(pad2(boundsOf(app.geo.counties)), MW, MH, 10);
  function pad2([a, b, c, d]) {
    const px = (b - a) * 0.04;
    const py = (d - c) * 0.04;
    return [a - px, b + px, c - py, d + py];
  }
  /* the track is drawn only where the frame can show it, so the symbol
     ends its run at the edge of the map, not beyond it */
  const visible = pad2(pad2(boundsOf(app.geo.counties)));
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
      ["Passes the damage rule", r.damage_county ? "yes: in the analysis sample" : "no"],
      ["Pre-storm structures", fmt.count(r.structures)],
      ["Severe losses", fmt.count(r.n_substantial)],
      ["Severe-loss rate, storm roll pair", `${fmt.num(r.substantial_per100, 2)} per 100`],
      ["Routine rate, prior roll pair", r.baseline_substantial_per100 === null ? "n/a" : `${fmt.num(r.baseline_substantial_per100, 2)} per 100`],
      ["Excess over routine", r.excess_substantial_per100 === null ? "n/a" : `${fmt.num(r.excess_substantial_per100, 2)} per 100`],
      ["FEMA destroyed dwellings", `${fmt.count(r.n_destroyed)} (${fmt.num(r.n_destroyed_per100_parcels, 2)} per 100 parcels)`],
      ["Distance to the track", `${fmt.num(r.dist_track_km, 0)} km`],
    ];
  }

  /** Draw the map; with animate, the storm arrives over ANIM_MS. */
  function draw(animate) {
    if (state.anim) { cancelAnimationFrame(state.anim); state.anim = null; }
    const f = figure(figHost, { width: MW, height: MH, label: "Storm map", margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    const rows = rowsOf();
    const s = catalog.find((q) => q.storm === state.storm);
    const col = color(state.storm);
    f.add(svg("path", { d: pathOf(app.geo.context.rings, project), fill: LAND, stroke: "#fff", "stroke-width": 0.6 }));
    const countyNodes = [];
    for (const c of app.geo.counties) {
      const r = rows.get(c.fips);
      const final = fillColor(r);
      const p = f.add(svg("path", { class: "county", d: pathOf(c.rings, project), fill: NODATA, stroke: "#fff", "stroke-width": 0.6, style: { cursor: "pointer" } }));
      countyNodes.push({ fips: c.fips, node: p, final, r });
      if (r && r.is_primary) {
        f.add(svg("path", { d: pathOf(c.rings, project), fill: "none", stroke: INK, "stroke-width": 0.5, "stroke-dasharray": r.damage_county ? null : "2 2",
          "pointer-events": "none", opacity: r.damage_county ? 0.9 : 0.5 }));
      }
      if (r && r.damage_county) {
        f.add(svg("path", { d: pathOf(c.rings, project), fill: "none", stroke: INK, "stroke-width": 1.6, "pointer-events": "none" }));
      }
      p.addEventListener("mousemove", (ev) => tip.show(ev, { title: `${c.name} County`, rows: rowsFor(c, r),
        note: r && r.damage_county ? RULE : "Select to pin this county." }));
      p.addEventListener("mouseleave", tip.hide);
      p.addEventListener("click", () => { state.pinned = state.pinned === c.fips ? null : c.fips; draw(false); renderSide(); });
      if (state.pinned === c.fips) {
        f.add(svg("path", { d: pathOf(c.rings, project), fill: "none", stroke: PINK, "stroke-width": 2.4, "pointer-events": "none" }));
      }
    }
    const circleNodes = [];
    if (state.circle !== "none") {
      for (const c of app.geo.counties) {
        const r = rows.get(c.fips);
        if (!r || !r.is_primary) continue;
        const v = r[state.circle];
        if (!(v > 0)) continue;
        const [cx, cy] = centers.get(c.fips);
        circleNodes.push({ fips: c.fips, node: f.add(svg("circle", { class: "county-circle", cx, cy, r: 2 + 0.28 * Math.sqrt(v), fill: PINK, "fill-opacity": 0.45, stroke: PINK, "stroke-width": 1, "pointer-events": "none", opacity: 0 })) });
      }
    }

    /* the track: one smooth curve per run of fixes inside the frame */
    const trk = app.geo.tracks[state.storm];
    const runs = trk ? runsInside(trk, visible) : [];
    const paths = [];
    for (const run of runs) {
      const d = smoothTrackPath(run.map((k) => trk.lon[k]), run.map((k) => trk.lat[k]), project);
      const halo = f.add(svg("path", { d, fill: "none", stroke: "#fff", "stroke-width": 5, opacity: 0.85, "pointer-events": "none" }));
      const line = f.add(svg("path", { d, fill: "none", stroke: col, "stroke-width": 2, "pointer-events": "none" }));
      paths.push({ halo, line, len: line.getTotalLength() });
    }
    const totalLen = paths.reduce((a, p) => a + p.len, 0);
    let landfallLen = null;
    if (trk && trk.landfall && paths.length) {
      /* the point along the drawn track nearest the landfall fix */
      const [lx, ly] = project(trk.landfall[0], trk.landfall[1]);
      let best = Infinity;
      let acc = 0;
      for (const p of paths) {
        for (let L = 0; L <= p.len; L += 3) {
          const q = p.line.getPointAtLength(L);
          const dd = (q.x - lx) ** 2 + (q.y - ly) ** 2;
          if (dd < best) { best = dd; landfallLen = acc + L; }
        }
        acc += p.len;
      }
      const ring = svg("g", { class: "landfall", style: { cursor: "default" } }, [
        svg("circle", { cx: lx, cy: ly, r: 7, fill: "none", stroke: col, "stroke-width": 2.2 }),
        svg("circle", { cx: lx, cy: ly, r: 2, fill: col }),
      ]);
      ring.addEventListener("mousemove", (ev) => tip.show(ev, { title: `${s.name} ${s.season}`,
        rows: [[s.landfall_source === "landfall_record" ? "Strongest Florida landfall" : "Nearest fix to the coast (no landfall)", `${fmt.dateLabel(s.fl_landfall_time)}, ${fmt.num(s.fl_landfall_vmax_kt, 0)} kt`],
          ["Peak intensity", `${fmt.num(s.peak_vmax_kt, 0)} kt`], ["FEMA declaration", `DR-${String(s.disaster_numbers).split(";")[0]}`]] }));
      ring.addEventListener("mouseleave", tip.hide);
      f.add(ring);
      paths.ring = ring;
    }
    /* where along the track each county is reached: the length at which
       the track passes nearest its centroid */
    const reach = new Map();
    if (paths.length) {
      const samples = [];
      let acc = 0;
      for (const p of paths) {
        for (let L = 0; L <= p.len; L += 6) { const q = p.line.getPointAtLength(L); samples.push([q.x, q.y, acc + L]); }
        acc += p.len;
      }
      for (const [fips, [cx, cy]] of centers) {
        let best = Infinity;
        let at = 0;
        for (const [x, y, L] of samples) { const dd = (x - cx) ** 2 + (y - cy) ** 2; if (dd < best) { best = dd; at = L; } }
        reach.set(fips, at);
      }
    }
    const glyph = paths.length ? f.add(hurricaneGlyph(0, 0, 16, col)) : null;

    function pointAt(L) {
      let acc = 0;
      for (const p of paths) {
        if (L <= acc + p.len) return p.line.getPointAtLength(Math.max(0, L - acc));
        acc += p.len;
      }
      const last = paths[paths.length - 1];
      return last.line.getPointAtLength(last.len);
    }
    function frame(progress) {
      const L = progress * totalLen;
      let acc = 0;
      for (const p of paths) {
        const shown = Math.max(0, Math.min(p.len, L - acc));
        for (const n of [p.halo, p.line]) {
          n.setAttribute("stroke-dasharray", `${p.len} ${p.len}`);
          n.setAttribute("stroke-dashoffset", `${p.len - shown}`);
        }
        acc += p.len;
      }
      if (glyph) {
        const q = pointAt(L);
        glyph.setAttribute("transform", `translate(${q.x.toFixed(1)},${q.y.toFixed(1)})`);
      }
      if (paths.ring) paths.ring.setAttribute("opacity", landfallLen !== null && L >= landfallLen ? 1 : 0);
      for (const c of countyNodes) {
        const on = !paths.length || L >= (reach.get(c.fips) || 0) - totalLen * 0.04;
        c.node.setAttribute("fill", on ? c.final : NODATA);
      }
      for (const c of circleNodes) {
        const on = !paths.length || L >= (reach.get(c.fips) || 0) - totalLen * 0.04;
        c.node.setAttribute("opacity", on ? 1 : 0);
      }
    }
    if (!animate || reduced || !paths.length) {
      frame(1);
    } else {
      const t0 = performance.now();
      const step = (now) => {
        const p = Math.min(1, (now - t0) / ANIM_MS);
        frame(p < 1 ? 1 - (1 - p) ** 2 : 1);
        if (p < 1) state.anim = requestAnimationFrame(step); else state.anim = null;
      };
      frame(0);
      state.anim = requestAnimationFrame(step);
      setTimeout(() => { if (state.anim) { cancelAnimationFrame(state.anim); state.anim = null; frame(1); } }, ANIM_MS + 300);
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
    const term = (text, note) => {
      const n = el("span", { text, style: { borderBottom: "1px dotted currentColor", cursor: "help" } });
      n.addEventListener("mousemove", (ev) => tip.show(ev, { title: text, note }));
      n.addEventListener("mouseleave", tip.hide);
      return n;
    };
    clear(legendHost).append(sv, el("div.legend", {}, [
      el("span.item", {}, [el("span", { text: "Heavy outline: " }), term("county passing the damage rule, the analysis sample", RULE)]),
      el("span.item", {}, [el("span", { text: "Dotted outline: " }), term("declared county analyzed under this storm", TERMS.analyzed)]),
      el("span.item", { text: "Gray: not analyzed under this storm" }),
      el("span.item", {}, [el("span.dot", { style: { background: PINK, opacity: .6 } }), el("span", { text: ` Circles: ${CIRCLES[state.circle]} in every analyzed county` })]),
      el("span.item", {}, [hurricaneSwatch(color(state.storm)), el("span", { text: " Track as a curve through the 6-hourly fixes; ring at the strongest Florida landfall" })]),
    ]));
  }
  function hurricaneSwatch(col) {
    const sv = svg("svg", { width: 18, height: 18, viewBox: "-9 -9 18 18" });
    sv.appendChild(hurricaneGlyph(0, 0, 8, col));
    return sv;
  }

  function renderSide() {
    clear(side);
    const s = catalog.find((q) => q.storm === state.storm);
    const tot = app.storms.totals.find((q) => q.storm === state.storm);
    const rows = rowsOf();
    const analyzed = [...rows.values()].filter((r) => r.is_primary).length;
    const dl = el("dl");
    const add = (k, v, note) => {
      const dt = el("dt", { text: k });
      if (note) {
        dt.style.cursor = "help";
        dt.style.textDecoration = "underline dotted";
        dt.addEventListener("mousemove", (ev) => tip.show(ev, { title: k, note }));
        dt.addEventListener("mouseleave", tip.hide);
      }
      dl.append(dt, el("dd", { text: v }));
    };
    if (!state.pinned) {
      side.append(el("h4", { text: `${s.name} ${s.season}` }));
      add(s.landfall_source === "landfall_record" ? "Strongest Florida landfall" : "Nearest fix to the coast", `${fmt.dateLabel(s.fl_landfall_time)}, ${fmt.num(s.fl_landfall_vmax_kt, 0)} kt`, TERMS.landfall);
      add("Declared counties", fmt.count(s.n_ia_counties), TERMS.declared);
      add("Analyzed under this storm", `${fmt.count(analyzed)} (dotted outline)`, TERMS.analyzed);
      if (tot) add("Passing the damage rule", `${fmt.count(tot.damage_counties)} (heavy outline, the analysis sample)`, RULE);
      add("Roll pair", `${s.pre_roll} to ${String(s.post_rolls).split(";")[0]}`, TERMS.rollpair);
      add("Post-storm rolls", String(s.n_post_rolls), TERMS.rolls);
      add("Damage measure", s.damage_measure === "jv_only" ? "just value and removal only" : "deleted value, just value and removal", TERMS.measure);
      if (tot) {
        add("Pre-storm structures, analyzed counties", fmt.count(tot.structures), TERMS.structures);
        add("Severe losses, analyzed counties", fmt.count(tot.substantial), SEVERE);
        add("Excess over the routine rate", fmt.count(Math.max(0, tot.excess_substantial)), TERMS.excess);
        add("FEMA destroyed dwellings", fmt.count(tot.ihp_destroyed), TERMS.fema);
      }
      side.append(dl);
      return;
    }
    const c = app.geo.counties.find((q) => q.fips === state.pinned);
    side.append(el("h4", { text: `${c.name} County, ${s.name} ${s.season}` }));
    const r = rows.get(state.pinned);
    const notes = { "Passes the damage rule": RULE, "Severe losses": SEVERE, "Excess over routine": TERMS.excess, "Analyzed under": TERMS.analyzed, "Distance to the track": TERMS.distance, "FEMA destroyed dwellings": TERMS.fema };
    for (const [k, v] of rowsFor(c, r)) add(k, v, notes[k]);
    side.append(dl);
  }

  cap.textContent = "Every county is analyzed under one storm per season, the one whose track passed closest; only the counties passing the damage rule (heavy outline) enter the analysis, and a severe loss is a structure removed, written down by half or more, or with just value below half on the first post-storm roll.";

  draw(true);
  renderSide();

  const steps = catalog.map((s) => {
    const tot = app.storms.totals.find((q) => q.storm === s.storm);
    return {
      cap: tot ? `${s.name} ${s.season}: ${fmt.count(tot.substantial)} severe losses; ${tot.damage_counties} ${tot.damage_counties === 1 ? "county passes" : "counties pass"} the damage rule` : `${s.name} ${s.season}`,
      ms: ANIM_MS + 1400,
      run: (c) => { state.storm = s.storm; state.pinned = null; seg.setValue(s.storm); draw(true); renderSide(); return c.sleep(ANIM_MS + 1400); },
    };
  });
  tour({ name: "the sixteen storms", steps, loops: 1, rest: () => {} }).attach(tourHost);
}
