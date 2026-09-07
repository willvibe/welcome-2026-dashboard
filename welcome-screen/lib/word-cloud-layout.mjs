/**
 * Size the complete word set against the actual viewport, retaining the dense
 * spiral and frequency weighting. Names use tighter spacing and a smaller float.
 * `variant` reshuffles the layout each cycle: a deterministic per-word size
 * jitter plus a spiral phase offset, so every redraw changes sizes/positions.
 * @param {{name:string,value:number}[]} words
 * @param {boolean} names
 * @param {number} width
 * @param {number} height
 * @param {number} variant
 */
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
    const scale = desired * Math.pow(0.9, attempt);
    let failed = false;
    for (let index = 0; index < list.length; index++) {
      const word = list[index];
      const size = Math.min(
        weight(word, index) * scale,
        (width - 16) / Math.max(1, glyphs(word.name)),
        height - 16,
      );
      const boxWidth = glyphs(word.name) * size + padding,
        boxHeight = size + padding;
      const fits = (x, y) =>
        x - boxWidth / 2 >= 4 &&
        x + boxWidth / 2 <= width - 4 &&
        y - boxHeight / 2 >= 4 &&
        y + boxHeight / 2 <= height - 4 &&
        !placed.some(
          (p) =>
            Math.abs(p.x - x) < (p.width + boxWidth) / 2 &&
            Math.abs(p.y - y) < (p.height + boxHeight) / 2,
        );
      let position = null;
      for (let step = 0; step < 16000; step++) {
        const angle = step * 0.45 + index * 2.1 + phase,
          radius = Math.sqrt(step) * 1.5;
        const x = width / 2 + Math.cos(angle) * radius * (width / height),
          y = height / 2 + Math.sin(angle) * radius;
        if (fits(x, y)) {
          position = { x, y };
          break;
        }
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
