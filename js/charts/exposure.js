/* What each pathway exposed to the next hurricane (Figs. 6 and 7): the
   recovery plane, value exposed against the share of value deleted,
   each pathway as a ratio to intact structures of the same tracts;
   every adjusted estimate of the difference from intact in the
   probability of severe loss; and the Charley cohort of Lee County at
   Ian, house by house. Raw rates and stakes live in the tooltips. */

import { el, svg, clear, control, chips } from "../lib/dom.js";
import { figure, axisX, axisY, hurricaneGlyph } from "../lib/chart.js";
import { linear, log } from "../lib/scale.js";
import { pathOf, projector, smoothTrackPath, trackPieces, mainPass } from "../lib/geo.js";
import * as fmt from "../lib/format.js";
import { INK, MUTED, GRID, RULE, LAND, REC, REC_LABEL, GRAY_DARK } from "../lib/palette.js";
import * as tip from "../lib/tooltip.js";
import { tour } from "../lib/tour.js";

const CLASSES = ["less_documented", "documented_repair", "replaced", "new_build"];
const PAIRS = ["charley_to_ian", "irma_to_ian"];
const BBOX = [-82.45, -81.55, 26.32, 26.85];

function marker(cls, x, y, r) {
  const color = REC[cls];
  const open = cls === "new_build";
  const c = { fill: open ? "#fff" : color, stroke: open ? color : "#fff", "stroke-width": open ? 1.2 : .6 };
  if (cls === "less_documented") return svg("circle", { cx: x, cy: y, r, ...c });
  if (cls === "documented_repair") return svg("rect", { x: x - r, y: y - r, width: 2 * r, height: 2 * r, ...c });
  return svg("path", { d: `M${x},${y - r - 1}L${x + r + 1},${y}L${x},${y + r + 1}L${x - r - 1},${y}Z`, ...c });
}

export function exposureChart(host, app) {
  const meta = app.meta;
  const E = app.exposure;
  const rate = (pair, cls) => E.rates.find((r) => r.pair === pair && r.class_key === cls);
  const rob = (pair, cls) => E.robustness.find((r) => r.pair === pair && r.class_key === cls);
  const stakes = (pair, cls) => E.stakes.find((r) => r.pair === pair && r.class_label === REC_LABEL[cls]);
  const rateRows = (pair, cls) => {
    const r = rate(pair, cls);
    const i = rate(pair, "intact");
    const out = [];
    if (r && i) out.push([`Severe loss at ${meta.pairs[pair].split(" to ")[1]}, raw`, `${fmt.pct(r.y_published_per100 / 100, 1)} of ${fmt.count(r.n)}, against ${fmt.pct(i.y_published_per100 / 100, 1)} of ${fmt.count(i.n)} intact`]);
    const b = rob(pair, cls);
    if (b) out.push(["Adjusted difference from intact", `median ${fmt.num(100 * b.median, 1)} points; ${b.n_p_below_05} of ${b.n_specs} estimates at p < .05`]);
    const s = stakes(pair, cls);
    if (s) out.push(["Share of the stock, of severe losses, of value deleted", `${fmt.num(s.share_stock_pct, 2)}%, ${fmt.num(s.share_severe_pct, 2)}%, ${fmt.num(s.share_value_deleted_pct, 2)}%`]);
    return out;
  };

  const tourHost = el("div");
  const figA = el("div.figure");
  const figB = el("div.figure");
  const legend = el("div.legend");
  const mapBar = el("div.controls");
  const figMap = el("div.figure");
  const mapLegend = el("div.legend");
  const cap = el("p.caption");
  clear(host).append(tourHost,
    el("div.panelgrid", { style: { gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)" } }, [el("div", {}, [figA, legend]), figB]),
    el("div", { style: { marginTop: "1.4rem", paddingTop: "1rem", borderTop: "1px solid var(--rule-soft)" } }, [mapBar, figMap, mapLegend]),
    cap);

  const marks = new Map();
  const reg = (cls, n) => { if (!marks.has(cls)) marks.set(cls, []); marks.get(cls).push(n); return n; };

  /* (a) the recovery plane */
  {
    const rows = E.decomposition.filter((r) => r.frame === "same tract" && CLASSES.includes(r.class_key));
    const f = figure(figA, { width: 420, height: 340, margin: { top: 30, right: 20, bottom: 50, left: 58 }, label: "The recovery plane" });
    const x = log([0.5, 8], [0, f.w]);
    const y = log([0.2, 4], [f.h, 0]);
    axisX(f, x, { values: [0.5, 1, 2, 4, 8], format: (v) => fmt.num(v, v < 1 ? 1 : 0), label: "Value exposed per structure, ratio to intact (log)" });
    axisY(f, y, { values: [0.25, 0.5, 1, 2, 4], format: (v) => fmt.num(v, v < 1 ? 2 : 0), label: "Share of value deleted, ratio to intact (log)" });
    f.add(svg("text", { x: -58, y: -14, "font-size": 11, fill: INK, "font-weight": 600, text: "Value exposed against the share of it lost, by pathway" }));
    f.add(svg("line", { x1: 0, x2: f.w, y1: y(1), y2: y(1), stroke: MUTED, "stroke-dasharray": "3 2" }));
    f.add(svg("line", { x1: x(1), x2: x(1), y1: 0, y2: f.h, stroke: MUTED, "stroke-dasharray": "3 2" }));
    for (const d of [0.5, 1, 2]) {
      const pts = [];
      for (let v = 0.5; v <= 8; v *= 1.15) { const s = d / v; if (s >= 0.2 && s <= 4) pts.push(`${x(v).toFixed(1)},${y(s).toFixed(1)}`); }
      f.add(svg("path", { d: `M${pts.join("L")}`, fill: "none", stroke: RULE, "stroke-width": d === 1 ? 1.2 : .8 }));
      const v0 = Math.min(8, Math.max(0.5, d / 0.22));
      f.add(svg("text", { x: x(v0) - 4, y: y(Math.min(4, d / v0)) - 3, "text-anchor": "end", "font-size": 8.5, fill: MUTED, text: `dollars ${fmt.num(d, d < 1 ? 1 : 0)}x intact` }));
    }
    for (const r of rows) {
      const big = r.pair === "charley_to_ian";
      const m = reg(r.class_key, marker(r.class_key, x(r.ratio_value), y(r.ratio_vulnerability), big ? 7 : 4.5));
      m.style.cursor = "default";
      m.addEventListener("pointerenter", (e) => tip.show(e, {
        title: `${REC_LABEL[r.class_key]}, ${meta.pairs[r.pair]}`,
        rows: [["Value exposed, ratio to intact", fmt.num(r.ratio_value, 2)], ["Share of value deleted, ratio", fmt.num(r.ratio_vulnerability, 2)],
          ["Dollars deleted per structure, ratio", fmt.num(r.ratio_dollars, 2)], ["Structures", `${fmt.count(r.n_class)} against ${fmt.count(r.n_intact)} intact`],
          ...rateRows(r.pair, r.class_key)],
        note: "Intact structures of the same tracts, reweighted to the pathway's tract mix; associations, not effects of repairing or replacing.",
      }));
      m.addEventListener("pointermove", tip.move);
      m.addEventListener("pointerleave", tip.hide);
      f.add(m);
    }
  }
  for (const c of CLASSES) {
    const sw = svg("svg", { width: 16, height: 16, viewBox: "0 0 16 16" }, [marker(c, 8, 8, 5)]);
    legend.appendChild(el("span.item", {}, [sw, el("span", { text: REC_LABEL[c] })]));
  }
  legend.appendChild(el("span.item", { text: "Large marker: Charley 2004 to Ian 2022; small: Irma 2017 to Ian 2022; intact structures sit at 1, 1" }));

  /* (b) every adjusted estimate */
  {
    const est = E.estimates.filter((r) => CLASSES.includes(r.class_key));
    const strips = [];
    for (const c of CLASSES) for (const p of PAIRS) {
      const rs = est.filter((r) => r.class_key === c && r.pair === p);
      if (rs.length) strips.push({ cls: c, pair: p, rs });
    }
    const ROWH = 34;
    const f = figure(figB, { width: 380, height: strips.length * ROWH + 80, margin: { top: 30, right: 40, bottom: 44, left: 128 }, label: "Every adjusted estimate" });
    const vals = est.map((r) => 100 * r.estimate);
    const x = linear([Math.min(-6, Math.min(...vals) - 2), Math.max(...vals) + 2], [0, f.w]);
    axisX(f, x, { grid: true, format: (v) => fmt.num(v, 0), label: "Difference from intact, severe loss (points)" });
    f.add(svg("text", { x: -128, y: -14, "font-size": 11, fill: INK, "font-weight": 600, text: "Every adjusted estimate, one tick each" }));
    f.add(svg("line", { x1: x(0), x2: x(0), y1: 0, y2: f.h, stroke: INK, "stroke-width": 1 }));
    strips.forEach((s, i) => {
      const yc = i * ROWH + ROWH / 2;
      const col = REC[s.cls];
      f.add(reg(s.cls, svg("text", { x: -8, y: yc - 2, "text-anchor": "end", "font-size": 10, fill: INK, text: REC_LABEL[s.cls] })));
      f.add(reg(s.cls, svg("text", { x: -8, y: yc + 9, "text-anchor": "end", "font-size": 9, fill: MUTED, text: meta.pairs[s.pair] })));
      if (i) f.add(svg("line", { x1: -128, x2: f.w, y1: i * ROWH, y2: i * ROWH, stroke: GRID }));
      const sorted = s.rs.map((r) => 100 * r.estimate).sort((a, b) => a - b);
      const med = sorted[Math.floor(sorted.length / 2)];
      const sig = s.rs.filter((r) => r.p < 0.05).length;
      for (const r of s.rs) {
        const h = r.p < 0.05 ? 10 : 5;
        f.add(reg(s.cls, svg("line", { x1: x(100 * r.estimate), x2: x(100 * r.estimate), y1: yc + 4 - h, y2: yc + 4 + h, stroke: col, "stroke-width": 1.3 })));
        const hit = svg("rect", { x: x(100 * r.estimate) - 3, y: yc - 10, width: 6, height: 26, fill: "transparent" });
        hit.addEventListener("pointerenter", (e) => tip.show(e, {
          title: `${REC_LABEL[s.cls]}, ${meta.pairs[s.pair]}`,
          rows: [["Estimate", `${fmt.num(100 * r.estimate, 1)} points`], ["Standard error", fmt.num(100 * r.se, 1)], ["p", fmt.pval(r.p)],
            ["Design", r.design], ["Sample", r.sample], ["n", `${fmt.count(r.n)} (${fmt.count(r.n_treated)} in the class)`], ...rateRows(s.pair, s.cls)],
        }));
        hit.addEventListener("pointermove", tip.move);
        hit.addEventListener("pointerleave", tip.hide);
        f.add(hit);
      }
      f.add(reg(s.cls, marker(s.cls, x(med), yc - 10, 3.5)));
      f.add(reg(s.cls, svg("text", { x: f.w + 6, y: yc + 4, "font-size": 9.5, fill: MUTED, text: `${sig} of ${s.rs.length}` })));
    });
    f.add(svg("text", { x: f.w + 6, y: -4, "font-size": 8.5, fill: MUTED, text: "p < .05" }));
  }

  /* the Lee County map of the Charley cohort at Ian */
  const L = E.lee;
  const rows = L.rows.map((r) => Object.fromEntries(L.columns.map((c, i) => [c, r[i]])));
  const selected = new Set(CLASSES);
  const counties = app.geo.counties.filter((c) => ["12071", "12015", "12021", "12051", "12043", "12027"].includes(c.fips));
  const project = projector(BBOX, 720, 420, 6);
  window.__projection = { bbox: BBOX, w: 720, h: 420, pad: 6, frame: BBOX };
  const mapMarks = new Map();
  function drawMap() {
    mapMarks.clear();
    const f = figure(figMap, { width: 720, height: 420, margin: { top: 4, right: 4, bottom: 4, left: 4 }, label: "Lee County, the Charley cohort at Ian" });
    f.addRoot(svg("defs", {}, [svg("clipPath", { id: "leeclip" }, [svg("rect", { x: 0, y: 0, width: f.w, height: f.h })])]));
    const g = svg("g", { "clip-path": "url(#leeclip)" });
    f.add(g);
    g.appendChild(svg("rect", { x: 0, y: 0, width: f.w, height: f.h, fill: "#f4f6f8" }));
    for (const c of counties) g.appendChild(svg("path", { d: pathOf(c.rings, project), fill: LAND, stroke: "#fff", "stroke-width": .8 }));
    window.__projection.margin = 1.5;
    /* both storms landed on the same island, so each symbol sits a fixed
       distance back along its own approach, where the two tracks differ */
    for (const [key, color, back, dx, dy] of [["charley_2004", GRAY_DARK, 150, 12, 14], ["ian_2022", INK, 150, -14, -10]]) {
      const t = app.geo.tracks[key];
      if (!t) continue;
      for (const run of mainPass(t, trackPieces(t, BBOX, 1.5))) {
        const d = smoothTrackPath(run.map((k) => t.lon[k]), run.map((k) => t.lat[k]), project);
        g.appendChild(svg("path", { d, fill: "none", stroke: "#fff", "stroke-width": 4, opacity: .8 }));
        const line = svg("path", { d, fill: "none", stroke: color, "stroke-width": 1.6, "stroke-dasharray": key === "charley_2004" ? "5 3" : null, "data-track": key });
        g.appendChild(line);
        const len = line.getTotalLength();
        let at = len * 0.4;
        if (t.landfall) {
          const [lx, ly] = project(t.landfall[0], t.landfall[1]);
          let best = Infinity;
          for (let L = 0; L <= len; L += 3) { const q = line.getPointAtLength(L); const dd = (q.x - lx) ** 2 + (q.y - ly) ** 2; if (dd < best) { best = dd; at = L; } }
          at = Math.max(20, at - back);
        }
        const q = line.getPointAtLength(at);
        const eye = hurricaneGlyph(q.x, q.y, 13, color);
        eye.setAttribute("data-eye", key);
        g.appendChild(eye);
        g.appendChild(svg("text", { x: q.x + dx, y: q.y + dy, "text-anchor": dx < 0 ? "end" : "start", "font-size": 10.5, fill: color, "font-weight": 600,
          stroke: "#fff", "stroke-width": 3, "paint-order": "stroke", text: meta.storms[key] }));
      }
    }
    const shown = rows.filter((r) => selected.has(L.classes[r.class])).sort((a, b) => a.severe_ian - b.severe_ian);
    for (const r of shown) {
      const cls = L.classes[r.class];
      const [x, y] = project(r.lon, r.lat);
      const node = svg("circle", { cx: x, cy: y, r: r.severe_ian ? 3 : 2, fill: r.severe_ian ? REC[cls] : "#fff", stroke: REC[cls], "stroke-width": .8, opacity: r.severe_ian ? 1 : .8 });
      if (!mapMarks.has(cls)) mapMarks.set(cls, []);
      mapMarks.get(cls).push(node);
      node.addEventListener("pointerenter", (e) => tip.show(e, { title: `${REC_LABEL[cls]} after Charley`, rows: [
        ["Year built (2022 roll)", r.year_built ?? "n/a"], ["Mobile home", r.mobile ? "yes" : "no"],
        ["Ian outcome", r.severe_ian ? "severe loss" : "no severe loss"], ["Ian deletion share", r.ian_del_share === null ? "n/a" : fmt.num(r.ian_del_share, 2)],
        [`Lee County ${REC_LABEL[cls].toLowerCase()}`, `${fmt.count(L.summary[cls].n)} structures, ${fmt.pct(L.summary[cls].rate, 0)} severe in Ian`],
        ["Intact old stock of the pair's counties", `${fmt.count(L.intact_pair_n)} structures, ${fmt.pct(L.intact_pair_rate, 1)} severe in Ian`]] }));
      node.addEventListener("pointermove", tip.move);
      node.addEventListener("pointerleave", tip.hide);
      g.appendChild(node);
    }
    g.appendChild(svg("text", { x: 10, y: 18, "font-size": 11, fill: INK, "font-weight": 600, text: "Lee County: structures Charley severely damaged, by what stood on the lot when Ian came" }));
    g.appendChild(svg("rect", { x: .5, y: .5, width: f.w - 1, height: f.h - 1, fill: "none", stroke: RULE }));
  }
  mapBar.appendChild(control("Pathway after Charley", chips(CLASSES.map((c) => ({ key: c, label: `${REC_LABEL[c]} (${fmt.count(L.summary[c].n)}, ${fmt.pct(L.summary[c].rate, 0)} severe in Ian)` })), selected, () => drawMap(), { min: 1 })));
  drawMap();
  mapLegend.append(
    el("span.item", {}, [el("span.dot", { style: { background: INK } }), " Filled: severe loss in Ian"]),
    el("span.item", {}, [el("span.dot", { style: { background: "#fff", border: `1px solid ${INK}` } }), " Open: no severe loss"]),
    el("span.item", {}, [el("span.swatch", { style: { background: GRAY_DARK } }), " Charley track"]),
    el("span.item", {}, [el("span.swatch", { style: { background: INK } }), " Ian track"]),
  );

  cap.textContent = "Site-built structures in the counties the second storm damaged against the intact structures of the same tracts, two storm pairs both ending in Ian, associations only; a restored house returns to the vulnerability of the old stock around it, and a replacement loses a smaller share of more value.";

  function light(cls) {
    for (const [c, nodes] of marks) for (const n of nodes) n.classList.toggle("dim", cls !== null && !cls.includes(c));
    for (const [c, nodes] of mapMarks) for (const n of nodes) n.classList.toggle("dim", cls !== null && !cls.includes(c));
  }
  const ov = app.overview.consequence;
  const r = app.overview.rates.charley_to_ian;
  const ld = rob("charley_to_ian", "less_documented");
  const dr = rob("charley_to_ian", "documented_repair");
  const steps = [
    { cap: `Less-documented recovery: ${fmt.pct(r.less_documented.rate, 1)} severe in Ian against ${fmt.pct(r.intact.rate, 1)} of the intact old stock, above intact in ${ld ? `${ld.n_positive} of ${ld.n_specs}` : "every"} estimate${ld ? "s" : ""}`, ms: 3000, run: (c) => { light(["less_documented"]); return c.sleep(3000); } },
    { cap: `Documented repair: ${fmt.pct(r.documented_repair.rate, 1)} raw, p < .05 in ${dr ? `${dr.n_p_below_05} of ${dr.n_specs}` : "few"} adjusted estimates: back at the old stock's risk`, ms: 3000, run: (c) => { light(["documented_repair"]); return c.sleep(3000); } },
    { cap: `Replaced and new build: ${fmt.num(ov.vulnerability[0], 2)} to ${fmt.num(ov.vulnerability[1], 2)} of the intact share lost, on ${fmt.num(ov.value[0], 1)} to ${fmt.num(ov.value[1], 1)} times the value`, ms: 3200, run: (c) => { light(["replaced", "new_build"]); return c.sleep(3200); } },
    { cap: `Dollars deleted per structure: ${fmt.num(ov.dollars[0], 2)} to ${fmt.num(ov.dollars[1], 2)} times intact, so dollar losses do not necessarily fall`, ms: 2600, run: (c) => { light(["replaced", "new_build"]); return c.sleep(2600); } },
    { cap: "Every pathway", ms: 1800, run: (c) => { light(null); return c.sleep(1800); } },
  ];
  tour({ name: "the next-storm exposure", steps, rest: () => light(null), after: () => {} }).attach(tourHost);
}
