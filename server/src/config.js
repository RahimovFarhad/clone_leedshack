export const ALLOWED_CATEGORIES = [
  "academics",
  "career",
  "wellbeing",
  "project",
  "campus_life",
  "social",
  "admin"
];

export const ALLOWED_TAGS = [
  "algorithms",
  "data_structures",
  "exam_prep",
  "debugging",
  "math",
  "recursion",
  "frontend",
  "backend",
  "databases",
  "api_design",
  "system_design",
  "devops",
  "mobile",
  "ui_ux",
  "machine_learning",
  "resume",
  "interview_prep",
  "mental_health",
  "events",
  "housing",
  "trips",
  "scholarships",
  "research",
  "clubs",
  "networking",
  "sports",
  "music",
  "art",
  "volunteering",
  "fundraising",
];

export const ALLOWED_MODES = ["help", "offer", "group"];

// cloudflare | openai | ollama | fallback
export const LLM_PROVIDER = process.env.LLM_PROVIDER || "cloudflare";

export const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

export const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2:3b";

export const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || "";
export const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || "";
export const CLOUDFLARE_MODEL =
  process.env.CLOUDFLARE_MODEL || "@cf/meta/llama-3.1-70b-instruct";

export const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://your_mongo_uri_here/intent_router";
export const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "intent_router";

export const MATCH_THRESHOLD = Number(process.env.MATCH_THRESHOLD || 30);
export const FRESHNESS_WINDOW_HOURS = Number(process.env.FRESHNESS_WINDOW_HOURS || 24);
