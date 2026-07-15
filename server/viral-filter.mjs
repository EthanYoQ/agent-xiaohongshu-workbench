export const VIRAL_THRESHOLDS = Object.freeze({
  minLikes: 300,
  minCollects: 100,
  minLikesAndCollects: 400,
});

function metric(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

export function isVerifiedViralSignal(signal) {
  const engagement = signal?.engagement;
  if (!engagement || engagement.verified !== true) return false;
  const likes = metric(engagement.likes);
  const collects = metric(engagement.collects);
  if (likes === null || collects === null) return false;
  return likes >= VIRAL_THRESHOLDS.minLikes
    || collects >= VIRAL_THRESHOLDS.minCollects
    || likes + collects >= VIRAL_THRESHOLDS.minLikesAndCollects;
}

export function viralThresholdSummary() {
  return `点赞≥${VIRAL_THRESHOLDS.minLikes}，或收藏≥${VIRAL_THRESHOLDS.minCollects}，或点赞+收藏≥${VIRAL_THRESHOLDS.minLikesAndCollects}；评论数不能单独作为爆款依据`;
}
