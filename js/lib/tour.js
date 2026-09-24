/* A guided tour for one figure: a looping list of steps that plays by
   itself when the page opens, a Play/Pause text button with a thin
   progress bar, and a caption that names the step. Any pointer, key,
   wheel or touch input anywhere on the page pauses every tour; only
   the button resumes one. With reduced motion requested the tour does
   not start and the figure shows its resting state. */

import { el } from "./dom.js";

const STOP = { stop: true };
const reduced = window.matchMedia
  && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const all = [];
let listening = false;

function listen() {
  if (listening) return;
  listening = true;
  const interrupt = (e) => {
    if (e.target && e.target.closest && e.target.closest(".tour")) return;
    for (const t of all) t.pause();
  };
  document.addEventListener("pointerdown", interrupt, true);
  document.addEventListener("keydown", interrupt, true);
  window.addEventListener("wheel", interrupt, { passive: true, capture: true });
  window.addEventListener("touchstart", interrupt, { passive: true, capture: true });
}

/**
 * steps: [{ cap, ms, run(ctx) }] where run returns a promise that resolves
 * when the step is done; ctx.sleep(ms) rejects when the tour is paused,
 * which ends the step early. after() runs when the tour pauses or a step
 * ends; rest() puts the figure in its resting state (used with reduced
 * motion and after the last lap).
 */
export function tour({ name, steps, after, rest, autoplay = true, loops = Infinity }) {
  let gen = 0;
  let playing = false;
  let idx = 0;
  let laps = 0;
  let ui = null;
  let cap = null;
  let btn = null;
  let bar = null;
  let word = null;

  function sleep(ms) {
    const g = gen;
    return new Promise((res, rej) => {
      setTimeout(() => { if (g === gen && playing) res(); else rej(STOP); }, ms);
    });
  }
  const ctx = { sleep, caption: (t) => { if (cap) cap.textContent = t; }, laps: () => laps };

  function progress(step) {
    if (!bar) return;
    const total = steps.reduce((a, s) => a + s.ms, 0);
    const before = steps.slice(0, idx).reduce((a, s) => a + s.ms, 0);
    bar.style.transition = "none";
    bar.style.transform = `scaleX(${before / total})`;
    bar.getBoundingClientRect();
    bar.style.transition = `transform ${step.ms}ms linear`;
    bar.style.transform = `scaleX(${(before + step.ms) / total})`;
  }
  function freeze() {
    if (!bar) return;
    const now = getComputedStyle(bar).transform;
    bar.style.transition = "none";
    bar.style.transform = now;
  }

  function loop() {
    const g = gen;
    const step = steps[idx];
    ctx.caption(step.cap);
    progress(step);
    Promise.resolve().then(() => step.run(ctx)).then(next, (e) => {
      if (e !== STOP) { console.error(e); pause(); }
    });
    function next() {
      if (g !== gen) return;
      if (after) after();
      idx = (idx + 1) % steps.length;
      if (idx === 0) {
        laps += 1;
        if (laps >= loops) { pause(); if (rest) rest(); return; }
      }
      loop();
    }
  }

  function paint() {
    if (!ui) return;
    ui.classList.toggle("on", playing);
    word.textContent = playing ? "Pause" : "Play";
    btn.setAttribute("aria-label", `${playing ? "Pause" : "Play"} the tour of ${name}`);
  }
  function play() {
    if (playing || !ui) return;
    playing = true;
    gen += 1;
    paint();
    loop();
  }
  function pause() {
    if (!playing) return;
    playing = false;
    gen += 1;
    freeze();
    if (after) after();
    paint();
  }

  /** Build the control and, unless motion is reduced, start. */
  function attach(host) {
    listen();
    if (!ui) {
      cap = el("span.tour-cap", { "aria-live": "polite" });
      word = el("span.tour-t", { text: "Play" });
      bar = el("i.tour-bar");
      btn = el("button.tour-btn", { type: "button", onclick: () => (playing ? pause() : play()) }, [word, bar]);
      ui = el("div.tour", {}, [cap, btn]);
    }
    host.appendChild(ui);
    paint();
    if (reduced) { if (rest) rest(); return inst; }
    if (autoplay) play();
    return inst;
  }

  const inst = { attach, play, pause, isPlaying: () => playing, reduced };
  all.push(inst);
  return inst;
}

export { reduced };
