function finiteInteger(value, fallback = 0) {
  const number = Math.round(Number(value));
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function neutralRuleRatio(data, width, height, channels, axis, coordinate) {
  let matches = 0; let sampled = 0;
  const length = axis === "x" ? height : width;
  const step = Math.max(1, Math.floor(length / 240));
  for (let offset = 0; offset < length; offset += step) {
    const x = axis === "x" ? coordinate : offset;
    const y = axis === "x" ? offset : coordinate;
    const index = (y * width + x) * channels;
    const rgb = [data[index], data[index + 1], data[index + 2]];
    const lightness = (rgb[0] + rgb[1] + rgb[2]) / 3;
    const chroma = Math.max(...rgb) - Math.min(...rgb);
    sampled += 1;
    if (lightness >= 150 && lightness <= 242 && chroma <= 24) matches += 1;
  }
  return matches / Math.max(1, sampled);
}

function whitePixel(data, width, channels, x, y) {
  const index = (y * width + x) * channels;
  data[index] = 255; data[index + 1] = 255; data[index + 2] = 255;
  if (channels > 3) data[index + 3] = 255;
}

function findRule(data, width, height, channels, axis, start, end) {
  let best = null;
  for (let coordinate = start; coordinate <= end; coordinate += 1) {
    const ratio = neutralRuleRatio(data, width, height, channels, axis, coordinate);
    if (ratio >= .68 && (!best || ratio > best.ratio)) best = { coordinate, ratio };
  }
  return best;
}

export function cleanupGeneratedGridArtifacts(image, { kv = false, previousActions = [] } = {}) {
  const source = image?.data;
  const width = finiteInteger(image?.width);
  const height = finiteInteger(image?.height);
  const channels = finiteInteger(image?.channels, 4);
  if (!(source instanceof Uint8Array) || !width || !height || ![3, 4].includes(channels) || source.length < width * height * channels) throw new TypeError("mother-sheet cleanup pixels are invalid");
  const data = new Uint8Array(source);
  const actions = [];
  // Assets repaired by the v3 routine already have the rule itself painted
  // white, but can still retain a neighbour-cell strip outside that rule.
  // Replay the recorded coordinate as an edge-band cleanup so old paid assets
  // can be repaired without regenerating or recharging.
  for (const prior of Array.isArray(previousActions) ? previousActions : []) {
    if (prior?.type !== "HORIZONTAL_GRID_RULE_REMOVED") continue;
    const coordinate = Math.max(0, Math.min(height - 1, Math.round(Number(prior.coordinate))));
    const edge = coordinate < height / 2 ? "top" : "bottom";
    const from = edge === "top" ? 0 : Math.max(0, coordinate - 3);
    const to = edge === "top" ? Math.min(height - 1, coordinate + 3) : height - 1;
    for (let y = from; y <= to; y += 1) for (let x = 0; x < width; x += 1) whitePixel(data, width, channels, x, y);
    actions.push({ type: "LEGACY_HORIZONTAL_GRID_EDGE_BAND_REMOVED", edge, coordinate, from, to });
  }
  if (kv) {
    const seam = findRule(data, width, height, channels, "x", Math.round(width * .08), Math.round(width * .4));
    if (seam) {
      for (let y = 0; y < height; y += 1) for (let x = 0; x <= Math.min(width - 1, seam.coordinate + 3); x += 1) whitePixel(data, width, channels, x, y);
      actions.push({ type: "KV_LEFT_CONTAMINATION_REMOVED", coordinate: seam.coordinate, ratio: seam.ratio });
    }
  }
  const horizontalRanges = [
    { edge: "top", start: 0, end: Math.round(height * .08) },
    { edge: "bottom", start: Math.round(height * .92), end: height - 1 },
  ];
  horizontalRanges.forEach(({ edge, start, end }) => {
    const rule = findRule(data, width, height, channels, "y", start, end);
    if (!rule) return;
    // The leaked material sits between the tile edge and the detected grid
    // rule. Whitening only the rule itself preserves a strip of the neighbour
    // cell (the exact failure seen in the paid dogfood run), so clean the
    // complete contaminated edge band.
    const from = edge === "top" ? 0 : Math.max(0, rule.coordinate - 3);
    const to = edge === "top" ? Math.min(height - 1, rule.coordinate + 3) : height - 1;
    for (let y = from; y <= to; y += 1) {
      for (let x = 0; x < width; x += 1) whitePixel(data, width, channels, x, y);
    }
    actions.push({ type: "HORIZONTAL_GRID_EDGE_BAND_REMOVED", edge, coordinate: rule.coordinate, ratio: rule.ratio, from, to });
  });
  const verticalRanges = [
    { edge: "left", start: 0, end: Math.round(width * .08) },
    { edge: "right", start: Math.round(width * .92), end: width - 1 },
  ];
  verticalRanges.forEach(({ edge, start, end }) => {
    const rule = findRule(data, width, height, channels, "x", start, end);
    if (!rule) return;
    const from = edge === "left" ? 0 : Math.max(0, rule.coordinate - 3);
    const to = edge === "left" ? Math.min(width - 1, rule.coordinate + 3) : width - 1;
    for (let x = from; x <= to; x += 1) {
      for (let y = 0; y < height; y += 1) whitePixel(data, width, channels, x, y);
    }
    actions.push({ type: "VERTICAL_GRID_EDGE_BAND_REMOVED", edge, coordinate: rule.coordinate, ratio: rule.ratio, from, to });
  });
  return { data, width, height, channels, actions };
}
