/* The redevelopment threshold (Fig. 5): exit by the fourth post-storm
   roll against the structure value a hurricane left relative to the
   value of the lot, after Ian, Michael and Irma; the same rate on the
   plane of the two parts of the index among damaged houses, pooled;
   and how the houses left, replaced or cleared, for one storm. The
   model estimates and the income check live in the tooltips and the
   tour captions. */

import { el, svg, clear, control, segmented } from "../lib/dom.js";
import { figure, axisX, axisY, linePath } from "../lib/chart.js";
import { linear, log } from "../lib/scale.js";
import * as fmt from "../lib/format.js";
import { INK, MUTED, REC, STORM_INK, NAVY } from "../lib/palette.js";
import * as tip from "../lib/tooltip.js";
import { tour } from "../lib/tour.js";

const W = 720;
const STORMS = ["ian_2022", "michael_2018", "irma_2017"];

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (a, b, t) => "#" + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, "0")).join("");
const ramp = (t) => mix(hex("#f2f0ec"), hex(NAVY), Math.max(0, Math.min(1, t)));
const stars = (p) => (p < 0.001 ? "***" : p < 0.01 ? "**" : p < 0.05 ? "*" : "");

export function thresholdChart(host, app) {
  const meta = app.meta;
  const T = app.threshold;
  const bins = T.bins;
  const state = { storm: "ian_2022" };
  const model = (s, o) => T.models.find((q) => q.storm === s && q.term === "log_ratio" && q.outcome === o);
  const income = (s, o, held) => T.income.find((r) => r.storm === s && r.outcome === o && (r.spec === "income only") === !held);

  const tourHost = el("div");
  const figA = el("div.figure");
  const legend = el("div.legend");
  const row = el("div", { style: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "1rem", marginTop: "1rem" } });
  const figB = el("div.figure");
  const colC = el("div");
  const bar = el("div.controls");
  const figC = el("div.figure");
  colC.append(bar, figC);
  row.append(figB, colC);
  const cap = el("p.caption");
  clear(host).append(tourHost, figA, legend, row, cap);

  const marks = new Map();
  const lineNodes = [];
  const reg = (s, n) => { if (!marks.has(s)) marks.set(s, []); marks.get(s).push(n); return n; };
  const ink = (s) => STORM_INK[s] || { color: "#8c8c8c", dash: "" };
  const modelRows = (s) => {
    const out = [];
    for (const [o, lab] of [["exit4", "Exit"], ["replaced4", "Replaced"], ["cleared4", "Cleared"]]) {
      const m = model(s, o);
      if (m) out.push([`${lab}, points per log unit of the index`, `${fmt.num(100 * m.coef, 1)}${stars(m.p)}`]);
    }
    const m = model(s, "exit4");
    if (m) out.push(["Damaged houses in the model", `${fmt.count(m.n)} in ${fmt.count(m.n_clusters)} tracts`]);
    return out;
  };

  /* (a) exit by roll 4 along the index, log scale */
  {
    const f = figure(figA, { width: W, height: 300, margin: { top: 30, right: 70, bottom: 50, left: 54 }, label: "Exit by roll 4 along the index" });
    const x = linear([0, bins.length - 1], [0, f.w]);
    const all = T.curve.filter((r) => r.exit4 > 0);
    const y = log([Math.min(...all.map((r) => r.exit4)) / 1.5, 0.9], [f.h, 0]);
    axisX(f, x, { values: bins.map((b, i) => i), format: (i) => bins[i], label: "Structure value left over land value (bins of the index)" });
    axisY(f, y, { values: [0.001, 0.01, 0.1, 0.5], format: (v) => fmt.pct(v, v < 0.01 ? 1 : 0), label: "Exited by roll 4 (%, log)" });
    f.add(svg("text", { x: -54, y: -14, "font-size": 11, fill: INK, "font-weight": 600, text: "Exit by the fourth roll along the index, all own-lot houses" }));
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
      f.add(reg(s, svg("path", { d: linePath(pts, (p) => x(p.i), (p) => y(p.exit4)), fill: "none", stroke: col.color,
        "stroke-width": s === "pooled" ? 1.2 : 1.8, "stroke-dasharray": col.dash || null, "stroke-linejoin": "round" })));
      for (const p of pts) {
        const r = s === "pooled" ? 2 : 2 + 6 * Math.sqrt(p.n / nmax);
        const dot = reg(s, svg("circle", { cx: x(p.i), cy: y(p.exit4), r, fill: s === "pooled" ? "#fff" : col.color, stroke: col.color, "stroke-width": 1 }));
        dot.addEventListener("pointerenter", (e) => tip.show(e, {
          title: `${meta.storms[s]}, index ${p.ratio_bin}`,
          rows: [["Exited by roll 4", fmt.pct(p.exit4, 1)], ["Replaced", fmt.pct(p.replaced4, 1)], ["Cleared", fmt.pct(p.cleared4, 1)],
            ["Houses in the bin", fmt.count(p.n)], ["of them damaged", fmt.count(p.n_damaged)], ...modelRows(s)],
          note: "Linear probability, county-storm fixed effects, pre-1994, log just value and homestead held, tract clusters. *** p < .001.",
        }));
        dot.addEventListener("pointermove", tip.move);
        dot.addEventListener("pointerleave", tip.hide);
        f.add(dot);
      }
      const last = pts[pts.length - 1];
      f.add(reg(s, svg("text", { x: x(last.i) + 8, y: y(last.exit4) + 3, "font-size": 9.5, fill: col.color, text: s === "pooled" ? "pooled" : meta.storms[s].split(" ")[0] })));
    }
  }
  for (const s of [...STORMS, "pooled"]) {
    const col = ink(s);
    const m = model(s, "exit4");
    legend.appendChild(el("span.item", {}, [svg("svg", { width: 26, height: 10, viewBox: "0 0 26 10" }, [
      svg("line", { x1: 1, x2: 25, y1: 5, y2: 5, stroke: col.color, "stroke-width": 2, "stroke-dasharray": col.dash || null })]),
    el("span", { text: `${s === "pooled" ? "Three storms pooled" : meta.storms[s]}: ${fmt.num(-100 * m.coef, 1)} points less exit per log unit` })]));
  }

  /* (b) the plane: value left by land share, damaged houses, pooled */
  {
    const vb = T.grid_bins.value_left;
    const lb = T.grid_bins.land_share;
    const f = figure(figB, { width: 340, height: 320, margin: { top: 30, right: 10, bottom: 50, left: 70 }, label: "Exit on the plane of value left and land share" });
    const cw = f.w / lb.length;
    const chh = f.h / vb.length;
    f.add(svg("text", { x: -70, y: -14, "font-size": 11, fill: INK, "font-weight": 600, text: "Damaged houses, three storms pooled: exited by roll 4 (%)" }));
    const vmax = Math.max(...T.grid.map((r) => r.exit4));
    for (const r of T.grid) {
      const i = lb.indexOf(r.land_share_bin);
      const j = vb.indexOf(r.value_left_bin);
      const g = svg("g", { class: "cell" });
      const dark = r.exit4 / vmax > .55;
      g.appendChild(svg("rect", { x: i * cw, y: f.h - (j + 1) * chh, width: cw - 1, height: chh - 1, fill: ramp(r.exit4 / vmax) }));
      g.appendChild(svg("text", { x: i * cw + cw / 2, y: f.h - (j + 1) * chh + chh / 2 + 1, "text-anchor": "middle", "font-size": 9.5, fill: dark ? "#fff" : INK, text: fmt.num(100 * r.exit4, 0) }));
      g.appendChild(svg("text", { x: i * cw + cw / 2, y: f.h - (j + 1) * chh + chh / 2 + 11, "text-anchor": "middle", "font-size": 7.5, fill: dark ? "#fff" : MUTED, text: `(${fmt.count(r.n)})` }));
      g.addEventListener("pointerenter", (e) => tip.show(e, {
        title: `Value left ${r.value_left_bin}, land share ${r.land_share_bin}`,
        rows: [["Exited by roll 4", fmt.pct(r.exit4, 1)], ["Replaced", fmt.pct(r.replaced4, 1)], ["Cleared", fmt.pct(r.cleared4, 1)], ["Houses", fmt.count(r.n)]],
        note: "Both shares of pre-storm just value; the index of the upper panel is the vertical share over the horizontal one.",
      }));
      g.addEventListener("pointermove", tip.move);
      g.addEventListener("pointerleave", tip.hide);
      f.add(g);
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
    f.add(svg("text", { x: -44, y: -14, "font-size": 11, fill: INK, "font-weight": 600, text: `How they left, ${meta.storms[state.storm]}` }));
    const bw = (f.w / bins.length) * 0.7;
    const inc = [income(state.storm, "exit4", false), income(state.storm, "exit4", true), income(state.storm, "replaced4", false), income(state.storm, "replaced4", true)];
    for (const p of pts) {
      const cx = x(p.i);
      const g = svg("g");
      g.appendChild(svg("rect", { x: cx - bw / 2, y: y(p.replaced4), width: bw, height: f.h - y(p.replaced4), fill: REC.replaced }));
      g.appendChild(svg("rect", { x: cx - bw / 2, y: y(p.replaced4 + p.cleared4), width: bw, height: y(p.replaced4) - y(p.replaced4 + p.cleared4), fill: REC.cleared }));
      if (p.exit4 >= 0.01) g.appendChild(svg("text", { x: cx, y: y(p.exit4) - 3, "text-anchor": "middle", "font-size": 8.5, fill: INK, text: fmt.num(100 * p.exit4, 0) }));
      g.addEventListener("pointerenter", (e) => tip.show(e, { title: `${meta.storms[state.storm]}, index ${p.ratio_bin}`,
        rows: [["Replaced", fmt.pct(p.replaced4, 1)], ["Cleared", fmt.pct(p.cleared4, 1)], ["Houses", fmt.count(p.n)],
          ...(inc[0] && inc[1] ? [["Tract income, exit, alone (with the index)", `${fmt.num(100 * inc[0].coef, 1)} (${fmt.num(100 * inc[1].coef, 1)}) points per SD`]] : []),
          ...(inc[2] && inc[3] ? [["Tract income, replaced, alone (with the index)", `${fmt.num(100 * inc[2].coef, 1)} (${fmt.num(100 * inc[3].coef, 1)})`]] : [])] }));
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

  cap.textContent = "Site-built houses on their own lot with four post-storm rolls in the damage counties of the three storms whose rolls record deleted value; structure value left is the pre-storm improvement value less the value deleted on the first post-storm roll, and the pattern is an association, not an estimated structural threshold.";

  function light(key) {
    for (const [s, nodes] of marks) for (const n of nodes) n.classList.toggle("dim", key !== null && key !== "line" && key !== "grid" && key !== "split" && s !== key);
    for (const n of lineNodes) n.classList.toggle("lit", key === "line");
    figB.classList.toggle("dim", key !== null && key !== "grid");
    colC.classList.toggle("dim", key !== null && key !== "split");
    figA.classList.toggle("dim", key === "grid" || key === "split");
  }
  const ov = app.overview.threshold;
  const pooledInc = income("pooled", "replaced4", true);
  const steps = STORMS.map((s) => ({
    cap: `${meta.storms[s]}: exit falls from ${fmt.pct(ov[s].exit_lowest, 1)} to ${fmt.pct(ov[s].exit_highest, 1)} along the index; ${fmt.num(-100 * model(s, "exit4").coef, 1)} points per log unit`,
    ms: 2600, run: (c) => { light(s); return c.sleep(2600); },
  }));
  steps.push({ cap: "Where the structure left is worth more than the lot, exit is at the background rate", ms: 2400, run: (c) => { light("line"); return c.sleep(2400); } });
  steps.push({ cap: `Exit rises with land share at every level of value left${pooledInc ? `; tract income adds ${fmt.num(100 * pooledInc.coef, 1)} points once the index is held` : ""}`, ms: 2800, run: (c) => { light("grid"); return c.sleep(2800); } });
  steps.push({ cap: "Clearing responds about twice as strongly as replacement", ms: 2400, run: (c) => { light("split"); return c.sleep(2400); } });
  steps.push({ cap: "Three storms and the pooled line", ms: 1800, run: (c) => { light(null); return c.sleep(1800); } });
  tour({ name: "the redevelopment threshold", steps, rest: () => light(null), after: () => {} }).attach(tourHost);
}
