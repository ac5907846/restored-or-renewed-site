import { boot } from "../shell.js";
import { $ } from "../lib/dom.js";
import { exposureChart } from "../charts/exposure.js";

boot({
  id: "exposure",
  needs: ["exposure", "overview", "geo"],
  mount(app) { exposureChart($("#chart"), app); },
});
