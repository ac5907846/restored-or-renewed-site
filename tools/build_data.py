#!/usr/bin/env python3
r"""Build the companion site's data layer from the analysis outputs.
Every number the site shows is written here from 02_analysis\a*\results\*;
nothing is typed into a page. The pages follow the paper's three tiers
(the renewal window, the redevelopment threshold, the next-storm exposure)
and read only the files named below.

Reads   02_analysis\a05, a08, a09, a10, a12, a13, a17, a18, a19, a20, a21
        results (and a06 for the Lee County parcel coordinates)
Writes  05_webapp\data\*.json and data\geo\tracks.json
        (data\geo\counties.json and context.json are the Florida county
        outlines shared with the Paper 1 site)

Usage:
    py -3 build_data.py            rebuild every file
    py -3 build_data.py --check    rebuild, then compare a set of published
                                   values against the claims file numbers
"""

import json
import math
import sys
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
APP = HERE.parent
ROOT = APP.parent
A = ROOT / "02_analysis"
DATA = APP / "data"

sys.path.insert(0, str(A))
from _shared.constants import REC, REC_LABEL, STORM_STYLE  # noqa: E402

STORM_NAMES = {
    "charley_2004": "Charley 2004", "frances_2004": "Frances 2004",
    "ivan_2004": "Ivan 2004", "jeanne_2004": "Jeanne 2004",
    "dennis_2005": "Dennis 2005", "wilma_2005": "Wilma 2005",
    "hermine_2016": "Hermine 2016", "matthew_2016": "Matthew 2016",
    "irma_2017": "Irma 2017", "michael_2018": "Michael 2018",
    "sally_2020": "Sally 2020", "ian_2022": "Ian 2022",
    "nicole_2022": "Nicole 2022", "idalia_2023": "Idalia 2023",
    "helene_2024": "Helene 2024", "milton_2024": "Milton 2024",
    "pooled": "Three storms pooled",
}
PAIRS = {
    "charley_to_ian": "Charley 2004 to Ian 2022",
    "irma_to_ian": "Irma 2017 to Ian 2022",
    "ian_to_milton": "Ian 2022 to Milton 2024",
    "charley_to_milton": "Charley 2004 to Milton 2024",
    "wilma_to_irma": "Wilma 2005 to Irma 2017",
}
# a17 and a19 name the classes by their old keys; the site uses the
# paper's keys and labels (constants.REC_LABEL)
CLASS_KEY = {
    "none": "less_documented", "less-documented recovery": "less_documented",
    "repaired": "documented_repair", "documented repair": "documented_repair",
    "replaced": "replaced", "new_build": "new_build", "new build": "new_build",
    "intact": "intact", "cleared": "cleared",
}
WINDOW_MIN_SEVERE = 1000     # Fig. 3 gate: severe own-lot houses per storm
WINDOW_MIN_ROLLS = 3
THRESH_MIN_N = 50            # Fig. 5 gate: houses per bin or cell
EXPOSURE_PAIRS = ["charley_to_ian", "irma_to_ian"]


def clean(o):
    """Replace NaN and infinities with None so the browser accepts the JSON."""
    if isinstance(o, dict):
        return {k: clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [clean(v) for v in o]
    if isinstance(o, float) and (math.isnan(o) or math.isinf(o)):
        return None
    if hasattr(o, "item"):
        return clean(o.item())
    return o


def dump(name, obj):
    path = DATA / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(clean(obj), separators=(",", ":")), encoding="utf-8")
    print(f"  {name}  {path.stat().st_size / 1e3:.0f} kB")


def records(df):
    return [clean(r) for r in df.to_dict("records")]


def rd(stage, name, **kw):
    return pd.read_csv(A / stage / "results" / name, **kw)


# ------------------------------------------------------------------ overview
def build_overview():
    """The numbers of the landing page: the pooled pathway split of Fig. 1,
    the window multipliers of Fig. 3, the threshold ends of Fig. 5, the
    exposure ratios of Fig. 6 and the cohort rates of Fig. 7."""
    split = rd("a21_framework_figures", "concept_split.csv")
    shares = {}
    for storm, g in split.groupby("storm"):
        s = g.set_index("rclass")["share"]
        shares[storm] = {
            "n": int(g["n_total"].iloc[0]),
            "documented_repair": float(s["documented_repair"]),
            "less_documented": float(s["less_documented"]),
            "replaced": float(s["replaced"]),
            "cleared": float(s["cleared"]),
            "restored": float(s["documented_repair"] + s["less_documented"]),
        }

    win = rd("a18_path_measures", "window_by_storm_k.csv")
    window = {}
    for storm, g in win.groupby("storm"):
        sev = g[g["group"] == "severe"].set_index("k")
        und = g[g["group"] == "undamaged"].set_index("k")
        if sev["n"].iloc[0] < WINDOW_MIN_SEVERE or sev.index.max() < WINDOW_MIN_ROLLS:
            continue
        row = {"n_severe": int(sev["n"].iloc[0]), "n_undamaged": int(und["n"].iloc[0]),
               "k_max": int(sev.index.max())}
        if 4 in sev.index:
            row["severe_exit4"] = float(sev.loc[4, "cum_exit"])
            row["undamaged_exit4"] = float(und.loc[4, "cum_exit"])
            row["multiplier4"] = row["severe_exit4"] / row["undamaged_exit4"]
        if 8 in sev.index:
            row["multiplier8"] = float(sev.loc[8, "cum_exit"] / und.loc[8, "cum_exit"])
            row["share_by4_of8"] = float(sev.loc[4, "cum_exit"] / sev.loc[8, "cum_exit"])
        window[storm] = row

    cur = rd("a18_path_measures", "threshold_curve.csv")
    thresh = {}
    for storm, g in cur.groupby("storm"):
        g = g[g["n"] >= THRESH_MIN_N]
        first, last = g.iloc[0], g.iloc[-1]
        thresh[storm] = {"lowest_bin": first["ratio_bin"], "exit_lowest": float(first["exit4"]),
                         "highest_bin": last["ratio_bin"], "exit_highest": float(last["exit4"]),
                         "fold": float(first["exit4"] / last["exit4"]),
                         "n": int(g["n"].sum()), "n_damaged": int(g["n_damaged"].sum())}
    tm = rd("a18_path_measures", "threshold_models.csv")
    slope = {r.storm: {"coef": float(r.coef), "se": float(r.se), "p": float(r.p), "n": int(r.n)}
             for r in tm[(tm["term"] == "log_ratio") & (tm["outcome"] == "exit4")].itertuples()}

    dec = rd("a19_consequence_checks", "loss_decomposition.csv")
    d = dec[(dec["frame"] == "same tract") & dec["pair"].isin(EXPOSURE_PAIRS)
            & dec["class"].isin(["replaced", "new build"])]
    consequence = {
        "vulnerability": [float(d["ratio_vulnerability"].min()), float(d["ratio_vulnerability"].max())],
        "value": [float(d["ratio_value"].min()), float(d["ratio_value"].max())],
        "dollars": [float(d["ratio_dollars"].min()), float(d["ratio_dollars"].max())],
        "rows": [{"pair": r.pair, "class": CLASS_KEY[r._2], "vulnerability": float(r.ratio_vulnerability),
                  "value": float(r.ratio_value), "dollars": float(r.ratio_dollars)}
                 for r in d.itertuples()],
    }

    form = rd("a18_path_measures", "form_persistence.csv")
    f = form[form["damage_class"] == "substantial"]
    form_out = {}
    for storm, g in f.groupby("storm"):
        g = g.set_index("path")
        form_out[storm] = {
            "replaced_area_gain": float(g.loc["replaced", "area_ratio_median"] - 1),
            "same_area_share": float(g.loc["same structure", "area_same_share"]),
            "same_quality_share": float(g.loc["same structure", "qual_same_share"]),
            "n_same": int(g.loc["same structure", "n"]), "n_replaced": int(g.loc["replaced", "n"]),
        }

    rates = rd("a17_recovery_dose", "rates_by_class.csv")
    rates_out = {}
    for pair, g in rates.groupby("pair"):
        rates_out[pair] = {CLASS_KEY[r.rclass]: {"n": int(r.n), "rate": float(r.y_published_per100) / 100}
                           for r in g.itertuples()}

    frame = rd("a12_stock_renewal", "ownlot_frame_by_storm.csv")
    fema = rd("a18_path_measures", "exit_vs_fema.csv")
    big = fema[(fema["n_severe"] >= 1000) & (fema["n_post_rolls"] >= 4)]
    return {
        "split": shares,
        "window": window,
        "threshold": thresh,
        "threshold_slope": slope,
        "consequence": consequence,
        "form": form_out,
        "rates": rates_out,
        "frame": records(frame),
        "kept_large_county_storms": {"min": float(1 - big["exit4"].max()), "max": float(1 - big["exit4"].min()),
                                     "n": int(len(big))},
    }


# ------------------------------------------------------------------ window
def build_window():
    win = rd("a18_path_measures", "window_by_storm_k.csv")
    keep = []
    for storm, g in win.groupby("storm"):
        sev = g[g["group"] == "severe"]
        if sev["n"].iloc[0] >= WINDOW_MIN_SEVERE and sev["k"].max() >= WINDOW_MIN_ROLLS:
            keep.append(storm)
    win = win[win["storm"].isin(keep)]
    hz = rd("a18_path_measures", "hazard_by_k.csv")
    hz = hz[hz["storm"].isin(keep)]
    junc = rd("a18_path_measures", "juncture_by_storm_k.csv")
    fema = rd("a18_path_measures", "exit_vs_fema.csv", dtype={"county_fips": str})
    corr = rd("a18_path_measures", "exit_vs_fema_correlations.csv")
    return {
        "storms": sorted(keep, key=lambda s: int(s.split("_")[1])),
        "rows": records(win.round(6)),
        "hazard": records(hz.round(6)),
        "juncture": records(junc.round(6)),
        "fema": records(fema.round(5)),
        "fema_correlations": records(corr.round(4)),
    }


# ------------------------------------------------------------------ pathways
def build_pathways():
    st = rd("a10_reconstruction_curves", "ownlot_states_by_storm_k.csv")
    bands = rd("a12_stock_renewal", "ownlot_outcome_by_band.csv")
    frame = rd("a12_stock_renewal", "ownlot_frame_by_storm.csv")
    perm = rd("a20_permit_check", "roll_against_permits.csv")
    rep = rd("a20_permit_check", "repair_record_check.csv")
    ch = rd("a20_permit_check", "charlotte_roll_against_permits.csv")
    ch = ch[(ch["damage"] == "severe") & (ch["area"] != "Punta Gorda address")]
    kept = ch[ch["roll_path"].str.startswith("kept")]
    repl = ch[ch["roll_path"] == "replaced"]
    charlotte = {
        "kept_n": int(kept["n"].sum()),
        "kept_new_house_permits": int(round((kept["n"] * kept["new_house_permit"]).sum())),
        "replaced_n": int(repl["n"].sum()),
        "replaced_new_house_permits": int(round((repl["n"] * repl["new_house_permit"]).sum())),
    }
    sub = perm[perm["damage_class"] == "substantial"].copy()
    total = sub["n"].sum()
    cape = {
        "n_severe": int(total),
        "kept_share": float(sub.loc[sub["roll_path"].str.startswith("kept"), "n"].sum() / total),
        "rows": records(sub.round(4)),
        "repair_record": records(rep.round(4)),
    }
    return {
        "states": records(st.round(6)),
        "bands": records(bands),
        "frame": records(frame),
        "permits": {"cape_coral": cape, "charlotte": charlotte},
    }


# ------------------------------------------------------------------ threshold
def build_threshold():
    cur = rd("a18_path_measures", "threshold_curve.csv")
    grid = rd("a18_path_measures", "threshold_grid.csv")
    tm = rd("a18_path_measures", "threshold_models.csv")
    fin = rd("a18_path_measures", "financing_models.csv")
    sfha = rd("a18_path_measures", "sfha_threshold.csv")
    return {
        "bins": list(cur[cur["storm"] == "pooled"]["ratio_bin"]),
        "curve": records(cur[cur["n"] >= THRESH_MIN_N].round(6)),
        "grid": records(grid[(grid["storm"] == "pooled") & (grid["n"] >= THRESH_MIN_N)].round(6)),
        "grid_bins": {
            "value_left": list(dict.fromkeys(grid["value_left_bin"])),
            "land_share": list(dict.fromkeys(grid["land_share_bin"])),
        },
        "models": records(tm.round(6)),
        "income": records(fin[fin["term"] == "inc_z"].round(6)),
        "sfha": records(sfha.round(6)),
    }


# ------------------------------------------------------------------ exposure
def build_exposure():
    dec = rd("a19_consequence_checks", "loss_decomposition.csv")
    dec = dec[dec["pair"].isin(EXPOSURE_PAIRS)].copy()
    dec["class_key"] = dec["class"].map(CLASS_KEY)
    est = rd("a19_consequence_checks", "estimates.csv")
    est = est[(est["outcome"] == "y_published") & est["pair"].isin(EXPOSURE_PAIRS)].copy()
    est["class_key"] = est["class"].map(CLASS_KEY)
    exp = rd("a19_consequence_checks", "exposure_table.csv")
    rates = rd("a17_recovery_dose", "rates_by_class.csv")
    rates["class_key"] = rates["rclass"].map(CLASS_KEY)
    stakes = rd("a19_consequence_checks", "stakes.csv")
    rob = rd("a19_consequence_checks", "robustness_summary.csv")
    rob = rob[(rob["outcome"] == "y_published") & rob["pair"].isin(EXPOSURE_PAIRS)].copy()
    rob["class_key"] = rob["class"].map(CLASS_KEY)
    rob_cols = ["pair", "class_key", "n_specs", "n_p_below_05", "n_positive", "n_negative", "median",
                "ref_estimate", "ref_se", "ref_p", "matched_estimate", "matched_p",
                "loo_min", "loo_min_county_left_out", "loo_max", "loo_max_county_left_out"]

    # Lee County, the Charley cohort at Ian: every structure of the four
    # pathway classes with a 2025 parcel centroid
    p = pd.read_parquet(A / "a17_recovery_dose" / "results" / "dose_parcels_charley_to_ian.parquet",
                        columns=["pid_pre_b", "county_fips", "rclass", "y_published",
                                 "act_yr_pre_b", "mobile", "del_share"])
    p = p[(p["county_fips"] == "12071") & p["rclass"].isin(["none", "repaired", "replaced", "new_build"])]
    xy = pd.read_parquet(A / "a06_rebuild_panel_v2" / "results" / "rebuild_panel_v2_swfl.parquet",
                         columns=["pid_2022", "county_fips", "lon", "lat"])
    xy = xy[xy["county_fips"] == "12071"].drop(columns="county_fips")
    p = p.merge(xy, left_on="pid_pre_b", right_on="pid_2022", how="inner")
    order = ["less_documented", "documented_repair", "replaced", "new_build"]
    pts = [[round(float(r.lon), 5), round(float(r.lat), 5), order.index(CLASS_KEY[r.rclass]),
            int(r.y_published), int(r.act_yr_pre_b) if pd.notna(r.act_yr_pre_b) else None,
            int(bool(r.mobile)), round(float(r.del_share), 2) if pd.notna(r.del_share) else None]
           for r in p.itertuples()]
    lee_summary = {CLASS_KEY[k]: {"n": int(len(g)), "rate": float(g["y_published"].mean())}
                   for k, g in p.groupby("rclass")}
    lee_intact = rates[(rates["pair"] == "charley_to_ian") & (rates["rclass"] == "intact")].iloc[0]
    return {
        "decomposition": records(dec.round(5)),
        "estimates": records(est[["pair", "class_key", "sample", "design", "estimate", "se", "p",
                                  "n", "n_treated", "n_clusters", "base_mean"]].round(6)),
        "table": records(exp.round(4)),
        "rates": records(rates.round(4)),
        "stakes": records(stakes.round(4)),
        "robustness": records(rob[rob_cols].round(5)),
        "lee": {
            "columns": ["lon", "lat", "class", "severe_ian", "year_built", "mobile", "ian_del_share"],
            "classes": order,
            "rows": pts,
            "summary": lee_summary,
            "intact_pair_rate": float(lee_intact["y_published_per100"]) / 100,
            "intact_pair_n": int(lee_intact["n"]),
        },
    }


# ------------------------------------------------------------------ storms
def build_storms():
    storms = rd("a08_storm_catalog", "storms.csv")
    cmd = rd("a13_florida_map", "county_map_data.csv", dtype={"county_fips": str})
    tot = rd("a13_florida_map", "storm_totals.csv")
    trk = rd("a08_storm_catalog", "tracks.csv")
    tracks = {}
    for key, g in trk.groupby("storm"):
        g = g.sort_values("time")
        tracks[key] = {"lon": [round(float(v), 2) for v in g["lon"]],
                       "lat": [round(float(v), 2) for v in g["lat"]],
                       "vmax": [float(v) for v in g["vmax"]],
                       "time": list(g["time"])}
    return {
        "catalog": records(storms.round(2)),
        "county": records(cmd.round(3)),
        "totals": records(tot.round(2)),
    }, tracks


# ------------------------------------------------------------------ methods
def build_methods():
    g5 = rd("a09_multistorm_panel", "gate5.csv")
    g5 = g5[g5["level"] == "county"]
    cont = rd("a05_prestorm_rolls", "roll_continuity.csv")
    markers = rd("a05_prestorm_rolls", "marker_by_stratum.csv")
    med = rd("a09_multistorm_panel", "deleted_share_median.csv")
    med = med[(med["group_kind"] != "storm") & (med["frame"] == "damage")]
    wf = rd("a21_framework_figures", "supp_workflow_counts.csv")
    corr = rd("a18_path_measures", "exit_vs_fema_correlations.csv")
    return {
        "gate5_county": records(g5[["storm", "n_counties", "spearman_substantial_vs_ihp"]]),
        "continuity": records(cont),
        "gate4_stratum": records(markers.round(2)),
        "deleted_share": records(med.round(4)),
        "workflow": {r.quantity: r.value for r in wf.itertuples()},
        "fema_correlations": records(corr.round(4)),
    }


def main():
    DATA.mkdir(exist_ok=True)
    dump("meta.json", {
        "title": "Restored or Renewed?",
        "short_title": "Restored or renewed?",
        "subtitle": "What happens to severely damaged houses after Florida hurricanes, "
                    "2004 to 2024, followed parcel by parcel through the annual assessment rolls",
        "storms": STORM_NAMES, "pairs": PAIRS,
        "classes": {k: {"label": REC_LABEL[k], "color": REC[k]} for k in REC},
        "storm_colors": {k: STORM_STYLE[k]["color"] if k in STORM_STYLE else "#8c8c8c" for k in STORM_NAMES},
    })
    dump("overview.json", build_overview())
    dump("window.json", build_window())
    dump("pathways.json", build_pathways())
    dump("threshold.json", build_threshold())
    dump("exposure.json", build_exposure())
    storms, tracks = build_storms()
    dump("storms.json", storms)
    dump("geo/tracks.json", tracks)
    dump("methods.json", build_methods())
    print("Done")
    if "--check" in sys.argv:
        check()


def check():
    """Print the values the paper's claims file quotes, read back from the
    JSON files just written, so a reader can compare them by eye."""
    ov = json.load(open(DATA / "overview.json", encoding="utf-8"))
    print("\nCheck against FINAL_CLAIMS.md")
    for s, w in ov["window"].items():
        print(f"  C2 multiplier by roll 4, {s}: {w.get('multiplier4', float('nan')):.0f}"
              + (f"; exits by roll 4 of roll 8: {100 * w['share_by4_of8']:.0f}%" if "share_by4_of8" in w else ""))
    for s, t in ov["threshold"].items():
        print(f"  C3 exit by roll 4, {s}: {100 * t['exit_lowest']:.1f}% to {100 * t['exit_highest']:.1f}%")
    c = ov["consequence"]
    print(f"  C6 vulnerability {c['vulnerability'][0]:.2f} to {c['vulnerability'][1]:.2f}, "
          f"value {c['value'][0]:.1f} to {c['value'][1]:.1f}, dollars {c['dollars'][0]:.2f} to {c['dollars'][1]:.2f}")
    r = ov["rates"]["charley_to_ian"]
    print("  C5 Charley to Ian rates: " + ", ".join(f"{k} {100 * v['rate']:.1f}%" for k, v in r.items()))
    print(f"  C1 pooled restored share: {100 * ov['split']['pooled']['restored']:.0f}%")


if __name__ == "__main__":
    main()
