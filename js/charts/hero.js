/* The landing picture: the paper’s framework as the story of one lot in
   four frames (before the storm, the storm, the three paths, the next
   hurricane), with a readout of the numbers that stand behind each
   frame. The tour lights one frame at a time and counts the readout
   up; a click stops it and the picture rests with every frame lit. */

import { el, svg, clear } from "../lib/dom.js";
import * as fmt from "../lib/format.js";
import { INK, MUTED, PINK, GRAY, GRAY_LIGHT, REC, RULE } from "../lib/palette.js";
import * as motion from "../lib/motion.js";
import { tour } from "../lib/tour.js";

const W = 960;
const H = 300;
const FW = 232;
const GAP = 10;
const BAR_STRUCT = 132;
const BAR_LOT = 56;
const RESTORED_INK = "#4d4d4d";

function house(x, y, w, h, color, opts = {}) {
  const g = svg("g");
  const roofH = h * 0.42;
  const fill = opts.open ? "#fff" : color;
  g.appendChild(svg("path", {
    d: `M${x},${y + roofH}L${x + w / 2},${y}L${x + w},${y + roofH}Z`,
    fill, stroke: color, "stroke-width": 1.4, "stroke-linejoin": "round",
    "stroke-dasharray": opts.dash || null,
  }));
  g.appendChild(svg("rect", {
    x: x + w * 0.1, y: y + roofH, width: w * 0.8, height: h - roofH,
    fill, stroke: color, "stroke-width": 1.4, "stroke-dasharray": opts.dash || null,
  }));
  if (!opts.open && !opts.dash) {
    g.appendChild(svg("rect", {
      x: x + w * 0.42, y: y + h * 0.68, width: w * 0.16, height: h * 0.32, fill: "#fff", opacity: .85,
    }));
  }
  return g;
}

function lot(x, y, w) {
  return svg("line", { x1: x, x2: x + w, y1: y, y2: y, stroke: GRAY, "stroke-width": 2 });
}

function label(x, y, text, opts = {}) {
  return svg("text", {
    x, y, "font-size": opts.size ?? 11, fill: opts.fill ?? MUTED,
    "text-anchor": opts.anchor ?? "start", "font-weight": opts.weight || null, text,
  });
}

function bars(g, x, y, structW, lostW, opts = {}) {
  /* two value bars: the structure’s above the lot’s */
  g.appendChild(label(x, y - 5, "structure", { size: 9.5 }));
  g.appendChild(svg("rect", { x, y, width: structW, height: 9, fill: opts.color || INK, class: "v-struct" }));
  if (lostW) {
    g.appendChild(svg("rect", {
      x: x + structW, y, width: lostW, height: 9, fill: "none", stroke: PINK, "stroke-width": 1.2,
      "stroke-dasharray": "3 2",
    }));
    g.appendChild(label(x + structW + lostW, y - 5, "value lost", { size: 9.5, fill: PINK, anchor: "end" }));
  }
  g.appendChild(label(x, y + 25, "lot", { size: 9.5 }));
  g.appendChild(svg("rect", { x, y: y + 30, width: BAR_LOT, height: 9, fill: GRAY_LIGHT }));
}

export function heroChart(host, app) {
  const ov = app.overview;
  const sp = ov.split.pooled;
  const wins = Object.values(ov.window).filter((w) => w.multiplier4);
  const mult = [Math.min(...wins.map((w) => w.multiplier4)), Math.max(...wins.map((w) => w.multiplier4))];
  const timing = wins.filter((w) => w.share_by4_of8).map((w) => w.share_by4_of8);
  const fold = ov.threshold.pooled.fold;
  const c = ov.consequence;
  const area = Math.max(...Object.values(ov.form).map((f) => f.replaced_area_gain));

  const figHost = el("div.figure");
  const tourHost = el("div");
  const read = el("div.hero-read");
  const cap = el("p.caption");
  clear(host).append(tourHost, figHost, read, cap);

  const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img",
    "aria-label": "One lot through a hurricane: before, the storm, three paths, the next hurricane" });
  figHost.appendChild(root);
  const frames = [];
  const fx = (i) => GAP + i * (FW + GAP);

  /* frame 0: before the storm */
  {
    const g = svg("g", { class: "frame" });
    const x = fx(0);
    g.appendChild(label(x, 22, "1  Before the storm", { fill: INK, size: 12.5, weight: 600 }));
    g.appendChild(house(x + 70, 60, 84, 70, INK));
    g.appendChild(lot(x + 40, 130, 150));
    bars(g, x + 40, 180, BAR_STRUCT, 0);
    g.appendChild(label(x + 40, 250, "A durable house loses value over", { size: 10 }));
    g.appendChild(label(x + 40, 264, "decades; the lot keeps its own.", { size: 10 }));
    root.appendChild(g);
    frames.push(g);
  }
  /* frame 1: the storm */
  {
    const g = svg("g", { class: "frame" });
    const x = fx(1);
    g.appendChild(label(x, 22, "2  The storm", { fill: INK, size: 12.5, weight: 600 }));
    g.appendChild(house(x + 70, 60, 84, 70, INK, { dash: "4 3" }));
    g.appendChild(svg("path", {
      d: `M${x + 60},${48}q20,-14 40,0t40,0t40,0`, fill: "none", stroke: PINK, "stroke-width": 2,
      "stroke-linecap": "round",
    }));
    g.appendChild(lot(x + 40, 130, 150));
    bars(g, x + 40, 180, 14, BAR_STRUCT - 14);
    g.appendChild(label(x + 40, 250, "One season cuts the structure to a", { size: 10 }));
    g.appendChild(label(x + 40, 264, "stub; what is left, against the lot,", { size: 10 }));
    g.appendChild(label(x + 40, 278, "decides the path.", { size: 10 }));
    root.appendChild(g);
    frames.push(g);
  }
  /* frame 2: three paths, a fan whose bands are as wide as the shares */
  {
    const g = svg("g", { class: "frame" });
    const x = fx(2);
    g.appendChild(label(x, 22, "3  Three paths", { fill: INK, size: 12.5, weight: 600 }));
    const paths = [
      { key: "restored", share: sp.restored, color: RESTORED_INK, y: 70, text: "restored in place" },
      { key: "replaced", share: sp.replaced, color: REC.replaced, y: 150, text: "replaced" },
      { key: "cleared", share: sp.cleared, color: REC.cleared, y: 215, text: "cleared" },
    ];
    const x0 = x + 18;
    const x1 = x + 120;
    const total = 130;
    let top = 60;
    for (const p of paths) {
      const h = Math.max(4, total * p.share);
      const yc = p.y;
      g.appendChild(svg("path", {
        d: `M${x0},${top}C${(x0 + x1) / 2},${top} ${(x0 + x1) / 2},${yc - h / 2} ${x1},${yc - h / 2}`
          + `L${x1},${yc + h / 2}C${(x0 + x1) / 2},${yc + h / 2} ${(x0 + x1) / 2},${top + h} ${x0},${top + h}Z`,
        fill: p.color, opacity: .55, class: `band band-${p.key}`,
      }));
      top += h;
      if (p.key === "restored") g.appendChild(house(x1 + 14, yc - 24, 44, 36, RESTORED_INK));
      if (p.key === "replaced") g.appendChild(house(x1 + 10, yc - 30, 44 * (1 + area), 36 * (1 + area), REC.replaced));
      g.appendChild(lot(x1 + 8, yc + 14, 62));
      g.appendChild(label(x1 + 80, yc + 4, fmt.pct(p.share, 0), { fill: p.color === REC.cleared ? MUTED : p.color, size: 12, weight: 600 }));
      g.appendChild(label(x1 + 80, yc + 18, p.text, { size: 9 }));
    }
    g.appendChild(svg("rect", { x: x0 - 8, y: 58, width: 8, height: total, fill: PINK, opacity: .35 }));
    g.appendChild(label(x + 8, 250, "Severely damaged own-lot houses of", { size: 10 }));
    g.appendChild(label(x + 8, 264, `Ian, Michael and Irma at roll 4 (${fmt.count(sp.n)}).`, { size: 10 }));
    root.appendChild(g);
    frames.push(g);
  }
  /* frame 3: the next hurricane takes a share of each structure’s value */
  {
    const g = svg("g", { class: "frame" });
    const x = fx(3);
    g.appendChild(label(x, 22, "4  The next hurricane", { fill: INK, size: 12.5, weight: 600 }));
    g.appendChild(svg("path", {
      d: `M${x + 40},${44}q20,-14 40,0t40,0t40,0t40,0`, fill: "none", stroke: PINK, "stroke-width": 2,
      "stroke-linecap": "round",
    }));
    const rows = [
      { y: 70, w: 100, lost: .34, color: RESTORED_INK, text: "restored: the old stock’s share" },
      { y: 128, w: 100 * Math.min(2.2, (c.value[0] + c.value[1]) / 2), lost: .34 * (c.vulnerability[0] + c.vulnerability[1]) / 2,
        color: REC.replaced, text: "replaced: a smaller share of more value" },
      { y: 186, w: 0, lost: 0, color: REC.cleared, text: "cleared: nothing to lose" },
    ];
    for (const r of rows) {
      const bx = x + 14;
      if (r.w) {
        g.appendChild(svg("rect", { x: bx, y: r.y, width: r.w, height: 11, fill: r.color }));
        g.appendChild(svg("rect", { x: bx + r.w * (1 - r.lost), y: r.y, width: r.w * r.lost, height: 11, fill: PINK }));
      } else {
        g.appendChild(lot(bx, r.y + 8, 100));
      }
      g.appendChild(label(bx, r.y + 26, r.text, { size: 9.5 }));
    }
    g.appendChild(label(x + 14, 250, "Bar lengths are schematic; the ratios", { size: 10 }));
    g.appendChild(label(x + 14, 264, "are read below and on the last tab.", { size: 10 }));
    root.appendChild(g);
    frames.push(g);
  }
  root.appendChild(svg("line", { x1: 0, x2: W, y1: H - 1, y2: H - 1, stroke: RULE }));

  /* readout: four cells, one per frame */
  const cells = [
    { k: "Severely damaged houses followed", v: motion.span(sp.n, "int", "n"), d: "Site-built houses on their own lot in the damage counties of the three storms whose rolls record deleted value; sixteen storms and 272 county-storms stand behind them" },
    { k: "Exit by the fourth roll, severe against undamaged", v: el("span", {}, [motion.span(mult[0], "num0", "m0"), " to ", motion.span(mult[1], "num0", "m1"), el("small", { text: " times" })]),
      d: `Charley, Ivan, Michael and Ian; ${fmt.num(100 * Math.min(...timing), 0)} to ${fmt.num(100 * Math.max(...timing), 0)}% of the exits made in eight rolls are made by the fourth` },
    { k: "Restored in place", v: el("span", {}, [motion.span(sp.restored, "pct0", "r")]),
      d: `${fmt.pct(sp.replaced, 0)} replaced and ${fmt.pct(sp.cleared, 0)} cleared; exit falls ${fmt.num(fold, 0)}-fold along structure value left over lot value` },
    { k: "A replacement’s share of value lost", v: el("span", {}, [motion.span(c.vulnerability[0], "num2", "v0"), " to ", motion.span(c.vulnerability[1], "num2", "v1")]),
      d: `of an intact neighbor’s, on ${fmt.num(c.value[0], 1)} to ${fmt.num(c.value[1], 1)} times the value, so ${fmt.num(c.dollars[0], 2)} to ${fmt.num(c.dollars[1], 2)} times the dollars` },
  ];
  const stageEls = cells.map((cItem) => el("div.stage", {}, [
    el("p.k", { text: cItem.k }), el("p.v", {}, [cItem.v]), el("p.d", { text: cItem.d }),
  ]));
  read.append(...stageEls);
  cap.textContent = "Read left to right: a house and its lot before the storm, the storm cutting the structure to a stub while the lot keeps its value, the fan carrying severely damaged houses into three paths as wide as their shares, and the next hurricane taking a share of what stands. All the numbers are associations read from the assessment rolls, not effects of repairing or replacing.";

  let counted = false;
  function stage(s) {
    frames.forEach((f, i) => {
      f.classList.toggle("dim", s !== null && i !== s);
    });
    stageEls.forEach((n, i) => n.classList.toggle("off", s !== null && i !== s));
    if (!counted) { counted = true; motion.count(read, 1400); }
  }

  const t = tour({
    name: "the framework",
    after: () => {},
    rest: () => stage(null),
    steps: [
      { cap: "Before the storm: a durable house on its lot", ms: 3200, run: (c2) => { stage(0); return c2.sleep(3200); } },
      { cap: "The storm: the structure’s value falls to a stub", ms: 3200, run: (c2) => { stage(1); return c2.sleep(3200); } },
      { cap: "Three paths: most houses are restored in place", ms: 3600, run: (c2) => { stage(2); return c2.sleep(3600); } },
      { cap: "The next hurricane: what each path exposes", ms: 3600, run: (c2) => { stage(3); return c2.sleep(3600); } },
      { cap: "The whole story", ms: 2600, run: (c2) => { stage(null); return c2.sleep(2600); } },
    ],
  });
  stage(t.reduced ? null : 0);
  t.attach(tourHost);
  if (t.reduced) motion.count(read, 0);
}
