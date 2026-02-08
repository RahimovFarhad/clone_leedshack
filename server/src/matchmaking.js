const CORE_TAG_WEIGHTS = {
  debugging: 10,
  frontend: 9,
  backend: 9,
  databases: 9,
  api_design: 8,
  algorithms: 8,
  data_structures: 8,
  recursion: 8,
  project_support: 7,
  study_groups: 7,
  exam_prep: 7,
  homework_help: 7,
  resume_help: 7,
  interview_prep: 7,
  internship_search: 7,
  job_search: 7
};

const TOKEN_ALIASES = {
  coding: "programming",
  code: "programming",
  programmer: "programming",
  debug: "debugging",
  bug: "debugging",
  db: "database",
  databases: "database",
  sql: "database",
  api: "api"
};

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "this",
  "that",
  "from",
  "have",
  "need",
  "help",
  "just",
  "want",
  "something",
  "please",
  "can",
  "anyone"
]);

function normalizeToken(token) {
  const raw = String(token || "").trim().toLowerCase();
  if (!raw) return "";
  return TOKEN_ALIASES[raw] || raw;
}

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map(normalizeToken)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function tokenSimilarity(leftText, rightText, maxScore) {
  const left = new Set(tokenize(leftText));
  const right = new Set(tokenize(rightText));
  if (!left.size || !right.size) return 0;

  let overlap = 0;
  for (const token of left) {
    if (right.has(token)) overlap += 1;
  }
  if (!overlap) return 0;

  const union = new Set([...left, ...right]).size;
  const jaccard = overlap / Math.max(1, union);
  const containment = overlap / Math.max(1, Math.min(left.size, right.size));
  const blended = Math.max(jaccard, containment * 0.85);
  return Math.round(maxScore * blended);
}

function roomNameScore(requestText, topicLabel, roomName) {
  const query = `${String(requestText || "")} ${String(topicLabel || "")}`.trim();
  const left = query.toLowerCase();
  const right = String(roomName || "").trim().toLowerCase();
  if (!left || !right) return 0;
  if (left === right) return 44;
  if (left.includes(right) || right.includes(left)) return 36;
  return Math.min(40, tokenSimilarity(query, roomName, 44));
}

function modeBonus(requestMode, roomMode) {
  const left = String(requestMode || "").trim().toLowerCase();
  const right = String(roomMode || "").trim().toLowerCase();
  if (left === "group" && right === "group") return 14;
  if ((left === "help" && right === "offer") || (left === "offer" && right === "help")) return 16;
  return 0;
}

function tagBonus(requestTags, roomTags) {
  const req = new Set((Array.isArray(requestTags) ? requestTags : []).map((tag) => String(tag || "").trim().toLowerCase()));
  const room = new Set((Array.isArray(roomTags) ? roomTags : []).map((tag) => String(tag || "").trim().toLowerCase()));

  let total = 0;
  for (const tag of req) {
    if (!room.has(tag)) continue;
    total += CORE_TAG_WEIGHTS[tag] || 5;
  }
  return Math.min(26, total);
}

function availabilityBonus(participantCount) {
  const count = Number(participantCount || 0);
  if (count <= 0) return 6;
  if (count === 1) return 10;
  if (count === 2) return 6;
  return 2;
}

function urgencyBonus(requestUrgency, roomUrgency) {
  const left = String(requestUrgency || "").trim().toLowerCase();
  const right = String(roomUrgency || "").trim().toLowerCase();
  if (!left || !right) return 0;
  return left === right ? 6 : 0;
}

export function scoreRoomCandidate({ request, room }) {
  const name = roomNameScore(request.text, request.topic_label, room.name);
  const mode = modeBonus(request.mode, room.mode);
  const tags = tagBonus(request.tags, room.tags);
  const availability = availabilityBonus(room.participantsCount);
  const urgency = urgencyBonus(request.urgency, room.urgency);

  const scoreBreakdown = {
    room_name: name,
    mode,
    tags,
    availability,
    urgency
  };

  const score = Object.values(scoreBreakdown).reduce((sum, val) => sum + Number(val || 0), 0);
  const reasons = [];
  if (name > 0) reasons.push(`room name similarity: +${name}`);
  if (mode > 0) {
    reasons.push(mode === 16 ? "mode fit: help <> offer" : "mode fit: group <> group");
  }
  if (tags > 0) reasons.push(`shared tags: +${tags}`);
  if (availability > 0) reasons.push(`room availability: +${availability}`);
  if (urgency > 0) reasons.push(`same urgency: ${request.urgency}`);

  return { score, score_breakdown: scoreBreakdown, reasons };
}

export function isGoodMatch(score) {
  return Number(score || 0) >= 42;
}

export function toMatchPercentage(score) {
  const normalized = (Number(score || 0) / 100) * 100;
  return Math.max(0, Math.min(99, Math.round(normalized)));
}
