/* Data and methods. Source metadata is site content and lives here;
   every estimate on the page is read from methods.json. */

import { boot } from "../shell.js";
import { el, clear, $ } from "../lib/dom.js";
import * as fmt from "../lib/format.js";

const SOURCES = [
  ["Florida Department of Revenue, Name-Address-Legal (NAL) real-property rolls, Final 2002 to 2025 and Preliminary 2026",
    "Property Tax Oversight program, 67 county property appraisers",
    "Use code, year built, just value, land value, homestead value, new-construction value, deleted value, living area, building count, owner state, census block",
    "24 annual statewide rolls, about 10 million parcels each",
    "https://floridarevenue.com/property/dataportal"],
  ["Florida Department of Revenue, Sales Data Files (SDF), 2009 to 2025",
    "Property Tax Oversight program",
    "Recorded transfers with month, price and qualification code",
    "17 annual statewide files",
    "https://floridarevenue.com/property/dataportal"],
  ["FEMA Individuals and Households Program valid registrations",
    "OpenFEMA",
    "Registrations, inspections and inspector-recorded destroyed dwellings per county and tract, per storm",
    "Florida registrations for 16 disasters",
    "https://www.fema.gov/openfema"],
  ["FEMA disaster declarations summaries",
    "OpenFEMA",
    "Counties declared for Individual Assistance per storm",
    "16 declarations",
    "https://www.fema.gov/openfema"],
  ["HURDAT2 Atlantic best track",
    "National Hurricane Center",
    "Tracks and the strongest Florida landfall of each storm",
    "16 storm tracks",
    "https://www.nhc.noaa.gov/data/"],
  ["Florida statewide parcel layer, 2025 assessment roll",
    "Florida Geographic Information Office",
    "Parcel centroids for the Lee County map",
    "Eight southwest counties",
    "https://www.floridagio.gov"],
  ["Municipal building permits, City of Cape Coral and Charlotte County",
    "Open-data portals of the two governments",
    "Permit type, issue date and parcel key, matched to the roll’s pathway classes",
    "Permits issued 2023 to 2025",
    "https://capecoral.gov"],
  ["American Community Survey five-year estimates",
    "U.S. Census Bureau",
    "Tract median household income, the household-resource check",
    "2015 to 2019, or 2017 to 2021 for three counties",
    "https://www.census.gov/programs-surveys/acs"],
  ["TIGER/Line county boundaries",
    "U.S. Census Bureau",
    "County outlines",
    "67 counties",
    "https://www.census.gov/geographies/mapping-files.html"],
];

function table(host, columns, rows, fmtRow) {
  const tbl = el("table.dtable");
  tbl.appendChild(el("thead", {}, [el("tr", {}, columns.map((c) => el("th", { text: c })))]));
  const tb = el("tbody");
  for (const r of rows) tb.appendChild(el("tr", {}, fmtRow(r).map((v) => el("td", { text: v }))));
  tbl.appendChild(tb);
  host.appendChild(tbl);
}

boot({
  id: "data",
  needs: ["methods"],
  mount(app) {
    const meta = app.meta;
    const M = app.methods;
    const src = $("#sources");
    const st = el("table");
    st.appendChild(el("thead", {}, [el("tr", {}, ["Dataset", "Source", "Variables derived", "Records used"].map((c) => el("th", { text: c })))]));
    const sb = el("tbody");
    for (const [name, who, what, size, url] of SOURCES) {
      sb.appendChild(el("tr", {}, [
        el("td", {}, [el("a", { href: url, text: name, target: "_blank", rel: "noopener" })]),
        el("td", { text: who }), el("td", { text: what }), el("td", { text: size }),
      ]));
    }
    st.appendChild(sb);
    src.appendChild(st);
    const med = M.deleted_share.filter((r) => r.structure_type === "all");
    if (med.length) {
      $("#median").appendChild(el("p.note", { text: "Where the roll records a deletion, the deleted share of a severe loss is near-total at the median, so severe reads as near-total loss and not as the NFIP one-half line." }));
      table($("#median"), ["Storms", "Severe losses", "With a deletion", "Median deleted share", "Share at .9 or more"], med,
        (r) => [r.group_label, fmt.count(r.n_severe), `${fmt.num(r.share_with_deletion_pct, 0)}%`, fmt.num(r.median_with_deletion, 2), `${fmt.num(r.share_ge_90_of_severe_pct, 0)}%`]);
    }
    const g4 = M.gate4_stratum.filter((r) => ["low", "mid", "high", "destruction"].includes(r.stratum));
    $("#gate4").appendChild(el("p.note", { text: "Check against FEMA registrations after Ian: severe 2023-roll markers on 2022-roll structures, per 100, across tract strata of registration density in the eight southwest counties (the destruction stratum is tracts where at least 5% of inspected dwellings were destroyed)." }));
    table($("#gate4"), ["Stratum", "Structures", "Severe markers per 100"], g4,
      (r) => [r.stratum, fmt.count(r.pre_structures), fmt.num(r.severe_per100, 2)]);
    $("#gate5").appendChild(el("p.note", { text: "Across each storm’s declared counties, Spearman correlation between the excess severe-loss rate and inspector-recorded destroyed dwellings per 100 parcels." }));
    table($("#gate5"), ["Storm", "Counties", "Spearman rho"],
      M.gate5_county.slice().sort((a, b) => a.storm.slice(-4) - b.storm.slice(-4)),
      (r) => [meta.storms[r.storm] || r.storm, String(r.n_counties), fmt.num(r.spearman_substantial_vs_ihp, 2)]);
    const cont = M.continuity.filter((r) => String(r.roll_a) === "2022");
    $("#continuity").appendChild(el("p.note", { text: "Share of 2022-roll parcels found in the 2023 roll by parcel identifier alone, eight southwest counties. Lee’s gap is the Lehigh Acres renumbering, closed by the statewide parcel identifier." }));
    table($("#continuity"), ["County", "Parcels 2022", "Found in 2023 by id"], cont,
      (r) => [r.county, fmt.count(r.parcels_a), `${fmt.num(r.share_a_in_b, 1)}%`]);
    const wf = M.workflow;
    const num = (v) => (v === undefined || v === null || Number.isNaN(Number(v)) ? String(v ?? "") : fmt.count(Number(v)));
    const items = [
      ["Assessment rolls linked", `${wf.n_rolls} (${wf.roll_first} to ${wf.roll_last}, the last a preliminary roll)`],
      ["Hurricanes", `${wf.n_storms} (${wf.season_first} to ${wf.season_last})`],
      ["County-storms declared for Individual Assistance", num(wf.n_county_storms)],
      ["Structure records on their pre-storm rolls", num(wf.records)],
      ["County-storms analyzed, one storm per county-season", num(wf.n_primary_cs)],
      ["Damage county-storms (counties, storms)", `${num(wf.n_dmg_cs)} (${num(wf.n_dmg_counties)}, ${num(wf.n_dmg_storms)})`],
      ["Severe losses in the damage county-storms", num(wf.severe_all)],
      ["Of them site-built houses on their own lot", num(wf.severe_ownlot)],
      ["Condominium units", num(wf.severe_condo)],
      ["Mobile homes", num(wf.severe_mobile)],
      ["Renewal window: severe and undamaged houses", `${num(wf.t1_severe)} and ${num(wf.t1_undamaged)}`],
      ["Redevelopment threshold: damaged houses (tract clusters)", `${num(wf.t2_n)} (${num(wf.t2_clusters)})`],
      ["Next-storm exposure: adjusted estimates", `${wf.t3_specs} (${wf.t3_specs_split}) over ${wf.t3_designs} designs, ${wf.t3_first} to ${wf.t3_second}`],
    ];
    table($("#workflow"), ["Count carried forward", "Value"], items, (r) => [r[0], String(r[1])]);
    const fc = M.fema_correlations;
    $("#fema").appendChild(el("p.note", { text: "Exit of severely damaged own-lot houses against FEMA’s record of destroyed dwellings, Spearman across county-storms with at least 100 severe losses and FEMA inspections; the roll’s own removal booking on the first post-storm roll is shown for comparison and is never used as the exit measure." }));
    const names = { gone_at_roll1: "Booked as removed on roll 1", exit2: "Exited by roll 2", exit4: "Exited by roll 4" };
    table($("#fema"), ["Measure", "Spearman rho", "p", "County-storms"], fc,
      (r) => [names[r.measure] || r.measure, fmt.num(r.spearman_rho, 2), fmt.pval(r.p), String(r.n_county_storms)]);
  },
});
