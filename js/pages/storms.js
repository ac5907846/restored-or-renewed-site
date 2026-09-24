import { boot } from "../shell.js";
import { $ } from "../lib/dom.js";
import { stormsChart } from "../charts/storms.js";

boot({
  id: "storms",
  needs: ["storms", "geo"],
  mount(app) { stormsChart($("#chart"), app); },
});
