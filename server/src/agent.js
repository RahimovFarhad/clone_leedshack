import {
  ALLOWED_CATEGORIES,
  ALLOWED_MODES,
  ALLOWED_TAGS,
  CLOUDFLARE_ACCOUNT_ID,
  CLOUDFLARE_API_TOKEN,
  CLOUDFLARE_MODEL
} from "./config.js";
import { IntentSchema } from "./schema.js";

const CATEGORY_FALLBACK_TAGS = {
  academic: ["project_support", "study_groups", "homework_help"],
  career: ["resume_help", "interview_prep", "job_search"],
  tech_support: ["debugging", "backend", "api_design"],
  social: ["meetup", "events", "hobbies"],
  wellbeing: ["mental_health", "stress_management", "study_groups"],
  language: ["language_exchange", "english_tutoring", "study_groups"]
};

function cleanText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeTags(tags, category) {
  const base = Array.isArray(tags) ? tags : [];
  const normalized = base
    .map((tag) => String(tag || "").trim().toLowerCase())
    .filter(Boolean)
    .filter((tag) => ALLOWED_TAGS.includes(tag))
    .filter((tag, i, arr) => arr.indexOf(tag) === i);

  const fallback = CATEGORY_FALLBACK_TAGS[category] || ["project_support", "study_groups", "homework_help"];
  for (const tag of fallback) {
    if (normalized.length >= 6) break;
    if (!normalized.includes(tag) && ALLOWED_TAGS.includes(tag)) {
      normalized.push(tag);
    }
  }

  while (normalized.length < 3) {
    const defaultTag = ["project_support", "study_groups", "homework_help"][normalized.length] || "study_groups";
    if (!normalized.includes(defaultTag) && ALLOWED_TAGS.includes(defaultTag)) {
      normalized.push(defaultTag);
    } else {
      const firstAllowed = ALLOWED_TAGS.find((tag) => !normalized.includes(tag));
      if (!firstAllowed) break;
      normalized.push(firstAllowed);
    }
  }

  return normalized.slice(0, 6);
}

function normalizeIntent(raw, inputText) {
  const category = ALLOWED_CATEGORIES.includes(raw?.category) ? raw.category : "academic";
  const mode = ALLOWED_MODES.includes(raw?.mode) ? raw.mode : "help";
  const topicLabel = cleanText(raw?.topic_label || inputText || "Request").slice(0, 60);
  const tags = normalizeTags(raw?.tags, category);

  return IntentSchema.parse({
    category,
    mode,
    topic_label: topicLabel || "Request",
    tags
  });
}

function buildSystemPrompt() {
  return `Classify the user request and return STRICT JSON only.
Output keys exactly: category, tags, topic_label, mode

Rules:
- category: one of [${ALLOWED_CATEGORIES.join(", ")}]
- tags: 3 to 6 tags from [${ALLOWED_TAGS.join(", ")}]
- If you think the request has multiple layers, make sure to include tags for all of them 
- topic_label: short concise label (3-60 chars), no generic "Community request"
- mode: one of [${ALLOWED_MODES.join(", ")}]

No markdown. No explanation. JSON only.`;
}

async function classifyWithCloudflare(inputText) {
  const accountId = String(CLOUDFLARE_ACCOUNT_ID || "").trim();
  const apiToken = String(CLOUDFLARE_API_TOKEN || "").trim();
  const modelPath = String(CLOUDFLARE_MODEL || "").trim().replace(/^\/+/, "");

  if (!accountId || !apiToken || !modelPath) {
    throw new Error("Cloudflare AI credentials are not configured");
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${modelPath}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: String(inputText || "") }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 350
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Cloudflare classify failed: ${response.status} ${body}`);
  }

  const payload = await response.json();
  const text =
    payload?.result?.response ||
    payload?.result?.text ||
    payload?.result?.output_text ||
    (Array.isArray(payload?.result?.output)
      ? payload.result.output.map((part) => part?.content || "").join("")
      : "{}");

  let parsed = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = {};
  }

  return normalizeIntent(parsed, inputText);
}

export async function classifyIntent(inputText) {
  return classifyWithCloudflare(cleanText(inputText));
}
