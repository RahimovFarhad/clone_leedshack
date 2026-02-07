import {
  ALLOWED_CATEGORIES,
  ALLOWED_MODES,
  ALLOWED_TAGS,
  LLM_PROVIDER,
  CLOUDFLARE_ACCOUNT_ID,
  CLOUDFLARE_API_TOKEN,
  CLOUDFLARE_MODEL
} from "./config.js";
import { IntentSchema } from "./schema.js";

function normalizeTags(tags) {
  const normalized = Array.isArray(tags)
    ? tags
        .map((t) => String(t || "").trim().toLowerCase())
        .filter(Boolean)
        .filter((t, i, arr) => arr.indexOf(t) === i)
    : [];

  return normalized.filter((t) => ALLOWED_TAGS.includes(t));
}

function sanitizeIntent(parsed) {
  const safe = {
    category: ALLOWED_CATEGORIES.includes(parsed?.category) ? parsed.category : "academics",
    tags: normalizeTags(parsed?.tags),
    topic_label: String(parsed?.topic_label || "Community request").slice(0, 60),
    mode: ALLOWED_MODES.includes(parsed?.mode) ? parsed.mode : "help"
  };

  while (safe.tags.length < 2) {
    safe.tags.push(safe.tags.length === 0 ? "debugging" : "exam_prep");
  }

  safe.tags = safe.tags.slice(0, 5);
  return IntentSchema.parse(safe);
}

function fallbackIntent(text) {
  const input = String(text || "").toLowerCase();

  let mode = "help";
  if (/(i can help|i can mentor|i can support|available to help|offering)/.test(input)) {
    mode = "offer";
  }
  if (/(let.s discuss|discussion|group study|study group|anyone up for)/.test(input)) {
    mode = "group";
  }

  let category = "academics";
  if (/(cv|resume|job|interview|internship|career)/.test(input)) category = "career";
  if (/(stress|anxiety|burnout|mental|wellbeing)/.test(input)) category = "wellbeing";
  if (/(event|club|community|campus|housing|dorm)/.test(input)) category = "campus_life";
  if (/(project|build|prototype|hackathon)/.test(input)) category = "project";

  const tags = ALLOWED_TAGS.filter((tag) =>
    input.includes(tag.replace(/[_-]/g, " "))
  ).slice(0, 3);
  while (tags.length < 2) {
    const next = mode === "offer" ? "frontend" : "exam_prep";
    if (!tags.includes(next)) tags.push(next);
    else tags.push("debugging");
  }

  const topic_label =
    String(text || "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 56) || "Community request";

  return { category, tags, topic_label, mode };
}

function buildSystemPrompt() {
  return `You classify a community post into strict JSON.
Return ONLY valid JSON with keys: category, tags, topic_label, mode.
Rules:
- category: choose exactly one from: ${ALLOWED_CATEGORIES.join(", ")}
- tags: choose at least 3, at max 6 tags from: ${ALLOWED_TAGS.join(", ")}
- topic_label: short human-readable label you invent (3-60 chars)
- mode: choose one from (choose only the most fitting): ${ALLOWED_MODES.join(" | ")}
  - help: user clearly asks for help
  - offer: user clearly offers to help
  - group: user invites group discussion/collaboration
No markdown, no explanations.`;
}

async function classifyWithCloudflare(inputText) {
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
    throw new Error("Cloudflare credentials are not configured");
  }

  const accountId = String(CLOUDFLARE_ACCOUNT_ID || "").trim();
  const apiToken = String(CLOUDFLARE_API_TOKEN || "").trim();
  const modelPath = String(CLOUDFLARE_MODEL || "").trim().replace(/^\/+/, "");

  if (accountId === "your_account_id") {
    throw new Error(
      "Cloudflare account ID is still set to placeholder value 'your_account_id'"
    );
  }

  if (apiToken === "your_cloudflare_api_token") {
    throw new Error(
      "Cloudflare API token is still set to placeholder value 'your_cloudflare_api_token'"
    );
  }

  if (!/^[a-f0-9]{32}$/i.test(accountId)) {
    throw new Error("Cloudflare account ID must be a 32-character hex string");
  }

  if (!modelPath) {
    throw new Error("Cloudflare model path is empty");
  }

  // Workers AI expects the model path as a raw path segment (e.g. @cf/meta/...)
  // and not URL-encoded as @cf%2Fmeta%2F...
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${modelPath}`;
  console.log("[classify][cloudflare] request started", { model: modelPath });
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
      max_tokens: 300,
      temperature: 0.2
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Cloudflare request failed: ${response.status} ${body}`);
  }
  console.log("[classify][cloudflare] request succeeded");

  const data = await response.json();
  const rawText =
    data?.result?.response ||
    data?.result?.text ||
    data?.result?.output_text ||
    (Array.isArray(data?.result?.output)
      ? data.result.output.map((p) => p?.content || "").join("")
      : "{}");

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    parsed = {};
  }

  return sanitizeIntent(parsed);
}

export async function classifyIntent(inputText) {
  const provider = String(LLM_PROVIDER || "").toLowerCase();
  console.log("[classify] provider selected", { provider });

  if (provider === "fallback") {
    return IntentSchema.parse(fallbackIntent(inputText));
  }

  try {
    return await classifyWithCloudflare(inputText);
  } catch (error) {
    console.warn("Cloudflare classification failed, falling back:", error.message);
    return IntentSchema.parse(fallbackIntent(inputText));
  }
}
