/* The recovery pathways (Fig. 4 and Fig. S6): what stands at the last
   roll on the lots of severely damaged own-lot houses, by storm and by
   the vintage band the house had before the storm, and the same houses
   roll by roll for one storm at a time; with the permit records that
   agree with the roll about who was kept. */

import { el, svg, clear, control, select } from "../lib/dom.js";
import { figure, axisX, axisY } from "../lib/chart.js";
import { linear } from "../lib/scale.js";
import * as fmt from "../lib/format.js";
import { INK, MUTED, GRID, REC, REC_LABEL } from "../lib/palette.js";
import * as tip from "../lib/tooltip.js";
import { tour } from "../lib/tour.js";

const W = 720;
const ROW = 20;
const BANDS = ["Before 1970", "1970 to 1993", "1994 or later"];
const SEGS = [
  { key: "standing", cls: "less_documented", label: "Less-documented recovery" },
  { key: "repaired", cls: "documented_repair", label: "Documented repair" },
  { key: "new_early", cls: "replaced", label: "Replaced by roll 4" },
  { key: "new_late", cls: "replaced", label: "Replaced in rolls 5 to 8", hatch: true },
  { key: "cleared", cls: "cleared", label: "Cleared" },
];
const STATES = ["less_documented", "documented_repair", "replaced", "cleared"];

export function pathwaysChart(host, app) {
  const meta = app.meta;
  const P = app.pathways;
  const frame = Object.fromEntries(P.frame.map((r) => [r.storm, r]));
  const storms = Object.keys(frame).sort((a, b) => frame[b].retained_last - frame[a].retained_last);
  const stateStorms = [...new Set(P.states.filter((r) => r.n_post_rolls >= 4).map((r) => r.storm))]
    .sort((a, b) => a.slice(-4) - b.slice(-4));
  const state = { storm: storms[0] };

  const tourHost = el("div");
  const figA = el("div.figure");
  const legend = el("div.legend");
  const bar = el("div.controls");
  const figB = el("div.figure");
  const side = el("div.sidecard");
  const cap = el("p.caption");
  clear(host).append(tourHost, el("div.panelgrid", { style: { gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)" } }, [
    el("div", {}, [figA, legend, bar, figB]), side,
  ]), cap);

  const defs = svg("defs", {}, [
    svg("pattern", { id: "hatch", width: 4, height: 4, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, [
      svg("rect", { width: 4, height: 4, fill: REC.replaced }),
      svg("line", { x1: 0, x2: 0, y1: 0, y2: 4, stroke: "#fff", "stroke-width": 1.4 }),
    ]),
  ]);

  for (const s of SEGS) {
    const sw = el("span.sq", { style: { background: s.hatch ? `repeating-linear-gradient(45deg, ${REC.replaced} 0 2px, #fff 2px 3px)` : REC[s.cls] } });
    legend.appendChild(el("span.item", {}, [sw, el("span", { text: s.label })]));
  }

  const rowNodes = new Map();  // storm -> nodes
  const segNodes = new Map();  // cls -> nodes
  function reg(map, key, node) { if (!map.has(key)) map.set(key, []); map.get(key).push(node); return node; }

  /* (a) what stands at the last roll, by storm and vintage band */
  function drawBands() {
    const rows = [];
    for (const s of storms) for (const b of BANDS) {
      const r = P.bands.find((q) => q.storm === s && q.band === b);
      if (r) rows.push({ storm: s, band: b, r });
    }
    const groupGap = 14;
    const H = rows.length * ROW + storms.length * groupGap + 60;
    const f = figure(figA, { width: W, height: H, margin: { top: 30, right: 150, bottom: 26, left: 150 }, label: "What stands on the lot at the last roll" });
    f.addRoot(defs);
    const x = linear([0, 1], [0, f.w]);
    axisX(f, x, { values: [0, .25, .5, .75, 1], format: (v) => fmt.pct(v, 0), label: "Share of the band’s severely damaged houses (%)", y: f.h });
    f.add(svg("text", { x: -150, y: -14, "font-size": 11, fill: INK, "font-weight": 600, text: "(a) What stands at the last roll, by pre-storm vintage band" }));
    let y = 0;
    let lastStorm = null;
    for (const { storm, band, r } of rows) {
      if (storm !== lastStorm) {
        const fr = frame[storm];
        const head = reg(rowNodes, storm, svg("text", { x: -150, y: y + 11, "font-size": 11, fill: INK, "font-weight": 600,
          text: `${meta.storms[storm]}, ${fr.n_post_rolls} rolls, restored in place ${fmt.pct(fr.retained_last, 0)}` }));
        f.add(head);
        const rule = reg(rowNodes, storm, svg("line", { x1: x(fr.retained_last), x2: x(fr.retained_last), y1: y + 14, y2: y + 14 + 3 * ROW, stroke: MUTED, "stroke-dasharray": "3 2" }));
        f.add(rule);
        const ex = reg(rowNodes, storm, svg("text", { x: f.w + 6, y: y + 11, "font-size": 9.5, fill: MUTED,
          text: `pre-1994 exited ${fmt.pct(fr.pre1994_left_last, 0)} (roll 4: ${fmt.pct(fr.pre1994_exit4, 0)})` }));
        f.add(ex);
        y += groupGap;
        lastStorm = storm;
      }
      f.add(reg(rowNodes, storm, svg("text", { x: -8, y: y + 13, "text-anchor": "end", "font-size": 10.5, fill: INK, text: band })));
      f.add(reg(rowNodes, storm, svg("text", { x: f.w + 6, y: y + 13, "font-size": 9.5, fill: MUTED, text: `n = ${fmt.count(r.n)}` })));
      let x0 = 0;
      for (const s of SEGS) {
        const v = r[s.key] || 0;
        if (v <= 0) continue;
        const rect = svg("rect", { x: x(x0), y: y + 2, width: x(x0 + v) - x(x0), height: ROW - 4,
          fill: s.hatch ? "url(#hatch)" : REC[s.cls], stroke: "#fff", "stroke-width": .6 });
        reg(rowNodes, storm, rect); reg(segNodes, s.cls, rect);
        rect.addEventListener("pointerenter", (e) => tip.show(e, {
          title: `${meta.storms[storm]}, built ${band.toLowerCase()}`,
          rows: [[s.label, fmt.pct(v, 1)], ["Houses in the band", fmt.count(r.n)]],
        }));
        rect.addEventListener("pointermove", tip.move);
        rect.addEventListener("pointerleave", tip.hide);
        f.add(rect);
        if (v >= .07) {
          const t = svg("text", { x: x(x0 + v / 2), y: y + 14, "text-anchor": "middle", "font-size": 9.5,
            fill: s.cls === "cleared" ? INK : "#fff", text: fmt.num(100 * v, 0), style: { pointerEvents: "none" } });
          reg(rowNodes, storm, t); reg(segNodes, s.cls, t);
          f.add(t);
        }
        x0 += v;
      }
      y += ROW;
    }
  }

  /* (b) the same houses roll by roll, one storm */
  function drawStates() {
    const rs = P.states.filter((r) => r.storm === state.storm).sort((a, b) => a.k - b.k);
    const f = figure(figB, { width: W, height: 250, margin: { top: 28, right: 150, bottom: 40, left: 50 }, label: "Pathways roll by roll" });
    const kmax = Math.max(4, ...rs.map((r) => r.k));
    const x = linear([1, kmax], [0, f.w]);
    const y = linear([0, 1], [f.h, 0]);
    axisX(f, x, { values: rs.map((r) => r.k), format: (v) => String(v), label: "Post-storm roll" });
    axisY(f, y, { values: [0, .25, .5, .75, 1], format: (v) => fmt.pct(v, 0), label: "Share of severely damaged houses (%)" });
    f.add(svg("text", { x: -50, y: -14, "font-size": 11, fill: INK, "font-weight": 600,
      text: `(b) ${meta.storms[state.storm]}, ${fmt.count(rs[0].n)} houses in ${rs[0].n_counties} damage counties, roll by roll` }));
    const stack = rs.map((r) => { let acc = 0; const o = { k: r.k }; for (const st of STATES) { o[`${st}_lo`] = acc; acc += r[st]; o[`${st}_hi`] = acc; } return o; });
    for (const st of STATES) {
      const up = stack.map((p) => `${x(p.k).toFixed(1)},${y(p[`${st}_hi`]).toFixed(1)}`);
      const down = stack.slice().reverse().map((p) => `${x(p.k).toFixed(1)},${y(p[`${st}_lo`]).toFixed(1)}`);
      const area = svg("path", { d: `M${[...up, ...down].join("L")}Z`, fill: REC[st], stroke: "#fff", "stroke-width": .8 });
      f.add(area);
      const last = stack[stack.length - 1];
      const mid = (last[`${st}_lo`] + last[`${st}_hi`]) / 2;
      const rl = rs[rs.length - 1];
      if (rl[st] >= 0.03) f.add(svg("text", { x: x(last.k) + 5, y: y(mid) + 3, "font-size": 9.5, fill: st === "cleared" ? MUTED : REC[st],
        text: `${REC_LABEL[st]} ${fmt.pct(rl[st], 0)}` }));
    }
    const span = svg("line", { x1: x(4), x2: x(4), y1: 0, y2: f.h, stroke: MUTED, "stroke-dasharray": "3 2" });
    f.add(span);
    for (const r of rs) {
      const hit = svg("rect", { x: x(r.k) - 8, y: 0, width: 16, height: f.h, fill: "transparent" });
      hit.addEventListener("pointerenter", (e) => tip.show(e, {
        title: `${meta.storms[state.storm]}, roll ${r.k}`,
        rows: [...STATES.map((st) => [REC_LABEL[st], fmt.pct(r[st], 1)]), ["Exited (replaced or cleared)", fmt.pct(r.exit, 1)]],
      }));
      hit.addEventListener("pointermove", tip.move);
      hit.addEventListener("pointerleave", tip.hide);
      f.add(hit);
    }
  }

  const sel = select(stateStorms.map((s) => ({ key: s, label: meta.storms[s] })), state.storm, (v) => { state.storm = v; drawStates(); });
  bar.appendChild(control("Storm, roll by roll", sel));

  drawBands();
  drawStates();

  /* side: the permit records */
  const pm = P.permits;
  const cc = pm.cape_coral;
  const byPath = Object.fromEntries(cc.rows.map((r) => [r.roll_path, r]));
  side.appendChild(el("h4", { text: "Permits against the roll" }));
  side.appendChild(el("p", { html: `<strong>Cape Coral</strong>, ${fmt.count(cc.n_severe)} severely damaged houses after Ian: the roll calls ${fmt.pct(cc.kept_share, 1)} kept. Of the houses it calls replaced, ${fmt.pct(byPath.replaced.new_house, 0)} carry a new-house permit; of those it calls cleared, ${fmt.pct(byPath.cleared.demolition, 0)} a demolition permit; of those with a recorded repair, ${fmt.pct(byPath["kept, repair recorded"].any_house_work, 0)} carry repair or roof permits, and of those without, ${fmt.pct(byPath["kept, no recorded repair"].any_house_work, 0)}.` }));
  const tbl = el("table.dtable");
  tbl.appendChild(el("thead", {}, [el("tr", {}, ["Roll says", "n", "New", "Demo.", "Repair"].map((t) => el("th", { text: t })))]));
  const tb = el("tbody");
  const names = { "kept, repair recorded": "Documented repair", "kept, no recorded repair": "Less-documented recovery", replaced: "Replaced", cleared: "Cleared" };
  for (const key of ["kept, repair recorded", "kept, no recorded repair", "replaced", "cleared"]) {
    const r = byPath[key];
    tb.appendChild(el("tr", {}, [el("td", { text: names[key] }), el("td", { text: fmt.count(r.n) }),
      el("td", { text: fmt.pct(r.new_house, 0) }), el("td", { text: fmt.pct(r.demolition, 0) }), el("td", { text: fmt.pct(r.any_house_work, 0) })]));
  }
  tbl.appendChild(tb);
  side.appendChild(tbl);
  side.appendChild(el("p.note", { text: "Share of each class carrying a new-house, demolition, or repair or roof permit." }));
  const ch = pm.charlotte;
  side.appendChild(el("p", { html: `<strong>Charlotte County</strong> (outside Punta Gorda): ${ch.kept_new_house_permits} of ${fmt.count(ch.kept_n)} houses the roll calls kept carry a new-house permit; ${ch.replaced_new_house_permits} of ${ch.replaced_n} it calls replaced do.`, style: { marginTop: ".8rem" } }));
  side.appendChild(el("p.note", { text: "Permits issued 2023 to 2025; the 2022 file carries no parcel key, so every share is a lower bound." }));

  cap.textContent = "Severely damaged site-built houses on their own lot in each storm’s damage counties; the dashed rule behind a storm’s bars is its share restored in place at the last roll, all vintages, and the storms are ordered by it. Pathways at the last roll: documented repair, the roll records new-construction value on the pre-storm structure; less-documented recovery, the pre-storm structure stands with no such value; replaced, a structure with a post-storm year built; cleared, demolished or absent from the last roll. Ian is observed for four rolls, so no Ian bar can carry a replacement in rolls 5 to 8. All shares are descriptive.";

  /* tour */
  function light(storm, cls) {
    for (const [s, nodes] of rowNodes) for (const n of nodes) n.classList.toggle("dim", storm !== null && s !== storm);
    for (const [c, nodes] of segNodes) for (const n of nodes) n.classList.toggle("dim", cls !== null && !cls.includes(c));
  }
  const steps = storms.map((s) => ({
    cap: `${meta.storms[s]}: ${fmt.pct(frame[s].retained_last, 0)} of severely damaged houses still hold the pre-storm structure`,
    ms: 2800,
    run: (c) => {
      light(s, null);
      if (stateStorms.includes(s)) { state.storm = s; sel.value = s; drawStates(); }
      return c.sleep(2800);
    },
  }));
  steps.push({ cap: "Restored in place: the two classes that keep the pre-storm structure", ms: 2600,
    run: (c) => { light(null, ["less_documented", "documented_repair"]); return c.sleep(2600); } });
  steps.push({ cap: "Exit: replaced or cleared, most of it within four rolls", ms: 2600,
    run: (c) => { light(null, ["replaced", "cleared"]); return c.sleep(2600); } });
  steps.push({ cap: "All storms and bands", ms: 1800, run: (c) => { light(null, null); return c.sleep(1800); } });
  tour({ name: "the recovery pathways", steps, rest: () => light(null, null), after: () => {} }).attach(tourHost);
}
