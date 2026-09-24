/* Shared page shell. Every page is a real HTML document with its own
   URL and carries its masthead and tab bar as static markup, so the
   frame paints before any script or data arrives. This module marks
   the active tab, shows a placeholder in the chart block, loads only
   the data that page asks for, and hands control to the page's own
   module. */

import { el, clear, $ } from "./lib/dom.js";
import * as fmt from "./lib/format.js";

export const VERSION = "2";

/* The site map, in tab order: the overview, the study area, then the
   paper's three tiers (the renewal window, the pathways it produces,
   the redevelopment threshold behind them, the next-storm exposure),
   then the data and methods. */
export const PAGES = [
  { id: "overview", file: "index.html", tab: "Overview",
    title: "Restored or renewed?" },
  { id: "storms", file: "storms.html", tab: "Sixteen storms",
    title: "Sixteen hurricanes on the assessment rolls" },
  { id: "window", file: "renewal.html", tab: "Renewal window",
    title: "The renewal window: exit from the stock, roll by roll" },
  { id: "pathways", file: "pathways.html", tab: "Pathways",
    title: "What stands on the lot: the recovery pathways" },
  { id: "threshold", file: "predictors.html", tab: "Redevelopment threshold",
    title: "Which houses leave: the redevelopment threshold" },
  { id: "exposure", file: "lee.html", tab: "Next hurricane",
    title: "What each path exposes to the next hurricane" },
  { id: "data", file: "data.html", tab: "Data and methods",
    title: "Data and methods" },
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
