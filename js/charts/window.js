/* The renewal window (Fig. 3): exit from the housing stock, roll by
   roll, of severely damaged own-lot houses against undamaged houses of
   the same counties, for the storms that pass the gate (at least 1,000
   severely damaged houses and three post-storm rolls): the hazard in
   each roll on a log scale, the cumulative share exited, and the share
   of eight rolls of exit that is made by each roll. Below it, what
   stands on the lot at the last roll (Fig. 4). Numbers live in the
   tooltips and the tour captions. */

import { el, svg, clear } from "../lib/dom.js";
import { figure, axisX, axisY, linePath } from "../lib/chart.js";
import { linear, log } from "../lib/scale.js";
import * as fmt from "../lib/format.js";
import { INK, MUTED, STORM_INK, GRAY_LIGHT, PINK } from "../lib/palette.js";
import * as tip from "../lib/tooltip.js";
import { tour } from "../lib/tour.js";
import { bandsPanel } from "./pathways.js";

const W = 320;
const H = 320;
const M = { top: 24, right: 64, bottom: 44, left: 60 };
const SPAN_K = 4;

function ink(storm) { return STORM_INK[storm] || { color: "#8c8c8c", dash: "" }; }

export function windowChart(host, app) {
  const meta = app.meta;
  const ov = app.overview;
  const storms = app.window.storms;
  const rows = app.window.rows;
  const sev = (s) => rows.filter((r) => r.storm === s && r.group === "severe").sort((a, b) => a.k - b.k);
  const und = (s) => rows.filter((r) => r.storm === s && r.group === "undamaged" && r.k >= 2).sort((a, b) => a.k - b.k);
  const kmax = 8;

  const tourHost = el("div");
  const figRow = el("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: ".6rem" } });
  const hosts = [el("div.figure"), el("div.figure"), el("div.figure")];
  figRow.append(...hosts);
  const legend = el("div.legend");
  const bandsHost = el("div", { style: { marginTop: "1.4rem", paddingTop: "1rem", borderTop: "1px solid var(--rule-soft)" } });
  const cap = el("p.caption");
  clear(host).append(tourHost, figRow, legend, bandsHost, cap);

  const marks = new Map();
  const bandNodes = [];
  const spanNodes = [];
  function reg(storm, node) {
    if (!marks.has(storm)) marks.set(storm, []);
    marks.get(storm).push(node);
    return node;
  }
  const w4 = (s) => ov.window[s] || {};

  function band(f, x, y, acc) {
    const ks = [];
    for (let k = 2; k <= kmax; k += 1) {
      const vals = storms.map((s) => und(s).find((r) => r.k === k)).filter(Boolean).map(acc).filter((v) => v > 0);
      if (vals.length) {
        vals.sort((a, b) => a - b);
        ks.push({ k, lo: vals[0], hi: vals[vals.length - 1], med: vals[Math.floor(vals.length / 2)] });
      }
    }
    const up = ks.map((p) => `${x(p.k).toFixed(1)},${y(p.hi).toFixed(1)}`);
    const down = ks.slice().reverse().map((p) => `${x(p.k).toFixed(1)},${y(p.lo).toFixed(1)}`);
    const area = svg("path", { d: `M${[...up, ...down].join("L")}Z`, fill: GRAY_LIGHT, opacity: .45 });
    const med = svg("path", { d: linePath(ks, (p) => x(p.k), (p) => y(p.med)), fill: "none", stroke: MUTED, "stroke-width": 1 });
    f.add(area); f.add(med);
    bandNodes.push(area, med);
    const last = ks[ks.length - 1];
    const t = svg("text", { x: x(last.k) + 4, y: y(last.med) + 3, "font-size": 9.5, fill: MUTED, text: "undamaged" });
    f.add(t); bandNodes.push(t);
    const hit = svg("path", { d: `M${[...up, ...down].join("L")}Z`, fill: "transparent" });
    hit.addEventListener("pointerenter", (e) => tip.show(e, { title: "Undamaged houses of the same counties",
      rows: ks.filter((p) => [2, 4, 8].includes(p.k)).map((p) => [`Roll ${p.k}`, `${fmt.pct(p.lo, 2)} to ${fmt.pct(p.hi, 2)}`]),
      note: "Range across the storms, with their median; undamaged houses stand on roll 1 by definition." }));
    hit.addEventListener("pointermove", tip.move);
    hit.addEventListener("pointerleave", tip.hide);
    f.add(hit);
  }

  function span(f, x) {
    const r = svg("rect", { x: x(1), y: 0, width: x(SPAN_K) - x(1), height: f.h, fill: PINK, opacity: .06 });
    f.plot.insertBefore(r, f.plot.firstChild);
    spanNodes.push(r);
    const t = svg("text", { x: x(1) + 3, y: 10, "font-size": 9, fill: PINK, text: "rolls 1 to 4" });
    f.add(t); spanNodes.push(t);
  }

  function lines(f, x, y, acc, label, valueText, positive) {
    for (const s of storms) {
      const pts = sev(s).filter((r) => !positive || acc(r) > 0);
      const col = ink(s);
      f.add(reg(s, svg("path", {
        d: linePath(pts, (p) => x(p.k), (p) => y(acc(p))), fill: "none", stroke: col.color,
        "stroke-width": 1.8, "stroke-dasharray": col.dash || null, "stroke-linejoin": "round",
      })));
      const last = pts[pts.length - 1];
      f.add(reg(s, svg("text", { x: x(last.k) + 4, y: y(acc(last)) + 3, "font-size": 9.5, fill: col.color, text: meta.storms[s].split(" ")[0] })));
      for (const p of pts) {
        const dot = svg("circle", { cx: x(p.k), cy: y(acc(p)), r: 4, fill: col.color, opacity: 0.001 });
        dot.addEventListener("pointerenter", (e) => {
          dot.setAttribute("opacity", 1);
          const w = w4(s);
          tip.show(e, {
            title: `${meta.storms[s]}, roll ${p.k}`,
            rows: [[label, valueText(p)], ["Severely damaged houses", fmt.count(p.n)],
              ["Undamaged houses", fmt.count(w.n_undamaged)],
              ["Exit by roll 4, severe over undamaged", w.multiplier4 ? `${fmt.pct(w.severe_exit4, 1)} over ${fmt.pct(w.undamaged_exit4, 1)}, ${fmt.num(w.multiplier4, 0)} times` : ""]],
          });
        });
        dot.addEventListener("pointermove", tip.move);
        dot.addEventListener("pointerleave", () => { dot.setAttribute("opacity", 0.001); tip.hide(); });
        f.add(dot);
      }
    }
  }

  /* (a) hazard, log scale */
  {
    const f = figure(hosts[0], { width: W, height: H, margin: M, label: "Exit hazard by roll" });
    const x = linear([1, kmax], [0, f.w]);
    const y = log([0.0005, 0.5], [f.h, 0]);
    span(f, x);
    axisX(f, x, { values: [1, 2, 3, 4, 5, 6, 7, 8], format: (v) => String(v), label: "Post-storm roll" });
    axisY(f, y, { values: [0.001, 0.01, 0.1, 0.5], format: (v) => fmt.pct(v, v < 0.01 ? 1 : 0), label: "Exit in the roll (%, log)" });
    f.add(svg("text", { x: 0, y: -10, "font-size": 11, fill: INK, "font-weight": 600, text: "Exit in each roll" }));
    band(f, x, y, (r) => r.hazard);
    lines(f, x, y, (r) => r.hazard, "Exit in the roll", (p) => fmt.pct(p.hazard, 1), true);
  }
  /* (b) cumulative exit */
  {
    const f = figure(hosts[1], { width: W, height: H, margin: M, label: "Cumulative exit" });
    const x = linear([1, kmax], [0, f.w]);
    const ymax = Math.max(...rows.filter((r) => r.group === "severe").map((r) => r.cum_exit)) * 1.1;
    const y = linear([0, ymax], [f.h, 0]);
    span(f, x);
    axisX(f, x, { values: [1, 2, 3, 4, 5, 6, 7, 8], format: (v) => String(v), label: "Post-storm roll" });
    axisY(f, y, { format: (v) => fmt.pct(v, 0), label: "Exited so far (% of houses at roll 1)" });
    f.add(svg("text", { x: 0, y: -10, "font-size": 11, fill: INK, "font-weight": 600, text: "Cumulative exit" }));
    band(f, x, y, (r) => r.cum_exit);
    lines(f, x, y, (r) => r.cum_exit, "Exited so far", (p) => fmt.pct(p.cum_exit, 1), false);
  }
  /* (c) timing */
  {
    const f = figure(hosts[2], { width: W, height: H, margin: M, label: "Timing of exit" });
    const x = linear([1, kmax], [0, f.w]);
    const y = linear([0, 1], [f.h, 0]);
    span(f, x);
    axisX(f, x, { values: [1, 2, 3, 4, 5, 6, 7, 8], format: (v) => String(v), label: "Post-storm roll" });
    axisY(f, y, { format: (v) => fmt.pct(v, 0), label: "Share of exits made by roll 8 (%)" });
    f.add(svg("text", { x: 0, y: -10, "font-size": 11, fill: INK, "font-weight": 600, text: "Timing of exit" }));
    const labelled = storms.filter((s) => sev(s)[sev(s).length - 1].k >= 8)
      .map((s) => ({ s, v: sev(s).find((r) => r.k === 4).cum_exit / sev(s).find((r) => r.k === 8).cum_exit }))
      .sort((a, b) => b.v - a.v);
    const labelY = new Map();
    let prev = -Infinity;
    for (const { s, v } of labelled) { const yy = Math.max(y(v), prev + 11); labelY.set(s, yy); prev = yy; }
    for (const s of storms) {
      const pts = sev(s);
      if (pts[pts.length - 1].k < 8) continue;
      const total = pts.find((r) => r.k === 8).cum_exit;
      const col = ink(s);
      const series = pts.map((p) => ({ k: p.k, v: p.cum_exit / total }));
      f.add(reg(s, svg("path", { d: linePath(series, (p) => x(p.k), (p) => y(p.v)), fill: "none", stroke: col.color, "stroke-width": 1.8, "stroke-dasharray": col.dash || null })));
      const at4 = series.find((p) => p.k === 4);
      f.add(reg(s, svg("text", { x: x(4) + 6, y: labelY.get(s) + 3, "font-size": 9.5, fill: col.color, text: `${meta.storms[s].split(" ")[0]} ${fmt.pct(at4.v, 0)}` })));
      for (const p of series) {
        const dot = svg("circle", { cx: x(p.k), cy: y(p.v), r: 4, fill: col.color, opacity: 0.001 });
        dot.addEventListener("pointerenter", (e) => { dot.setAttribute("opacity", 1); tip.show(e, {
          title: `${meta.storms[s]}, roll ${p.k}`, rows: [["Share of the exits made by roll 8", fmt.pct(p.v, 0)], ["Exited by roll 8", fmt.pct(total, 1)]] }); });
        dot.addEventListener("pointermove", tip.move);
        dot.addEventListener("pointerleave", () => { dot.setAttribute("opacity", 0.001); tip.hide(); });
        f.add(dot);
      }
    }
  }

  for (const s of storms) {
    const col = ink(s);
    const w = w4(s);
    legend.appendChild(el("span.item", {}, [svg("svg", { width: 26, height: 10, viewBox: "0 0 26 10" }, [
      svg("line", { x1: 1, x2: 25, y1: 5, y2: 5, stroke: col.color, "stroke-width": 2, "stroke-dasharray": col.dash || null })]),
    el("span", { text: `${meta.storms[s]}: ${fmt.num(w.multiplier4, 0)} times by roll 4` })]));
  }
  legend.appendChild(el("span.item", {}, [el("span.swatch", { style: { background: GRAY_LIGHT, height: "8px" } }), " Undamaged houses of the same counties"]));

  const bands = bandsPanel(bandsHost, app);
  cap.textContent = "Site-built houses on their own lot in the damage counties; exit is replacement by a new structure, or demolition with the lot still cleared at the last roll; the shaded span is the horizon at which exit is compared.";

  function light(key, cls) {
    for (const [s, nodes] of marks) for (const n of nodes) n.classList.toggle("dim", key !== null && key !== "band" && key !== "span" && s !== key);
    for (const n of bandNodes) n.classList.toggle("lit", key === "band");
    for (const n of spanNodes) if (n.tagName === "rect") n.setAttribute("opacity", key === "span" ? .16 : .06);
    bands.light(key !== null && bands.storms.includes(key) ? key : null, cls || null);
  }
  const eight = storms.filter((s) => w4(s).share_by4_of8);
  const steps = storms.map((s) => ({
    cap: `${meta.storms[s]}: exit by roll 4 is ${fmt.num(w4(s).multiplier4, 0)} times the undamaged rate; ${fmt.pct(bands.frame[s] ? bands.frame[s].retained_last : 1 - w4(s).severe_exit4, 0)} restored in place`,
    ms: 2600, run: (c) => { light(s); return c.sleep(2600); },
  }));
  steps.push({ cap: "Undamaged houses turn over at .1 to .4% a roll", ms: 2400, run: (c) => { light("band"); return c.sleep(2400); } });
  steps.push({ cap: `${fmt.num(100 * Math.min(...eight.map((s) => w4(s).share_by4_of8)), 0)} to ${fmt.num(100 * Math.max(...eight.map((s) => w4(s).share_by4_of8)), 0)}% of eight rolls of exit is made by roll 4`, ms: 2400, run: (c) => { light("span"); return c.sleep(2400); } });
  steps.push({ cap: "Restored in place: the two classes that keep the pre-storm structure", ms: 2400, run: (c) => { light(null, ["less_documented", "documented_repair"]); return c.sleep(2400); } });
  steps.push({ cap: "All four storms", ms: 1800, run: (c) => { light(null); return c.sleep(1800); } });
  tour({ name: "the renewal window", steps, rest: () => light(null), after: () => {} }).attach(tourHost);
}
