function boundedInteger(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(Number(value) || 0)));
}

export function inspectRenderedImageRegion(imageData, region) {
  const { data, width, height } = imageData || {};
  if (!(data instanceof Uint8ClampedArray) || !Number.isInteger(width) || !Number.isInteger(height)) {
    throw new TypeError("rendered image data is invalid");
  }
  const left = boundedInteger(region?.x, 0, width - 1);
  const top = boundedInteger(region?.y, 0, height - 1);
  const right = boundedInteger((region?.x || 0) + (region?.width || 0), left + 1, width);
  const bottom = boundedInteger((region?.y || 0) + (region?.height || 0), top + 1, height);
  const stepX = Math.max(1, Math.floor((right - left) / 48));
  const stepY = Math.max(1, Math.floor((bottom - top) / 48));
  const colors = new Set();
  const quantizedCounts = new Map();
  const samples = [];
  let sampled = 0;
  let opaque = 0;
  let darkest = 255;
  let lightest = 0;
  for (let y = top; y < bottom; y += stepY) {
    for (let x = left; x < right; x += stepX) {
      const offset = (y * width + x) * 4;
      const alpha = data[offset + 3];
      sampled += 1;
      if (alpha < 220) continue;
      opaque += 1;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      const key = `${red >> 4}:${green >> 4}:${blue >> 4}`;
      colors.add(key);
      quantizedCounts.set(key, (quantizedCounts.get(key) || 0) + 1);
      samples.push([red, green, blue, key]);
      const luminance = red * .2126 + green * .7152 + blue * .0722;
      darkest = Math.min(darkest, luminance);
      lightest = Math.max(lightest, luminance);
    }
  }
  const backgroundKey = [...quantizedCounts.entries()].sort((first, second) => second[1] - first[1])[0]?.[0];
  const backgroundSamples = samples.filter((sample) => sample[3] === backgroundKey);
  const background = backgroundSamples.length
    ? backgroundSamples.reduce((sum, sample) => [sum[0] + sample[0], sum[1] + sample[1], sum[2] + sample[2]], [0, 0, 0]).map((value) => value / backgroundSamples.length)
    : [255, 255, 255];
  const differentFromBackground = samples.filter(([red, green, blue]) => Math.sqrt(
    (red - background[0]) ** 2 + (green - background[1]) ** 2 + (blue - background[2]) ** 2,
  ) >= 18).length;
  return {
    sampled,
    opaque,
    opaqueRatio: opaque / Math.max(1, sampled),
    quantizedColorCount: colors.size,
    luminanceSpan: lightest - darkest,
    backgroundDifferenceRatio: differentFromBackground / Math.max(1, samples.length),
  };
}

export function assertRenderedImageRegions(imageData, regions) {
  if (!Array.isArray(regions) || !regions.length) return [];
  return regions.map((region) => {
    const stats = inspectRenderedImageRegion(imageData, region);
    /* Presence is not aesthetic richness. A pale illustration or sparse line
       drawing may use only a few colors and still be a valid rendered image.
       Block only a region that is effectively a flat placeholder. */
    const hasVisibleImageEvidence = stats.quantizedColorCount >= 2
      && stats.luminanceSpan >= 8
      && stats.backgroundDifferenceRatio >= .002;
    if (!hasVisibleImageEvidence) {
      throw new Error(`HTML_EXPORT_IMAGE_MISSING:${region.id || "unknown"}:colors=${stats.quantizedColorCount}:span=${Math.round(stats.luminanceSpan)}:detail=${stats.backgroundDifferenceRatio.toFixed(4)}`);
    }
    return { id: region.id || "unknown", ...stats };
  });
}

export function inspectRenderedPage(imageData) {
  const { data, width, height } = imageData || {};
  if (!(data instanceof Uint8ClampedArray) || !Number.isInteger(width) || !Number.isInteger(height)) {
    throw new TypeError("rendered page data is invalid");
  }
  const stepX = Math.max(1, Math.floor(width / 72));
  const stepY = Math.max(1, Math.floor(height / 96));
  const colors = new Set();
  let sampled = 0;
  let opaque = 0;
  let darkest = 255;
  let lightest = 0;
  for (let y = 0; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      const offset = (y * width + x) * 4;
      const alpha = data[offset + 3];
      sampled += 1;
      if (alpha < 220) continue;
      opaque += 1;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      colors.add(`${red >> 4}:${green >> 4}:${blue >> 4}`);
      const luminance = red * .2126 + green * .7152 + blue * .0722;
      darkest = Math.min(darkest, luminance);
      lightest = Math.max(lightest, luminance);
    }
  }
  return {
    sampled,
    opaque,
    opaqueRatio: opaque / Math.max(1, sampled),
    quantizedColorCount: colors.size,
    luminanceSpan: lightest - darkest,
  };
}

export function assertRenderedPageContent(imageData, label = "PAGE") {
  const stats = inspectRenderedPage(imageData);
  if (stats.opaqueRatio < .72 || stats.quantizedColorCount < 12 || stats.luminanceSpan < 24) {
    throw new Error(`${label}_EXPORT_BLANK_OR_FLAT`);
  }
  return stats;
}
