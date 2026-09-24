import { boot } from "../shell.js";
import { $ } from "../lib/dom.js";
import { thresholdChart } from "../charts/threshold.js";

boot({
  id: "threshold",
  needs: ["threshold", "overview"],
  mount(app) { thresholdChart($("#chart"), app); },
});
