/* Numbers that count to their value. A number to animate is written as
   <span data-count="0.73" data-fmt="pct0">73%</span>, so the page reads
   right before, during and after the animation, and with reduced motion
   it never moves. Frames fall back to a timer so a headless or
   background tab still lands on the final value. */

import * as fmt from "./format.js";

export const reduced = window.matchMedia
  && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** pct1 -> fmt.pct(v, 1); num2 -> fmt.num(v, 2); int -> fmt.count(v);
    x1 -> "3.2x". */
export function format(name, v) {
  const m = /^([a-z]+)(\d?)$/.exec(name || "int");
  const d = m[2] === "" ? undefined : Number(m[2]);
  if (m[1] === "int") return fmt.count(v);
  if (m[1] === "pct") return fmt.pct(v, d ?? 0);
  if (m[1] === "num") return fmt.num(v, d ?? 2);
  if (m[1] === "x") return `${fmt.num(v, d ?? 1)}x`;
  return String(v);
}

export function span(v, name, key) {
  const attrs = { "data-count": v, "data-fmt": name, text: format(name, v) };
  if (key) attrs["data-key"] = key;
  const node = document.createElement("span");
  for (const [k, val] of Object.entries(attrs)) {
    if (k === "text") node.textContent = val; else node.setAttribute(k, val);
  }
  return node;
}

const ease = (t) => 1 - (1 - t) ** 3;

/** Every [data-count] under root counts from data-from (or zero). */
export function count(root, dur = 1100) {
  if (!root) return;
  const els = [...root.querySelectorAll("[data-count]")];
  if (reduced || !els.length) return;
  const jobs = els.map((n) => {
    const to = Number(n.getAttribute("data-count"));
    const from = n.hasAttribute("data-from") ? Number(n.getAttribute("data-from")) : 0;
    n.removeAttribute("data-from");
    return { n, to, from, f: n.getAttribute("data-fmt") };
  });
  let t0 = null;
  let done = false;
  const paint = (t) => {
    const k = ease(t);
    for (const j of jobs) {
      if (!j.n.isConnected) continue;
      j.n.textContent = format(j.f, t === 1 ? j.to : j.from + (j.to - j.from) * k);
    }
  };
  const frame = (ts) => {
    if (done) return;
    if (t0 === null) t0 = ts;
    const t = Math.min(1, (ts - t0) / dur);
    paint(t);
    if (t < 1) requestAnimationFrame(frame); else done = true;
  };
  requestAnimationFrame(frame);
  setTimeout(() => { if (!done) { done = true; paint(1); } }, dur + 250);
}

/** Values shown before a re-render, keyed, so the new ones move from them. */
export function snapshot(root) {
  const out = {};
  for (const n of root.querySelectorAll("[data-key]")) {
    out[n.getAttribute("data-key")] = n.getAttribute("data-count");
  }
  return out;
}
export function carry(before, root) {
  for (const n of root.querySelectorAll("[data-key]")) {
    const v = before[n.getAttribute("data-key")];
    if (v !== undefined && v !== n.getAttribute("data-count")) n.setAttribute("data-from", v);
  }
}
