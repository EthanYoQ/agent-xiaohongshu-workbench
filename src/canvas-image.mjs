export const IMAGE_SCALE_MIN = 25;
export const IMAGE_SCALE_MAX = 400;
export const IMAGE_FRAME_MIN = 8;

function clamp(value, low, high) {
  const number = Number(value);
  if (!Number.isFinite(number)) return low;
  return Math.max(low, Math.min(high, number));
}

function normalizedCrop(value = {}) {
  const width = clamp(value.width ?? 1, 0.05, 1);
  const height = clamp(value.height ?? 1, 0.05, 1);
  return {
    x: clamp(value.x ?? 0, 0, 1 - width),
    y: clamp(value.y ?? 0, 0, 1 - height),
    width,
    height,
  };
}

export function imageCropSourceStyle(imageStyle = {}) {
  const crop = normalizedCrop(imageStyle.crop);
  return {
    left: `${(-crop.x / crop.width) * 100}%`,
    top: `${(-crop.y / crop.height) * 100}%`,
    width: `${100 / crop.width}%`,
    height: `${100 / crop.height}%`,
  };
}

export function preserveImageCropForFrameResize(startFrame, nextFrame, cropValue = {}) {
  const start = {
    x: Number(startFrame?.x ?? 0), y: Number(startFrame?.y ?? 0),
    width: Math.max(IMAGE_FRAME_MIN, Number(startFrame?.width ?? 100)),
    height: Math.max(IMAGE_FRAME_MIN, Number(startFrame?.height ?? 100)),
  };
  const next = {
    x: Number(nextFrame?.x ?? start.x), y: Number(nextFrame?.y ?? start.y),
    width: Math.max(IMAGE_FRAME_MIN, Number(nextFrame?.width ?? start.width)),
    height: Math.max(IMAGE_FRAME_MIN, Number(nextFrame?.height ?? start.height)),
  };
  const crop = normalizedCrop(cropValue);
  const width = clamp(crop.width * (next.width / start.width), 0.05, 1);
  const height = clamp(crop.height * (next.height / start.height), 0.05, 1);
  const x = clamp(crop.x + ((next.x - start.x) / start.width) * crop.width, 0, 1 - width);
  const y = clamp(crop.y + ((next.y - start.y) / start.height) * crop.height, 0, 1 - height);
  return { x, y, width, height };
}

export function imageElementStyle(imageStyle = {}) {
  const scale = clamp(imageStyle.scale ?? 100, IMAGE_SCALE_MIN, IMAGE_SCALE_MAX);
  const rotation = clamp(imageStyle.rotation ?? 0, -180, 180);
  const opacity = clamp(imageStyle.opacity ?? 1, 0.1, 1);
  const fit = imageStyle.fit === "cover" ? "cover" : "contain";
  return {
    objectPosition: `${clamp(imageStyle.focalX ?? 50, 0, 100)}% ${clamp(imageStyle.focalY ?? 50, 0, 100)}%`,
    objectFit: fit,
    width: `${scale}%`,
    height: `${scale}%`,
    opacity,
    transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
  };
}

export function imagePlacementForFrame({
  intrinsicWidth, intrinsicHeight, targetWidth, targetHeight,
  fit = "cover", focalX = 50, focalY = 50, bleedScale = 1,
} = {}) {
  const sourceWidth = Math.max(1, Number(intrinsicWidth) || 1);
  const sourceHeight = Math.max(1, Number(intrinsicHeight) || 1);
  const frameWidth = Math.max(1, Number(targetWidth) || 1);
  const frameHeight = Math.max(1, Number(targetHeight) || 1);
  const contain = fit === "contain";
  const scale = contain
    ? Math.min(frameWidth / sourceWidth, frameHeight / sourceHeight)
    : Math.max(frameWidth / sourceWidth, frameHeight / sourceHeight) * Math.max(1, Number(bleedScale) || 1);
  const visibleWidth = contain ? sourceWidth : Math.min(sourceWidth, frameWidth / scale);
  const visibleHeight = contain ? sourceHeight : Math.min(sourceHeight, frameHeight / scale);
  const focusX = (clamp(focalX, 0, 100) / 100) * sourceWidth;
  const focusY = (clamp(focalY, 0, 100) / 100) * sourceHeight;
  return {
    scale,
    visibleWidth,
    visibleHeight,
    cropX: contain ? 0 : clamp(focusX - visibleWidth / 2, 0, sourceWidth - visibleWidth),
    cropY: contain ? 0 : clamp(focusY - visibleHeight / 2, 0, sourceHeight - visibleHeight),
  };
}

export function panImageFocalPoint(imageStyle = {}, deltaX = 0, deltaY = 0) {
  return {
    focalX: clamp(Number(imageStyle.focalX ?? 50) - Number(deltaX || 0), 0, 100),
    focalY: clamp(Number(imageStyle.focalY ?? 50) - Number(deltaY || 0), 0, 100),
  };
}

export function resizeImageFrame(frame, handle, deltaX, deltaY, { lockAspect = false } = {}) {
  const source = {
    x: clamp(frame?.x ?? 0, 0, 100),
    y: clamp(frame?.y ?? 0, 0, 100),
    width: clamp(frame?.width ?? 100, IMAGE_FRAME_MIN, 100),
    height: clamp(frame?.height ?? 100, IMAGE_FRAME_MIN, 100),
  };
  const right = Math.min(100, source.x + source.width);
  const bottom = Math.min(100, source.y + source.height);
  const west = String(handle || "").includes("w");
  const east = String(handle || "").includes("e");
  const north = String(handle || "").includes("n");
  const south = String(handle || "").includes("s");

  let x = source.x;
  let y = source.y;
  let width = source.width;
  let height = source.height;

  if (west) {
    x = clamp(source.x + Number(deltaX || 0), 0, right - IMAGE_FRAME_MIN);
    width = right - x;
  } else if (east) {
    width = clamp(source.width + Number(deltaX || 0), IMAGE_FRAME_MIN, 100 - source.x);
  }
  if (north) {
    y = clamp(source.y + Number(deltaY || 0), 0, bottom - IMAGE_FRAME_MIN);
    height = bottom - y;
  } else if (south) {
    height = clamp(source.height + Number(deltaY || 0), IMAGE_FRAME_MIN, 100 - source.y);
  }

  if (lockAspect && source.height > 0) {
    const ratio = source.width / source.height;
    const widthDriven = Math.abs(Number(deltaX || 0)) >= Math.abs(Number(deltaY || 0));
    if (widthDriven) {
      height = clamp(width / ratio, IMAGE_FRAME_MIN, 100 - y);
      if (north) y = bottom - height;
    } else {
      width = clamp(height * ratio, IMAGE_FRAME_MIN, 100 - x);
      if (west) x = right - width;
    }
  }

  return { x, y, width, height };
}

export function resizeTextFrame(frame, handle, deltaX, minWidth = 12) {
  const source = {
    ...frame,
    x: clamp(frame?.x ?? 0, 0, 100),
    width: clamp(frame?.width ?? 100, minWidth, 100),
  };
  const right = Math.min(100, source.x + source.width);
  const west = String(handle || "").includes("w");
  const east = String(handle || "").includes("e");
  let x = source.x;
  let width = source.width;

  if (west) {
    x = clamp(source.x + Number(deltaX || 0), 0, right - minWidth);
    width = right - x;
  } else if (east) {
    width = clamp(source.width + Number(deltaX || 0), minWidth, 100 - source.x);
  }

  return { ...source, x, width };
}

export function nudgeImageScale(scale, delta) {
  return clamp(Number(scale ?? 100) + Number(delta || 0), IMAGE_SCALE_MIN, IMAGE_SCALE_MAX);
}
