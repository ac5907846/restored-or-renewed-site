/* The manuscript's figure palette, so the site and the paper read as
   one system (02_analysis/_shared/constants.py). */

export const INK = "#14181d";
export const NAVY = "#16385c";
export const WINE = "#7b1e3b";
export const GRID = "#e4e7ea";
export const RULE = "#c9ced4";
export const MUTED = "#6a7280";
export const NODATA = "#e3e3e0";
export const LAND = "#eceae6";

export const STORM = {
  irma: "#8a7d5c", michael: "#5c7d8a", ian: "#16385c",
  idalia: "#6c8f6c", debby: "#8a6c8f", helene: "#5ca6a0",
  milton: "#7b1e3b",
};

/* A larger categorical ramp for county series, built to stay legible
   against white and to keep navy and wine for Ian and Milton. */
export const CATEGORICAL = [
  "#16385c", "#7b1e3b", "#5ca6a0", "#8a7d5c", "#6c8f6c",
  "#8a6c8f", "#5c7d8a", "#b06a3b", "#3f6f8f", "#9a5a6a",
];

const hex = (c) => [
  parseInt(c.slice(1, 3), 16),
  parseInt(c.slice(3, 5), 16),
  parseInt(c.slice(5, 7), 16),
];
const mix = (a, b, t) => "#" + a.map((v, i) =>
  Math.round(v + (b[i] - v) * t).toString(16).padStart(2, "0")).join("");

const NAVY_RGB = hex(NAVY);
const MID_RGB = hex("#f2f0ec");
const WINE_RGB = hex(WINE);

/** Diverging navy-to-wine ramp, t in [0, 1] with .5 at the center. */
export function diverging(t) {
  const u = Math.max(0, Math.min(1, t));
  return u < 0.5 ? mix(NAVY_RGB, MID_RGB, u * 2)
    : mix(MID_RGB, WINE_RGB, (u - 0.5) * 2);
}

/** Color for a log residual: negative (faster) navy, positive wine. */
export function residualColor(v, limit = 2) {
  if (v === null || v === undefined || Number.isNaN(v)) return NODATA;
  return diverging((Math.max(-limit, Math.min(limit, v)) + limit)
    / (2 * limit));
}

/** Sequential blue ramp for magnitude-only quantities. */
export function sequential(t) {
  return mix(hex("#dce6f0"), NAVY_RGB, Math.max(0, Math.min(1, t)));
}

/* Paper 2 categorical palette (02_analysis/_shared/constants.py
   P2_CAT): navy, deep pink, deep green, grays; never light blue or
   orange. Storm identities for the multi-hurricane pages. */
export const PINK = "#a8325e";
export const GREEN = "#2f6b4f";
export const GRAY = "#8c8c8c";
export const GRAY_DARK = "#595959";
export const GRAY_LIGHT = "#bfbfbf";
export const P2_STORM = {
  ian_2022: "#16385c", irma_2017: "#2f6b4f", michael_2018: "#a8325e",
  charley_2004: "#595959", wilma_2005: "#8c8c8c", milton_2024: "#6b1f3f",
};
export const P2_OTHER = "#bfbfbf";
export const GROUP = {
  damaged_retained: "#a8325e", damaged_replaced: "#16385c",
  undamaged_new: "#2f6b4f", undamaged_old: "#8c8c8c",
};

/* Recovery pathway classes, the paper's REC and REC_LABEL
   (02_analysis/_shared/constants.py): colour always means a pathway,
   storms are drawn in neutral inks with direct labels. New build is
   the one class drawn open (white fill, coloured edge). */
export const REC = {
  less_documented: "#8e3b62", documented_repair: "#5e8c4a", replaced: "#16385c",
  new_build: "#6f96c6", intact: "#4d4d4d", cleared: "#a6a6a6", excluded: "#d9d9d9",
};
export const REC_LABEL = {
  less_documented: "Less-documented recovery", documented_repair: "Documented repair",
  replaced: "Replaced", new_build: "New build", intact: "Intact", cleared: "Cleared",
  excluded: "Excluded",
};
export const REC_OPEN = { new_build: true };
/* Storm inks for the multi-storm charts: neutral, told apart by dash and
   direct label, none equal to a class colour. */
export const STORM_INK = {
  ian_2022: { color: "#14181d", dash: "" },
  charley_2004: { color: "#595959", dash: "6 3" },
  michael_2018: { color: "#7a6a4f", dash: "2 2.5" },
  ivan_2004: { color: "#8c8c8c", dash: "8 3 2 3" },
  irma_2017: { color: "#5c7d8a", dash: "4 2" },
  pooled: { color: "#a8325e", dash: "" },
};
