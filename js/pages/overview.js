import { boot } from "../shell.js";
import { el, $, clear } from "../lib/dom.js";
import * as fmt from "../lib/format.js";
import { heroChart } from "../charts/hero.js";

boot({
  id: "overview",
  needs: ["overview"],
  mount(app) {
    heroChart($("#chart"), app);
    const ov = app.overview;
    const wins = Object.values(ov.window).filter((w) => w.multiplier4);
    const m = [Math.min(...wins.map((w) => w.multiplier4)), Math.max(...wins.map((w) => w.multiplier4))];
    const sl = ov.threshold_slope;
    const storms = ["ian_2022", "michael_2018", "irma_2017"].filter((s) => sl[s]);
    const slopes = storms.map((s) => fmt.num(-100 * sl[s].coef, 1));
    const c = ov.consequence;
    const r = ov.rates.charley_to_ian;
    const tiles = $("#tiles");
    clear(tiles).append(
      el("a.tile", { href: "renewal.html" }, [
        el("p.tier", { text: "Shock" }),
        el("h3", { text: "The renewal window" }),
        el("p", { text: `Within four rolls a severely damaged house is ${fmt.num(m[0], 0)} to ${fmt.num(m[1], 0)} times as likely to have left the stock as an undamaged house in the same counties, and most exits made in eight rolls are made by then. Even so, ${fmt.pct(ov.split.pooled.restored, 0)} of severely damaged houses are restored in place.` }),
        el("span.go", { text: "Exit roll by roll, and what stands on the lot" }),
      ]),
      el("a.tile.pink", { href: "predictors.html" }, [
        el("p.tier", { text: "Mechanism" }),
        el("h3", { text: "The redevelopment threshold" }),
        el("p", { text: `Exit by roll 4 falls about a hundredfold along one index, the structure value the storm left over the value of the lot: one log unit of the index moves exit by ${slopes.join(", ")} points after ${storms.map((s) => app.meta.storms[s].split(" ")[0]).join(", ")}. Tract income adds nothing once the index is held.` }),
        el("span.go", { text: "The curve, the plane and the models" }),
      ]),
      el("a.tile.green", { href: "lee.html" }, [
        el("p.tier", { text: "Consequence" }),
        el("h3", { text: "What the next hurricane found" }),
        el("p", { text: `In the counties Charley damaged, Ian severely damaged ${fmt.pct(r.intact.rate, 1)} of the intact old stock, ${fmt.pct(r.documented_repair.rate, 1)} of documented repairs and ${fmt.pct(r.replaced.rate, 1)} of replacements. A replacement loses ${fmt.num(c.vulnerability[0], 2)} to ${fmt.num(c.vulnerability[1], 2)} of the intact share of value on ${fmt.num(c.value[0], 1)} to ${fmt.num(c.value[1], 1)} times the value.` }),
        el("span.go", { text: "The recovery plane, every estimate, the Charley cohort in Lee County" }),
      ]),
    );
  },
});
