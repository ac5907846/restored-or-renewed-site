/* Shared page shell. Every page is a real HTML document with its own
   URL and carries its masthead and tab bar as static markup, so the
   frame paints before any script or data arrives. This module marks
   the active tab, shows a placeholder in the chart block, loads only
   the data that page asks for, and hands control to the page's own
   module. */

import { el, clear, $ } from "./lib/dom.js";
import * as fmt from "./lib/format.js";

export const VERSION = "3";

/* The site map, in tab order: the study area, then the paper's three
   tiers (the renewal window, the redevelopment threshold, the
   next-storm exposure). */
export const PAGES = [
  { id: "storms", file: "index.html", tab: "Sixteen storms",
    title: "Sixteen hurricanes on the assessment rolls" },
  { id: "window", file: "renewal.html", tab: "Renewal window",
    title: "Exit from the stock, roll by roll, and what stands on the lot" },
  { id: "threshold", file: "threshold.html", tab: "Redevelopment threshold",
    title: "Exit against the structure value left over the value of the lot" },
  { id: "exposure", file: "exposure.html", tab: "Next storm",
    title: "What each pathway exposed to the next hurricane" },
];

const FILES = {
  meta: "data/meta.json",
  overview: "data/overview.json",
  window: "data/window.json",
  pathways: "data/pathways.json",
  threshold: "data/threshold.json",
  exposure: "data/exposure.json",
  storms: "data/storms.json",
  methods: "data/methods.json",
};

async function getJSON(path) {
  const res = await fetch(`${path}?v=${VERSION}`);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

async function loadInto(app, needs) {
  const wanted = new Set(["meta", ...needs]);
  const geo = wanted.has("geo");
  wanted.delete("geo");
  const keys = [...wanted];
  const parts = await Promise.all(keys.map((k) => getJSON(FILES[k])));
  keys.forEach((k, i) => { app[k] = parts[i]; });
  if (geo) {
    const [counties, context, tracks] = await Promise.all([
      getJSON("data/geo/counties.json"),
      getJSON("data/geo/context.json"),
      getJSON("data/geo/tracks.json"),
    ]);
    app.geo = { counties: counties.counties, context, tracks };
  }
  return app;
}

function markTabs(page) {
  const host = $("#sitenav");
  if (!host) return;
  for (const a of host.querySelectorAll("a")) {
    const on = a.getAttribute("href") === page.file;
    a.classList.toggle("active", on);
    if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  }
}

function placeholder(mount) {
  if (!mount || mount.children.length) return;
  mount.appendChild(el("div.loading", {}, [
    el("i.loading-bar"),
    el("span", { text: "Reading the data layer" }),
  ]));
}

function failure(message) {
  const mount = $("#chart") || $("#page") || document.body;
  clear(mount).appendChild(el("div.errorbox", { html: message }));
}

/** Entry point for every page module. */
export async function boot({ id, needs = [], mount }) {
  const page = PAGES.find((p) => p.id === id);
  markTabs(page);
  if (location.protocol === "file:") {
    failure("This site loads its data from <code>data/</code>, which a browser "
      + "will not read from the file system. Start a local server in the app "
      + "folder and open the address it prints:<br><br>"
      + "<code>py -3 -m http.server 8000</code><br>then visit "
      + "<code>http://localhost:8000</code>.");
    return;
  }
  placeholder($("#chart"));
  try {
    const app = {};
    await loadInto(app, needs);
    document.title = page.file === "index.html"
      ? app.meta.title
      : `${page.title} | ${app.meta.short_title || app.meta.title}`;
    if (mount) await mount(app, page);
  } catch (err) {
    failure("Could not load the data layer: "
      + `<code>${err.message}</code>. Run `
      + "<code>py -3 tools/build_data.py</code> and reload.");
    throw err;
  }
}

export { fmt };
