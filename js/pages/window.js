import { boot } from "../shell.js";
import { $ } from "../lib/dom.js";
import { windowChart } from "../charts/window.js";

boot({
  id: "window",
  needs: ["window", "pathways", "overview"],
  mount(app) { windowChart($("#chart"), app); },
});
