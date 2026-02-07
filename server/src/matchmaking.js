import { FRESHNESS_WINDOW_HOURS, MATCH_THRESHOLD } from "./config.js";

function normalizeDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return new Date(0);
  return date;
}

function sharedTags(a, b) {
  const one = new Set((Array.isArray(a) ? a : []).map((tag) => String(tag || "").toLowerCase()));
  const two = new Set((Array.isArray(b) ? b : []).map((tag) => String(tag || "").toLowerCase()));
  const overlap = [];
  for (const tag of one) {
    if (two.has(tag)) overlap.push(tag);
  }
  return overlap;
}

function freshnessBonus(createdAt) {
  const windowHours = Number.isFinite(FRESHNESS_WINDOW_HOURS) ? FRESHNESS_WINDOW_HOURS : 24;
  if (windowHours <= 0) return 0;
  const ageMs = Date.now() - normalizeDate(createdAt).valueOf();
  const ratio = Math.max(0, 1 - ageMs / (windowHours * 60 * 60 * 1000));
  return Math.round(ratio * 10);
}

export function computeCandidateScore(newRequest, candidate) {
  const overlap = sharedTags(newRequest.tags, candidate.tags);
  const sameCategory = newRequest.category === candidate.category;
  const freshness = freshnessBonus(candidate.created_at);

  const score = overlap.length * 10 + (sameCategory ? 15 : 0) + freshness;

  const reasons = [];
  for (const tag of overlap) {
    reasons.push(`shared tag: ${tag}`);
  }
  if (sameCategory) {
    reasons.push(`same category: ${newRequest.category}`);
  }
  if (freshness > 0) {
    reasons.push(`freshness bonus: +${freshness}`);
  }

  return { score, reasons };
}

export function pickBestMatch(newRequest, candidates) {
  let best = null;
  for (const candidate of candidates) {
    const computed = computeCandidateScore(newRequest, candidate);
    if (!best || computed.score > best.score) {
      best = { candidate, ...computed };
    }
  }
  return best;
}

export function isGoodMatch(score) {
  return score >= MATCH_THRESHOLD;
}
