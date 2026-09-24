/* The redevelopment threshold (Fig. 5): exit by the fourth post-storm
   roll against the structure value a hurricane left relative to the
   value of the lot, after Ian, Michael and Irma; the same rate on the
   plane of the two parts of the index among damaged houses, pooled;
   and how the houses left, replaced or cleared, for one storm. The
   side card carries the model estimates and the income check. */

import { el, svg, clear, control, segmented } from "../lib/dom.js";
import { figure, axisX, axisY, linePath } from "../lib/chart.js";
import { linear, log } from "../lib/scale.js";
import * as fmt from "../lib/format.js";
import { INK, MUTED, GRID, RULE, REC, STORM_INK, NAVY } from "../lib/palette.js";
import * as tip from "../lib/tooltip.js";
import { tour } from "../lib/tour.js";

const W = 720;
const STORMS = ["ian_2022", "michael_2018", "irma_2017"];

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (a, b, t) => "#" + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, "0")).join("");
const ramp = (t) => mix(hex("#f2f0ec"), hex(NAVY), Math.max(0, Math.min(1, t)));

export function thresholdChart(host, app) {
  const meta = app.meta;
  const T = app.threshold;
  const bins = T.bins;
  const state = { storm: "ian_2022" };

  const tourHost = el("div");
  const figA = el("div.figure");
  const legend = el("div.legend");
  const row = el("div", { style: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: ".8rem", marginTop: ".8rem" } });
  const figB = el("div.figure");
  const colC = el("div");
  const bar = el("div.controls");
  const figC = el("div.figure");
  colC.append(bar, figC);
  row.append(figB, colC);
  const side = el("div.sidecard");
  const cap = el("p.caption");
  clear(host).append(tourHost, el("div.panelgrid", { style: { gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)" } }, [el("div", {}, [figA, legend, row]), side]), cap);

  const marks = new Map();
  const lineNodes = [];
  const reg = (s, n) => { if (!marks.has(s)) marks.set(s, []); marks.get(s).push(n); return n; };
  const ink = (s) => STORM_INK[s] || { color: "#8c8c8c", dash: "" };

  /* (a) exit by roll 4 along the index, log scale */
  {
    const f = figure(figA, { width: W, height: 300, margin: { top: 30, right: 70, bottom: 50, left: 54 }, label: "Exit by roll 4 along the index" });
    const x = linear([0, bins.length - 1], [0, f.w]);
    const all = T.curve.filter((r) => r.exit4 > 0);
    const y = log([Math.min(...all.map((r) => r.exit4)) / 1.5, 0.9], [f.h, 0]);
    axisX(f, x, { values: bins.map((b, i) => i), format: (i) => bins[i], label: "Structure value left over land value (bins of the index)" });
    axisY(f, y, { values: [0.001, 0.01, 0.1, 0.5], format: (v) => fmt.pct(v, v < 0.01 ? 1 : 0), label: "Exited by roll 4 (%, log)" });
    f.add(svg("text", { x: -54, y: -14, "font-size": 11, fill: INK, "font-weight": 600, text: "(a) Exit by the fourth roll along the index, all own-lot houses" }));
    const eq = bins.indexOf("1 to 2.5") - 0.5;
    const l1 = svg("line", { x1: x(eq), x2: x(eq), y1: 0, y2: f.h, stroke: MUTED, "stroke-dasharray": "3 2" });
    const l2 = svg("text", { x: x(eq) - 4, y: 12, "text-anchor": "end", "font-size": 9.5, fill: MUTED, text: "structure worth less than the lot" });
    const l3 = svg("text", { x: x(eq) + 4, y: 12, "font-size": 9.5, fill: MUTED, text: "more than the lot" });
    f.add(l1); f.add(l2); f.add(l3);
    lineNodes.push(l1, l2, l3);
    const nmax = Math.max(...T.curve.map((r) => r.n));
    for (const s of [...STORMS, "pooled"]) {
      const pts = T.curve.filter((r) => r.storm === s && r.exit4 > 0).map((r) => ({ ...r, i: bins.indexOf(r.ratio_bin) }));
      const col = ink(s);
      const path = reg(s, svg("path", { d: linePath(pts, (p) => x(p.i), (p) => y(p.exit4)), fill: "none", stroke: col.color,
        "stroke-width": s === "pooled" ? 1.2 : 1.8, "stroke-dasharray": col.dash || null, "stroke-linejoin": "round" }));
      f.add(path);
      for (const p of pts) {
        const r = s === "pooled" ? 2 : 2 + 6 * Math.sqrt(p.n / nmax);
        const dot = reg(s, svg("circle", { cx: x(p.i), cy: y(p.exit4), r, fill: s === "pooled" ? "#fff" : col.color, stroke: col.color, "stroke-width": 1 }));
        dot.addEventListener("pointerenter", (e) => tip.show(e, {
          title: `${meta.storms[s]}, index ${p.ratio_bin}`,
          rows: [["Exited by roll 4", fmt.pct(p.exit4, 1)], ["Replaced", fmt.pct(p.replaced4, 1)], ["Cleared", fmt.pct(p.cleared4, 1)],
            ["Houses in the bin", fmt.count(p.n)], ["of them damaged", fmt.count(p.n_damaged)]],
        }));
        dot.addEventListener("pointermove", tip.move);
        dot.addEventListener("pointerleave", tip.hide);
        f.add(dot);
      }
      const last = pts[pts.length - 1];
      f.add(reg(s, svg("text", { x: x(last.i) + 8, y: y(last.exit4) + 3, "font-size": 9.5, fill: col.color, text: meta.storms[s].split(" ")[0] === "Three" ? "pooled" : meta.storms[s].split(" ")[0] })));
    }
  }
  for (const s of [...STORMS, "pooled"]) {
    const col = ink(s);
    legend.appendChild(el("span.item", {}, [svg("svg", { width: 26, height: 10, viewBox: "0 0 26 10" }, [
      svg("line", { x1: 1, x2: 25, y1: 5, y2: 5, stroke: col.color, "stroke-width": 2, "stroke-dasharray": col.dash || null })]),
    el("span", { text: s === "pooled" ? "three storms pooled" : meta.storms[s] })]));
  }
  legend.appendChild(el("span.item", { text: "Marker area grows with the number of houses in the bin" }));

  /* (b) the plane: value left by land share, damaged houses, pooled */
  const gridNodes = [];
  {
    const vb = T.grid_bins.value_left;
    const lb = T.grid_bins.land_share;
    const f = figure(figB, { width: 340, height: 320, margin: { top: 30, right: 10, bottom: 50, left: 70 }, label: "Exit on the plane of value left and land share" });
    const cw = f.w / lb.length;
    const chh = f.h / vb.length;
    f.add(svg("text", { x: -62, y: -14, "font-size": 11, fill: INK, "font-weight": 600, text: "(b) Damaged houses, three storms pooled" }));
    const vmax = Math.max(...T.grid.map((r) => r.exit4));
    for (const r of T.grid) {
      const i = lb.indexOf(r.land_share_bin);
      const j = vb.indexOf(r.value_left_bin);
      const g = svg("g", { class: "cell" });
      const fill = ramp(r.exit4 / vmax);
      g.appendChild(svg("rect", { x: i * cw, y: f.h - (j + 1) * chh, width: cw - 1, height: chh - 1, fill }));
      g.appendChild(svg("text", { x: i * cw + cw / 2, y: f.h - (j + 1) * chh + chh / 2 + 1, "text-anchor": "middle", "font-size": 9.5,
        fill: r.exit4 / vmax > .55 ? "#fff" : INK, text: fmt.num(100 * r.exit4, 0) }));
      g.appendChild(svg("text", { x: i * cw + cw / 2, y: f.h - (j + 1) * chh + chh / 2 + 11, "text-anchor": "middle", "font-size": 7.5,
        fill: r.exit4 / vmax > .55 ? "#fff" : MUTED, text: `(${fmt.count(r.n)})` }));
      g.addEventListener("pointerenter", (e) => tip.show(e, {
        title: `Value left ${r.value_left_bin}, land share ${r.land_share_bin}`,
        rows: [["Exited by roll 4", fmt.pct(r.exit4, 1)], ["Replaced", fmt.pct(r.replaced4, 1)], ["Cleared", fmt.pct(r.cleared4, 1)], ["Houses", fmt.count(r.n)]],
      }));
      g.addEventListener("pointermove", tip.move);
      g.addEventListener("pointerleave", tip.hide);
      f.add(g);
      gridNodes.push(g);
    }
    lb.forEach((b, i) => f.add(svg("text", { x: i * cw + cw / 2, y: f.h + 12, "text-anchor": "middle", "font-size": 8.5, fill: MUTED, text: b })));
    vb.forEach((b, j) => f.add(svg("text", { x: -6, y: f.h - j * chh - chh / 2 + 3, "text-anchor": "end", "font-size": 8.5, fill: MUTED, text: b })));
    f.add(svg("text", { x: f.w / 2, y: f.h + 30, "text-anchor": "middle", "font-size": 10, fill: MUTED, text: "Land share of pre-storm just value" }));
    f.add(svg("text", { transform: `translate(-52,${f.h / 2}) rotate(-90)`, "text-anchor": "middle", "font-size": 10, fill: MUTED, text: "Structure value left, share of just value" }));
  }

  /* (c) how the houses left, one storm */
  function drawSplit() {
    const pts = T.curve.filter((r) => r.storm === state.storm).map((r) => ({ ...r, i: bins.indexOf(r.ratio_bin) }));
    const f = figure(figC, { width: 340, height: 250, margin: { top: 30, right: 10, bottom: 50, left: 44 }, label: "Replaced or cleared" });
    const x = linear([-0.5, bins.length - 0.5], [0, f.w]);
    const ymax = Math.max(...pts.map((p) => p.exit4)) * 1.1;
    const y = linear([0, ymax], [f.h, 0]);
    axisX(f, x, { values: bins.map((b, i) => i), format: (i) => bins[i].replace(" to ", "-").replace("under ", "<").replace("over ", ">"), label: "Index bin" });
    axisY(f, y, { format: (v) => fmt.pct(v, 0), label: "Exited by roll 4 (%)" });
    f.add(svg("text", { x: -44, y: -14, "font-size": 11, fill: INK, "font-weight": 600, text: `(c) How they left, ${meta.storms[state.storm]}` }));
    const bw = (f.w / bins.length) * 0.7;
    for (const p of pts) {
      const cx = x(p.i);
      const g = svg("g");
      g.appendChild(svg("rect", { x: cx - bw / 2, y: y(p.replaced4), width: bw, height: f.h - y(p.replaced4), fill: REC.replaced }));
      g.appendChild(svg("rect", { x: cx - bw / 2, y: y(p.replaced4 + p.cleared4), width: bw, height: y(p.replaced4) - y(p.replaced4 + p.cleared4), fill: REC.cleared }));
      if (p.exit4 >= 0.01) g.appendChild(svg("text", { x: cx, y: y(p.exit4) - 3, "text-anchor": "middle", "font-size": 8.5, fill: INK, text: fmt.num(100 * p.exit4, 0) }));
      g.addEventListener("pointerenter", (e) => tip.show(e, { title: `${meta.storms[state.storm]}, index ${p.ratio_bin}`,
        rows: [["Replaced", fmt.pct(p.replaced4, 1)], ["Cleared", fmt.pct(p.cleared4, 1)], ["Houses", fmt.count(p.n)]] }));
      g.addEventListener("pointermove", tip.move);
      g.addEventListener("pointerleave", tip.hide);
      f.add(g);
    }
    f.add(svg("rect", { x: f.w - 150, y: 4, width: 8, height: 8, fill: REC.replaced }));
    f.add(svg("text", { x: f.w - 138, y: 11, "font-size": 9, fill: MUTED, text: "replaced" }));
    f.add(svg("rect", { x: f.w - 92, y: 4, width: 8, height: 8, fill: REC.cleared }));
    f.add(svg("text", { x: f.w - 80, y: 11, "font-size": 9, fill: MUTED, text: "cleared, still empty" }));
  }
  const seg = segmented(STORMS.map((s) => ({ key: s, label: meta.storms[s].split(" ")[0] })), state.storm, (v) => { state.storm = v; drawSplit(); });
  bar.appendChild(control("Storm", seg));
  drawSplit();

  /* side: models */
  side.appendChild(el("h4", { text: "One log unit of the index" }));
  const tbl = el("table.dtable");
  tbl.appendChild(el("thead", {}, [el("tr", {}, ["Storm", "Exit", "Replaced", "Cleared", "n"].map((t) => el("th", { text: t })))]));
  const tb = el("tbody");
  const cell = (s, o) => {
    const r = T.models.find((q) => q.storm === s && q.term === "log_ratio" && q.outcome === o);
    return r ? `${fmt.num(100 * r.coef, 1)}${r.p < 0.001 ? "***" : r.p < 0.01 ? "**" : r.p < 0.05 ? "*" : ""}` : "";
  };
  for (const s of [...STORMS, "pooled"]) {
    const n = T.models.find((q) => q.storm === s && q.term === "log_ratio" && q.outcome === "exit4");
    tb.appendChild(el("tr", {}, [el("td", { text: s === "pooled" ? "Pooled" : meta.storms[s] }), el("td", { text: cell(s, "exit4") }),
      el("td", { text: cell(s, "replaced4") }), el("td", { text: cell(s, "cleared4") }), el("td", { text: n ? fmt.count(n.n) : "" })]));
  }
  tbl.appendChild(tb);
  side.appendChild(tbl);
  side.appendChild(el("p.note", { text: "Percentage points of the probability by roll 4 per natural-log unit of structure value left over land value, among damaged houses; linear probability, county-storm fixed effects, controls for pre-1994 vintage, log pre-storm just value and homestead, errors clustered by tract. *** p < .001, ** p < .01, * p < .05." }));

  side.appendChild(el("h4", { text: "Tract income, one standard deviation", style: { marginTop: "1rem" } }));
  const inc = T.income;
  const t2 = el("table.dtable");
  t2.appendChild(el("thead", {}, [el("tr", {}, ["Storm", "Outcome", "Alone", "With the index"].map((t) => el("th", { text: t })))]));
  const tb2 = el("tbody");
  const stormsInc = [...new Set(inc.map((r) => r.storm))];
  for (const s of stormsInc) for (const o of ["exit4", "replaced4"]) {
    const a = inc.find((r) => r.storm === s && r.outcome === o && r.spec === "income only");
    const b = inc.find((r) => r.storm === s && r.outcome === o && r.spec !== "income only");
    if (!a || !b) continue;
    tb2.appendChild(el("tr", {}, [el("td", { text: s === "pooled" ? "Pooled" : meta.storms[s] }), el("td", { text: o === "exit4" ? "Exit" : "Replaced" }),
      el("td", { text: `${fmt.num(100 * a.coef, 1)} (${fmt.num(100 * a.se, 1)})` }), el("td", { text: `${fmt.num(100 * b.coef, 1)} (${fmt.num(100 * b.se, 1)})` })]));
  }
  t2.appendChild(tb2);
  side.appendChild(t2);
  side.appendChild(el("p.note", { text: "Percentage points (standard error) per standard deviation of log tract median household income; an area measure of household financing capacity, silent on the individual owner." }));
  const sf = T.sfha.find((r) => r.term === "above_x_sfha");
  if (sf) side.appendChild(el("p.note", { text: `The one-half rule of the flood program leaves no visible trace: among own-lot houses in Ian’s counties, being above the line inside the flood hazard area changes exit by ${fmt.num(100 * sf.coef, 1)} points (standard error ${fmt.num(100 * sf.se, 1)}), too imprecise to show that the rule had no effect.` }));

  cap.textContent = "Site-built houses on their own lot with at least four post-storm rolls in the damage counties of the three storms whose rolls record deleted value; every bin and cell holds at least 50 houses. Read each line in (a) from right to left: where the structure left is worth more than the lot, exit stays near the background rate, and it rises about a hundredfold as less structure is left. The index orders houses within a storm but does not explain the gap between storms; houses written down to nothing and later restored, mostly after Ian, exit less than houses with a little value left, which is roll bookkeeping.";

  /* tour */
  function light(key) {
    for (const [s, nodes] of marks) for (const n of nodes) n.classList.toggle("dim", key !== null && key !== "line" && key !== "grid" && s !== key);
    for (const n of lineNodes) n.classList.toggle("lit", key === "line");
    figB.classList.toggle("dim", key !== null && key !== "grid");
    colC.classList.toggle("dim", key !== null && key !== "split");
    figA.classList.toggle("dim", key === "grid" || key === "split");
  }
  const ov = app.overview.threshold;
  const steps = STORMS.map((s) => ({
    cap: `${meta.storms[s]}: exit falls from ${fmt.pct(ov[s].exit_lowest, 1)} to ${fmt.pct(ov[s].exit_highest, 1)} along the index`,
    ms: 2600, run: (c) => { light(s); return c.sleep(2600); },
  }));
  steps.push({ cap: "Where the structure left is worth more than the lot, exit is at the background rate", ms: 2400, run: (c) => { light("line"); return c.sleep(2400); } });
  steps.push({ cap: "The two parts of the index: exit rises with land share at every level of value left", ms: 2800, run: (c) => { light("grid"); return c.sleep(2800); } });
  steps.push({ cap: "Clearing responds about twice as strongly as replacement", ms: 2400, run: (c) => { light("split"); return c.sleep(2400); } });
  steps.push({ cap: "Three storms and the pooled line", ms: 1800, run: (c) => { light(null); return c.sleep(1800); } });
  tour({ name: "the redevelopment threshold", steps, rest: () => light(null), after: () => {} }).attach(tourHost);
}
