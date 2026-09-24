/* What stands on the lot at the last roll (Fig. 4): severely damaged
   own-lot houses by storm and by the vintage band the house had before
   the storm, split into the paper's pathway classes. Numbers live in
   the tooltips. Drawn as the second panel of the renewal window page. */

import { el, svg, clear } from "../lib/dom.js";
import { figure, axisX } from "../lib/chart.js";
import { linear } from "../lib/scale.js";
import * as fmt from "../lib/format.js";
import { INK, MUTED, REC } from "../lib/palette.js";
import * as tip from "../lib/tooltip.js";

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

/** Returns { light(storm, classes) } for the tour. */
export function bandsPanel(host, app) {
  const meta = app.meta;
  const P = app.pathways;
  const frame = Object.fromEntries(P.frame.map((r) => [r.storm, r]));
  const storms = Object.keys(frame).sort((a, b) => frame[b].retained_last - frame[a].retained_last);
  const figA = el("div.figure");
  const legend = el("div.legend");
  clear(host).append(figA, legend);

  for (const s of SEGS) {
    const sw = el("span.sq", { style: { background: s.hatch ? `repeating-linear-gradient(45deg, ${REC.replaced} 0 2px, #fff 2px 3px)` : REC[s.cls] } });
    legend.appendChild(el("span.item", {}, [sw, el("span", { text: s.label })]));
  }

  const rowNodes = new Map();
  const segNodes = new Map();
  const reg = (map, key, node) => { if (!map.has(key)) map.set(key, []); map.get(key).push(node); return node; };

  const rows = [];
  for (const s of storms) for (const b of BANDS) {
    const r = P.bands.find((q) => q.storm === s && q.band === b);
    if (r) rows.push({ storm: s, band: b, r });
  }
  const groupGap = 14;
  const H = rows.length * ROW + storms.length * groupGap + 56;
  const f = figure(figA, { width: W, height: H, margin: { top: 26, right: 150, bottom: 26, left: 150 }, label: "What stands on the lot at the last roll" });
  f.addRoot(svg("defs", {}, [
    svg("pattern", { id: "hatch", width: 4, height: 4, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, [
      svg("rect", { width: 4, height: 4, fill: REC.replaced }),
      svg("line", { x1: 0, x2: 0, y1: 0, y2: 4, stroke: "#fff", "stroke-width": 1.4 }),
    ]),
  ]));
  const x = linear([0, 1], [0, f.w]);
  axisX(f, x, { values: [0, .25, .5, .75, 1], format: (v) => fmt.pct(v, 0), label: "Share of the band's severely damaged houses at the last roll (%)", y: f.h });
  f.add(svg("text", { x: -150, y: -12, "font-size": 11, fill: INK, "font-weight": 600, text: "What stands on the lot at the last roll, by pre-storm vintage band" }));
  let y = 0;
  let lastStorm = null;
  for (const { storm, band, r } of rows) {
    const fr = frame[storm];
    if (storm !== lastStorm) {
      f.add(reg(rowNodes, storm, svg("text", { x: -150, y: y + 11, "font-size": 11, fill: INK, "font-weight": 600,
        text: `${meta.storms[storm]}, ${fr.n_post_rolls} rolls: restored in place ${fmt.pct(fr.retained_last, 0)}` })));
      f.add(reg(rowNodes, storm, svg("line", { x1: x(fr.retained_last), x2: x(fr.retained_last), y1: y + 14, y2: y + 14 + 3 * ROW, stroke: MUTED, "stroke-dasharray": "3 2" })));
      f.add(reg(rowNodes, storm, svg("text", { x: f.w + 6, y: y + 11, "font-size": 9.5, fill: MUTED,
        text: `pre-1994 exited ${fmt.pct(fr.pre1994_left_last, 0)} (roll 4 ${fmt.pct(fr.pre1994_exit4, 0)})` })));
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
        rows: [[s.label, fmt.pct(v, 1)], ["Houses in the band", fmt.count(r.n)],
          ["Restored in place, all vintages", fmt.pct(fr.retained_last, 0)], ["Post-storm rolls", String(fr.n_post_rolls)]],
        note: s.cls === "less_documented" ? "The roll records no new-construction value; where permits can be checked, half of this class pulled repair or roof permits." : "",
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

  return {
    storms,
    frame,
    light(storm, cls) {
      for (const [s, nodes] of rowNodes) for (const n of nodes) n.classList.toggle("dim", storm !== null && s !== storm);
      for (const [c, nodes] of segNodes) for (const n of nodes) n.classList.toggle("dim", cls !== null && !cls.includes(c));
    },
  };
}
