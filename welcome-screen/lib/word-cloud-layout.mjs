/**
 * Size the complete word set against the actual viewport, retaining the dense
 * spiral and frequency weighting. Names use tighter spacing and a smaller float.
 * `variant` reshuffles the layout each cycle: a deterministic per-word size
 * jitter plus a spiral phase offset, so every redraw changes sizes/positions.
 * It also picks a cloud silhouette (ellipse / ring / star / superellipse) so
 * each re-layout and each page refresh shows a different overall shape.
 * @param {{name:string,value:number}[]} words
 * @param {boolean} names
 * @param {number} width
 * @param {number} height
 * @param {number} variant
 */
// Deterministic 0–1 noise keyed by a number; same variant = same shape.
const hash01 = (n) => {
  const x = Math.sin(n * 269.5 + 31.4) * 43758.5453;
  return x - Math.floor(x);
};
export function layoutWords(words, names, width = 360, height = 220, variant = 0) {
  const list = [...words].sort(
    (a, b) =>
      b.value - a.value ||
      (a.name.codePointAt(0) || 0) - (b.name.codePointAt(0) || 0) ||
      (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
  );
  if (!list.length || width < 1 || height < 1) return [];
  const max = Math.max(1, ...list.map((word) => word.value));
  const padding = names ? 2 : 7;
  // Silhouette family for this variant: 0 ellipse / 1 ring / 2 star / 3 block.
  // variant=0 keeps every parameter neutral so default layouts stay identical.
  const shapeKind = variant ? Math.floor(variant) % 4 : 0;
  const aspect = variant ? 0.85 + hash01(variant * 3.7 + (names ? 1 : 8)) * 0.5 : 1;
  const pinch = variant ? 0.22 + hash01(variant * 7.3) * 0.16 : 0;
  const petals = 4 + Math.floor(hash01(variant * 11.9) * 2);
  // Only the ring family hollows out the center; other shapes keep it dense.
  const ringInner =
    shapeKind === 1
      ? (Math.min(width, height) / 2) * (0.3 + hash01(variant * 5.1) * 0.15)
      : 0;
  const blockExp = variant ? 2.2 + hash01(variant * 13.7) * 1.4 : 1;
  // Radial envelope of the chosen silhouette at a given spiral angle.
  const radial = (angle) => {
    switch (shapeKind) {
      case 1:
        return 1;
      case 2:
        return 1 - pinch * Math.abs(Math.cos(petals * angle));
      case 3:
        return Math.pow(
          Math.pow(Math.abs(Math.cos(angle)), blockExp) +
            Math.pow(Math.abs(Math.sin(angle)), blockExp),
          1 / blockExp,
        ) / Math.pow(2, 1 / blockExp) * 1.12;
      default:
        return 1;
    }
  };
  // Deterministic jitter in 0.84–1.18 so each variant resizes every word.
  const jitter = (index) => {
    const x = Math.sin(variant * 127.1 + index * 74.7 + (names ? 3.3 : 5.1)) * 43758.5453;
    return variant ? 0.84 + (x - Math.floor(x)) * 0.34 : 1;
  };
  const weight = (word, index) =>
    ((names ? 16 : 9) +
      (names ? 22 : 19) * Math.pow(word.value / max, names ? 0.85 : 1)) *
    jitter(index);
  const glyphs = (name) =>
    [...name].reduce((n, c) => n + (c.codePointAt(0) > 255 ? 1 : 0.65), 0);
  const baseArea = list.reduce(
    (n, word, index) =>
      n +
      (glyphs(word.name) * weight(word, index) + padding) *
        (weight(word, index) + padding),
    0,
  );
  const desired = Math.sqrt((width * height * (names ? 0.78 : 0.6)) / baseArea);
  const phase = variant * 0.9;
  for (let attempt = 0; attempt < 12; attempt++) {
    /** @type {{name:string,value:number,x:number,y:number,size:number,width:number,height:number,index:number}[]} */
    const placed = [];
    const CELL = 48;
    const buckets = new Map();
    const register = (p) => {
      const cx0 = Math.floor((p.x - p.width / 2) / CELL),
        cx1 = Math.floor((p.x + p.width / 2) / CELL),
        cy0 = Math.floor((p.y - p.height / 2) / CELL),
        cy1 = Math.floor((p.y + p.height / 2) / CELL);
      for (let cx = cx0; cx <= cx1; cx++)
        for (let cy = cy0; cy <= cy1; cy++) {
          const key = cx + ':' + cy;
          const list = buckets.get(key);
          if (list) list.push(p);
          else buckets.set(key, [p]);
        }
    };
    const scale = desired * Math.pow(0.9, attempt);
    let failed = false;
    for (let index = 0; index < list.length; index++) {
      const word = list[index];
      // Floor at 1px: without it a viewport edge <=15px yields negative
      // sizes whose boxes always "fit", hiding the grid fallback below.
      const size = Math.max(
        1,
        Math.min(
          weight(word, index) * scale,
          (width - 16) / Math.max(1, glyphs(word.name)),
          height - 16,
        ),
      );
      const boxWidth = glyphs(word.name) * size + padding,
        boxHeight = size + padding;
      // Collision check via a spatial hash: overlapping boxes always share at
      // least one cell, so scanning the candidate's cells finds every collider
      // without visiting all 200+ placed words (same result, far fewer tests).
      const overlaps = (x, y) => {
        const cx0 = Math.floor((x - boxWidth / 2) / CELL),
          cx1 = Math.floor((x + boxWidth / 2) / CELL),
          cy0 = Math.floor((y - boxHeight / 2) / CELL),
          cy1 = Math.floor((y + boxHeight / 2) / CELL);
        for (let cx = cx0; cx <= cx1; cx++)
          for (let cy = cy0; cy <= cy1; cy++) {
            const list = buckets.get(cx + ':' + cy);
            if (!list) continue;
            for (const p of list)
              if (
                Math.abs(p.x - x) < (p.width + boxWidth) / 2 &&
                Math.abs(p.y - y) < (p.height + boxHeight) / 2
              )
                return true;
          }
        return false;
      };
      const fits = (x, y) =>
        x - boxWidth / 2 >= 4 &&
        x + boxWidth / 2 <= width - 4 &&
        y - boxHeight / 2 >= 4 &&
        y + boxHeight / 2 <= height - 4 &&
        !overlaps(x, y);
      let position = null;
      for (let step = 0; step < 16000; step++) {
        const angle = step * 0.45 + index * 2.1 + phase,
          // The ring silhouette lifts the spiral's start off the center; the
          // envelope/aspect stretch the track into the chosen silhouette.
          // A linear pitch (≈4px per turn) replaces the old sqrt pitch whose
          // turns closed by <0.1px at range, rescanning the same ring for
          // thousands of steps — the main-thread stall of dense clouds.
          radius = step * 0.3 + ringInner,
          envelope = radial(angle);
        // The ellipse family trades width for height (wide oval vs tall
        // oval); other silhouettes keep the natural proportions.
        const yScale = shapeKind === 0 && variant ? 2.02 - aspect : 1;
        // Only the ellipse family trades width for height; other silhouettes
        // keep their natural proportions undistorted.
        const xStretch = shapeKind === 0 && variant ? aspect : 1;
        const x =
            width / 2 +
            Math.cos(angle) * radius * (width / height) * xStretch * envelope,
          y = height / 2 + Math.sin(angle) * radius * envelope * yScale;
        if (fits(x, y)) {
          position = { x, y };
          break;
        }
        // The radius only grows; past this point no step can re-enter the
        // canvas, so stop walking and let the row scan below place the word.
        if (radius > 2 * Math.max(width, height)) break;
      }
      if (!position) {
        for (
          let y = boxHeight / 2 + 4;
          y <= height - boxHeight / 2 - 4 && !position;
          y += 3
        )
          for (let x = boxWidth / 2 + 4; x <= width - boxWidth / 2 - 4; x += 3)
            if (fits(x, y)) {
              position = { x, y };
              break;
            }
      }
      if (!position) {
        failed = true;
        break;
      }
      placed.push({
        ...word,
        ...position,
        size,
        width: boxWidth,
        height: boxHeight,
        index,
      });
      register(placed[placed.length - 1]);
    }
    if (!failed) return placed;
  }
  // For unusually small viewports retain every label in fitted rows.
  const columns = Math.max(
    1,
    Math.ceil(Math.sqrt((list.length * width) / height)),
  );
  const rows = Math.ceil(list.length / columns),
    cellWidth = width / columns,
    cellHeight = height / rows;
  return list.map((word, index) => ({
    ...word,
    index,
    x: ((index % columns) + 0.5) * cellWidth,
    y: (Math.floor(index / columns) + 0.5) * cellHeight,
    size: Math.max(
      1,
      Math.min(
        (cellWidth - 6) / Math.max(1, glyphs(word.name)),
        cellHeight - 6,
      ),
    ),
    width: cellWidth,
    height: cellHeight,
  }));
}
