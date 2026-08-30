function finiteInteger(value, fallback = 0) {
  const number = Math.round(Number(value));
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function neutralRuleRatio(data, width, channels, axis, coordinate, start, end) {
  let matches = 0; let sampled = 0;
  const length = Math.max(0, end - start);
  const step = Math.max(1, Math.floor(length / 320));
  for (let offset = start; offset < end; offset += step) {
    const x = axis === "x" ? coordinate : offset;
    const y = axis === "x" ? offset : coordinate;
    const index = (y * width + x) * channels;
    const rgb = [data[index], data[index + 1], data[index + 2]];
    const lightness = (rgb[0] + rgb[1] + rgb[2]) / 3;
    const chroma = Math.max(...rgb) - Math.min(...rgb);
    sampled += 1;
    if (lightness >= 150 && lightness <= 245 && chroma <= 28) matches += 1;
  }
  return matches / Math.max(1, sampled);
}

function strongestRule(data, width, channels, axis, from, to, spanStart, spanEnd, threshold = .55) {
  let best = null;
  for (let coordinate = from; coordinate <= to; coordinate += 1) {
    const ratio = neutralRuleRatio(data, width, channels, axis, coordinate, spanStart, spanEnd);
    if (ratio >= threshold && (!best || ratio > best.ratio)) best = { coordinate, ratio };
  }
  return best;
}

/**
 * Detect the real A/B left-column cells in a KV 2x2 mother sheet. Generative
 * models sometimes widen that column instead of respecting an equal 3x3 grid;
 * fixed thirds then amputate the action on the right. The detector follows the
 * actual neutral divider rules and fails back to null when evidence is weak.
 */
export function detectKvTemplateLeftColumnRegions(image) {
  const data = image?.data;
  const width = finiteInteger(image?.width);
  const height = finiteInteger(image?.height);
  const channels = finiteInteger(image?.channels, 4);
  if (!(data instanceof Uint8Array) || !width || !height || ![3, 4].includes(channels) || data.length < width * height * channels) throw new TypeError("mother-sheet adaptive pixels are invalid");
  const dividerX = strongestRule(
    data, width, channels, "x",
    Math.round(width * .3), Math.round(width * .58),
    0, Math.round(height * .67), .52,
  );
  if (!dividerX) return null;
  const firstY = strongestRule(
    data, width, channels, "y",
    Math.round(height * .2), Math.round(height * .45),
    0, dividerX.coordinate, .52,
  );
  const secondY = strongestRule(
    data, width, channels, "y",
    Math.round(height * .45), Math.round(height * .75),
    0, dividerX.coordinate, .52,
  );
  if (!firstY || !secondY || secondY.coordinate <= firstY.coordinate + 16) return null;
  // Leave enough room for the anti-aliased shadow around a generated divider;
  // a 2–3px inset only removed the mathematical line while its soft grey echo
  // remained visible after 1080px normalization.
  const inset = Math.max(3, Math.round(Math.min(width, height) * .012));
  const right = Math.max(inset + 1, dividerX.coordinate - inset);
  const firstBottom = Math.max(inset + 1, firstY.coordinate - inset);
  const secondTop = Math.min(height - 2, firstY.coordinate + inset);
  const secondBottom = Math.max(secondTop + 1, secondY.coordinate - inset);
  return {
    divider_x: dividerX,
    row_dividers: [firstY, secondY],
    regions: [
      { left: inset, top: inset, width: right - inset, height: firstBottom - inset },
      { left: inset, top: secondTop, width: right - inset, height: secondBottom - secondTop },
    ],
  };
}
