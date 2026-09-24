import { boot } from "../shell.js";
import { $ } from "../lib/dom.js";
import { pathwaysChart } from "../charts/pathways.js";

boot({
  id: "pathways",
  needs: ["pathways"],
  mount(app) { pathwaysChart($("#chart"), app); },
});
