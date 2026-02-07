import { LOCATION_TAGS, MATCH_THRESHOLD } from "./config.js";

function normalizeDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return new Date(0);
  return date;
}

function normalizeTagList(value) {
  return (Array.isArray(value) ? value : [])
    .map((tag) => String(tag || "").trim().toLowerCase())
    .filter(Boolean);
}

function sharedTags(a, b) {
  const one = new Set(normalizeTagList(a));
  const two = new Set(normalizeTagList(b));
  const overlap = [];
  for (const tag of one) {
    if (two.has(tag)) overlap.push(tag);
  }
  return overlap;
}

function normalizeLocation(value) {
  return String(value || "").trim().toLowerCase();
}

function pickLocationFromTags(tags) {
  const locationTagSet = new Set(
    LOCATION_TAGS.map((tag) => String(tag || "").trim().toLowerCase())
  );
  return normalizeTagList(tags).find((tag) => locationTagSet.has(tag)) || "";
}

function resolveLocation(request) {
  return normalizeLocation(request?.location) || pickLocationFromTags(request?.tags);
}

function tagScore(overlapTags) {
  return Math.min(30, overlapTags.length * 10);
}

function categoryScore(newRequest, candidate) {
  return String(newRequest?.category || "") === String(candidate?.category || "") ? 20 : 0;
}

function locationScore(newRequest, candidate, overlapTags) {
  const a = resolveLocation(newRequest);
  const b = resolveLocation(candidate);

  if (a && b && a === b) {
    return 10;
  }

  const locationTagSet = new Set(
    LOCATION_TAGS.map((tag) => String(tag || "").trim().toLowerCase())
  );
  const sharedLocationTag = overlapTags.some((tag) => locationTagSet.has(tag));
  return sharedLocationTag ? 5 : 0;
}

function urgencyScore(newRequest, candidate) {
  const left = String(newRequest?.urgency || "").trim().toLowerCase();
  const right = String(candidate?.urgency || "").trim().toLowerCase();
  return left && right && left === right ? 10 : 0;
}

function freshnessScore(createdAt) {
  const ageMs = Date.now() - normalizeDate(createdAt).valueOf();
  const ageHours = Math.floor(Math.max(0, ageMs) / (60 * 60 * 1000));
  return Math.max(0, 5 - ageHours);
}

function historyScore(candidate, requesterHistory) {
  const history = requesterHistory || { categories: new Set(), tags: new Set() };
  const categoryMatch = history.categories.has(String(candidate?.category || ""));
  const candidateTags = normalizeTagList(candidate?.tags);
  const tagMatch = candidateTags.some((tag) => history.tags.has(tag));
  return categoryMatch || tagMatch ? 5 : 0;
}

export function computeCandidateScore(newRequest, candidate, options = {}) {
  const overlapTags = sharedTags(newRequest?.tags, candidate?.tags);

  const scoreBreakdown = {
    tags: tagScore(overlapTags),
    category: categoryScore(newRequest, candidate),
    location: locationScore(newRequest, candidate, overlapTags),
    urgency: urgencyScore(newRequest, candidate),
    freshness: freshnessScore(candidate?.created_at),
    history: historyScore(candidate, options.requesterHistory)
  };

  const score =
    scoreBreakdown.tags +
    scoreBreakdown.category +
    scoreBreakdown.location +
    scoreBreakdown.urgency +
    scoreBreakdown.freshness +
    scoreBreakdown.history;

  const reasons = [];
  for (const tag of overlapTags) {
    reasons.push(`shared tag: ${tag}`);
  }
  if (scoreBreakdown.category > 0) {
    reasons.push(`same category: ${newRequest.category}`);
  }
  if (scoreBreakdown.location === 10) {
    reasons.push(`exact location match: ${resolveLocation(newRequest)}`);
  } else if (scoreBreakdown.location === 5) {
    reasons.push("shared location tag");
  }
  if (scoreBreakdown.urgency > 0) {
    reasons.push(`same urgency: ${String(newRequest?.urgency || "").trim().toLowerCase()}`);
  }
  if (scoreBreakdown.freshness > 0) {
    reasons.push(`freshness bonus: +${scoreBreakdown.freshness}`);
  }
  if (scoreBreakdown.history > 0) {
    reasons.push("user history overlap");
  }

  return { score, reasons, score_breakdown: scoreBreakdown };
}

export function pickBestMatch(newRequest, candidates, options = {}) {
  let best = null;
  for (const candidate of candidates) {
    const computed = computeCandidateScore(newRequest, candidate, options);
    if (!best || computed.score > best.score) {
      best = { candidate, ...computed };
    }
  }
  return best;
}

export function isGoodMatch(score) {
  return score >= MATCH_THRESHOLD;
}
