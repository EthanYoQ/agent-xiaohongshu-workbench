function finiteInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function pixel(data, width, x, y, channels) {
  const offset = (y * width + x) * channels;
  return [data[offset], data[offset + 1], data[offset + 2], channels > 3 ? data[offset + 3] : 255];
}

function colorDistance(first, second) {
  return Math.sqrt(
    (first[0] - second[0]) ** 2
    + (first[1] - second[1]) ** 2
    + (first[2] - second[2]) ** 2,
  );
}

function averageEdge(data, width, height, channels, side, depth) {
  const sum = [0, 0, 0];
  let count = 0;
  const visit = (x, y) => {
    const rgba = pixel(data, width, x, y, channels);
    if (rgba[3] < 220) return;
    sum[0] += rgba[0]; sum[1] += rgba[1]; sum[2] += rgba[2]; count += 1;
  };
  if (side === "top" || side === "bottom") {
    for (let offset = 0; offset < depth; offset += 1) {
      const y = side === "top" ? offset : height - 1 - offset;
      for (let x = 0; x < width; x += Math.max(1, Math.floor(width / 96))) visit(x, y);
    }
  } else {
    for (let offset = 0; offset < depth; offset += 1) {
      const x = side === "left" ? offset : width - 1 - offset;
      for (let y = 0; y < height; y += Math.max(1, Math.floor(height / 96))) visit(x, y);
    }
  }
  return count ? sum.map((value) => value / count) : [255, 255, 255];
}

function removableLine(data, width, height, channels, side, offset, reference, distanceLimit, majority) {
  let close = 0;
  let sampled = 0;
  const visit = (x, y) => {
    sampled += 1;
    const rgba = pixel(data, width, x, y, channels);
    const nearWhite = rgba[0] >= 244 && rgba[1] >= 244 && rgba[2] >= 244;
    if (rgba[3] < 24 || nearWhite || colorDistance(rgba, reference) <= distanceLimit) close += 1;
  };
  if (side === "top" || side === "bottom") {
    const y = side === "top" ? offset : height - 1 - offset;
    for (let x = 0; x < width; x += Math.max(1, Math.floor(width / 128))) visit(x, y);
  } else {
    const x = side === "left" ? offset : width - 1 - offset;
    for (let y = 0; y < height; y += Math.max(1, Math.floor(height / 128))) visit(x, y);
  }
  return close / Math.max(1, sampled) >= majority;
}

export function detectUniformEdgeInsets(image, options = {}) {
  const data = image?.data;
  const width = finiteInteger(image?.width, 0);
  const height = finiteInteger(image?.height, 0);
  const channels = finiteInteger(image?.channels, 4);
  if (!(data instanceof Uint8Array) || !width || !height || ![3, 4].includes(channels) || data.length < width * height * channels) {
    throw new TypeError("mother-sheet tile pixels are invalid");
  }
  const maxRatio = Math.max(0, Math.min(.06, Number(options.maxRatio ?? .04)));
  const distanceLimit = Math.max(4, Math.min(36, Number(options.distanceLimit ?? 18)));
  const majority = Math.max(.7, Math.min(1, Number(options.majority ?? .92)));
  const referenceDepth = Math.max(1, Math.min(4, Number(options.referenceDepth ?? 2)));
  const limits = {
    left: Math.floor(width * maxRatio),
    right: Math.floor(width * maxRatio),
    top: Math.floor(height * maxRatio),
    bottom: Math.floor(height * maxRatio),
  };
  const result = { left: 0, right: 0, top: 0, bottom: 0 };
  for (const side of ["left", "right", "top", "bottom"]) {
    const reference = averageEdge(data, width, height, channels, side, referenceDepth);
    while (result[side] < limits[side]
      && removableLine(data, width, height, channels, side, result[side], reference, distanceLimit, majority)) {
      result[side] += 1;
    }
  }
  if (width - result.left - result.right < width * .88 || height - result.top - result.bottom < height * .88) {
    return { left: 0, right: 0, top: 0, bottom: 0 };
  }
  return result;
}

export function applyEdgeInsets(width, height, insets) {
  const left = Math.max(0, Math.round(Number(insets?.left) || 0));
  const right = Math.max(0, Math.round(Number(insets?.right) || 0));
  const top = Math.max(0, Math.round(Number(insets?.top) || 0));
  const bottom = Math.max(0, Math.round(Number(insets?.bottom) || 0));
  return {
    left,
    top,
    width: Math.max(1, Math.round(width) - left - right),
    height: Math.max(1, Math.round(height) - top - bottom),
  };
}

/**
 * Return the largest centred crop inside an edge-cleaned region whose pixel
 * dimensions are an exact 3:4.  Near-enough ratios are deliberately rejected:
 * downstream rounded clips otherwise reveal a one-pixel paper/grid seam.
 */
export function exactThreeByFourCrop(width, height, insets = {}) {
  const cleaned = applyEdgeInsets(width, height, insets);
  let targetWidth = cleaned.width;
  let targetHeight = Math.floor(targetWidth * 4 / 3);
  if (targetHeight > cleaned.height) {
    targetHeight = cleaned.height;
    targetWidth = Math.floor(targetHeight * 3 / 4);
  }
  targetWidth -= targetWidth % 3;
  targetHeight = targetWidth * 4 / 3;
  if (targetHeight > cleaned.height) {
    targetHeight = cleaned.height - (cleaned.height % 4);
    targetWidth = targetHeight * 3 / 4;
  }
  if (targetWidth < 3 || targetHeight < 4) throw new TypeError("mother-sheet tile is too small after edge cleanup");
  return {
    left: cleaned.left + Math.floor((cleaned.width - targetWidth) / 2),
    top: cleaned.top + Math.floor((cleaned.height - targetHeight) / 2),
    width: targetWidth,
    height: targetHeight,
  };
}
