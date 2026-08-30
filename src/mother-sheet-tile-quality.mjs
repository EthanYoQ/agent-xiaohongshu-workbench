function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

/**
 * Reject a mother-sheet cell that is only paper/background texture. This is a
 * structural presence gate, not an aesthetic score: sparse line art is valid
 * when it creates enough channel variation or edge detail.
 */
export function inspectMotherSheetTileStats(stats = {}) {
  const channelDeviation = Array.isArray(stats.channels)
    ? stats.channels.slice(0, 3).map((channel) => finite(channel?.stdev))
    : [];
  const maxChannelDeviation = Math.max(0, ...channelDeviation);
  const entropy = finite(stats.entropy);
  const sharpness = finite(stats.sharpness);
  const hasVisibleSubject = maxChannelDeviation >= 10
    || (entropy >= 4.6 && sharpness >= .6);
  return {
    hasVisibleSubject,
    entropy,
    sharpness,
    maxChannelDeviation,
  };
}

function pixelAt(data, width, channels, x, y) {
  const offset = (y * width + x) * channels;
  return [data[offset], data[offset + 1], data[offset + 2], channels > 3 ? data[offset + 3] : 255];
}

function edgeBandStats(image, side, start, depth) {
  const { data, width, height, channels } = image;
  let sampled = 0; let pale = 0; let transparent = 0;
  const rgb = [0, 0, 0]; const rgbSquared = [0, 0, 0];
  const visit = (x, y) => {
    const value = pixelAt(data, width, channels, x, y);
    sampled += 1;
    rgb[0] += value[0]; rgb[1] += value[1]; rgb[2] += value[2];
    rgbSquared[0] += value[0] ** 2; rgbSquared[1] += value[1] ** 2; rgbSquared[2] += value[2] ** 2;
    if (value[3] < 220) transparent += 1;
    if (value[0] >= 242 && value[1] >= 242 && value[2] >= 242) pale += 1;
  };
  const xStep = Math.max(1, Math.floor(width / 160));
  const yStep = Math.max(1, Math.floor(height / 160));
  for (let offset = start; offset < start + depth; offset += 1) {
    if (side === "top" || side === "bottom") {
      const y = side === "top" ? offset : height - 1 - offset;
      for (let x = 0; x < width; x += xStep) visit(x, y);
    } else {
      const x = side === "left" ? offset : width - 1 - offset;
      for (let y = 0; y < height; y += yStep) visit(x, y);
    }
  }
  const mean = rgb.map((value) => value / Math.max(1, sampled));
  const stdev = rgbSquared.map((value, index) => Math.sqrt(Math.max(0, value / Math.max(1, sampled) - mean[index] ** 2)));
  return {
    paleRatio: pale / Math.max(1, sampled),
    transparentRatio: transparent / Math.max(1, sampled),
    mean,
    stdev,
  };
}

function meanDistance(first, second) {
  return Math.sqrt(first.reduce((sum, value, index) => sum + (value - second[index]) ** 2, 0));
}

/** Pixel-level publish gate for a final illustration asset. */
export function inspectMotherSheetTilePixels(image, options = {}) {
  const data = image?.data;
  const width = Math.round(finite(image?.width));
  const height = Math.round(finite(image?.height));
  const channels = Math.round(finite(image?.channels, 4));
  if (!(data instanceof Uint8Array) || width < 12 || height < 16 || ![3, 4].includes(channels) || data.length < width * height * channels) {
    throw new TypeError("mother-sheet tile pixels are invalid");
  }
  const outerDepth = Math.max(1, Math.min(4, Math.round(finite(options.outerDepth, 2))));
  // Compare against a band beyond the maximum allowed separator thickness.
  // A real white illustration background remains white there; a mother-sheet
  // gutter eventually gives way to scene pixels and is therefore rejected.
  const innerStart = Math.max(outerDepth + 2, Math.round(Math.min(width, height) * finite(options.innerRatio, .065)));
  const contaminatedSides = [];
  const sides = {};
  for (const side of ["top", "right", "bottom", "left"]) {
    const outer = edgeBandStats({ data, width, height, channels }, side, 0, outerDepth);
    const inner = edgeBandStats({ data, width, height, channels }, side, innerStart, outerDepth);
    const distance = meanDistance(outer.mean, inner.mean);
    const uniformOuterLine = outer.stdev.reduce((sum, value) => sum + value, 0) / 3 <= 14;
    const outerLightness = outer.mean.reduce((sum, value) => sum + value, 0) / 3;
    const outerChroma = Math.max(...outer.mean) - Math.min(...outer.mean);
    // Pure white is the required illustration background, so a white outer
    // band is not evidence of letterboxing even when scene pixels appear
    // farther inward. Only a non-white neutral rule is treated as a leaked
    // mother-sheet grid/frame. Dark and coloured scene edges remain valid.
    const uniformLightNeutralLine = uniformOuterLine && outerLightness >= 160 && outerLightness <= 238 && outerChroma <= 48;
    const separator = uniformLightNeutralLine && outer.paleRatio < .9 && distance >= 20;
    const transparency = outer.transparentRatio > .01;
    if (separator || transparency) contaminatedSides.push(side);
    sides[side] = { outer, inner, distance, uniformOuterLine, uniformLightNeutralLine, separator, transparency };
  }
  const expectedAspect = String(options.expectedAspect || "3:4");
  const aspectOk = expectedAspect === "9:8"
    ? width * 8 === height * 9
    : width * 4 === height * 3;
  return {
    aspectOk,
    expectedAspect,
    hasCleanEdges: aspectOk && contaminatedSides.length === 0,
    contaminatedSides,
    width,
    height,
    sides,
  };
}
