/* Map projection and path building. The paper draws Florida on a
   plate carree grid stretched by cos(latitude), which keeps the
   state's proportions right without pulling in a projection library;
   the site uses the same construction so the shapes match. */

const REF_LAT = 27.5;

export function projector(bbox, width, height, padding = 4) {
  const [lon0, lon1, lat0, lat1] = bbox;
  const k = Math.cos((REF_LAT * Math.PI) / 180);
  const dataW = (lon1 - lon0) * k;
  const dataH = lat1 - lat0;
  const s = Math.min((width - 2 * padding) / dataW,
    (height - 2 * padding) / dataH);
  const offX = (width - dataW * s) / 2;
  const offY = (height - dataH * s) / 2;
  const p = (lon, lat) => [
    offX + (lon - lon0) * k * s,
    offY + (lat1 - lat) * s,
  ];
  p.scale = s;
  p.invert = (x, y) => [
    lon0 + (x - offX) / (k * s),
    lat1 - (y - offY) / s,
  ];
  return p;
}

/** Bounding box [lonMin, lonMax, latMin, latMax] of ring arrays. */
export function boundsOf(features) {
  let a = Infinity;
  let b = -Infinity;
  let c = Infinity;
  let d = -Infinity;
  for (const f of features) {
    for (const ring of f.rings) {
      for (const [lon, lat] of ring) {
        if (lon < a) a = lon;
        if (lon > b) b = lon;
        if (lat < c) c = lat;
        if (lat > d) d = lat;
      }
    }
  }
  return [a, b, c, d];
}

export function pathOf(rings, project) {
  let d = "";
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i += 1) {
      const [x, y] = project(ring[i][0], ring[i][1]);
      d += `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    }
    d += "Z";
  }
  return d;
}

/** Polyline path for a storm track. */
export function trackPath(lons, lats, project) {
  let d = "";
  for (let i = 0; i < lons.length; i += 1) {
    const [x, y] = project(lons[i], lats[i]);
    d += `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
  }
  return d;
}

/** Visual center of the largest ring, for a county label or marker. */
export function centroid(rings) {
  let best = null;
  let bestArea = -1;
  for (const ring of rings) {
    let area = 0;
    let cx = 0;
    let cy = 0;
    for (let i = 0, n = ring.length; i < n; i += 1) {
      const [x0, y0] = ring[i];
      const [x1, y1] = ring[(i + 1) % n];
      const cross = x0 * y1 - x1 * y0;
      area += cross;
      cx += (x0 + x1) * cross;
      cy += (y0 + y1) * cross;
    }
    area /= 2;
    if (Math.abs(area) > bestArea) {
      bestArea = Math.abs(area);
      best = [cx / (6 * area), cy / (6 * area)];
    }
  }
  return best;
}

/** Smooth path through the projected points: a Catmull-Rom spline
    written as cubic Beziers, so the 6-hourly fixes read as one curve. */
export function smoothTrackPath(lons, lats, project) {
  const P = lons.map((lon, i) => project(lon, lats[i]));
  if (P.length < 2) return "";
  if (P.length === 2) return `M${P[0][0].toFixed(1)},${P[0][1].toFixed(1)}L${P[1][0].toFixed(1)},${P[1][1].toFixed(1)}`;
  let d = `M${P[0][0].toFixed(1)},${P[0][1].toFixed(1)}`;
  for (let i = 0; i < P.length - 1; i += 1) {
    const p0 = P[Math.max(0, i - 1)];
    const p1 = P[i];
    const p2 = P[i + 1];
    const p3 = P[Math.min(P.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

/** Indices of the fixes inside a lon/lat box, split into contiguous runs
    so a track that leaves and re-enters the frame is not joined by a
    false arc. */
export function runsInside(trk, box) {
  const [a, b, c, d] = box;
  const runs = [];
  let cur = [];
  trk.lon.forEach((lon, k) => {
    const inside = lon > a && lon < b && trk.lat[k] > c && trk.lat[k] < d;
    if (inside) cur.push(k);
    else if (cur.length) { runs.push(cur); cur = []; }
  });
  if (cur.length) runs.push(cur);
  return runs.filter((r) => r.length > 1);
}
