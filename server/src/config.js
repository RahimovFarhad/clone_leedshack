export const ALLOWED_CATEGORIES = [
  "social",
  "academic",
  "career",
  "wellbeing",
  "tech_support",
  "location",
  "language",
  "lifestyle",
  "travel",
  "fitness",
  "hobbies",
  "events",
  "networking",
  "workout",
  "study",
  "job_search",
  "internships",
  "mental_health",
];

export const ALLOWED_TAGS = [
  "meetup",
  "events",
  "hobbies",
  "networking",
  "study_groups",
  "exam_prep",
  "homework_help",
  "project_support",
  "algorithms",
  "data_structures",
  "recursion",
  "math",
  "debugging",
  "frontend",
  "backend",
  "databases",
  "api_design",
  "system_design",
  "devops",
  "mobile",
  "ui_ux",
  "machine_learning",
  "resume_help",
  "interview_prep",
  "job_search",
  "internship_search",
  "cv_review",
  "mental_health",
  "stress_management",
  "language_exchange",
  "english_tutoring",
  "french_speaking",
  "software_install",
  "wifi_issues",
  "printer_support",
  "conference",
  "workshop",
  "fitness_group",
  "workout",
  "resume"
];

export const ALLOWED_MODES = ["help", "offer", "group"];
export const LOCATION_TAGS = [];

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
  process.env.MONGODB_URI || "mongodb://your_mongo_uri_here/intent-router";
export const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "intent-router";
export const DB_PROVIDER = (process.env.DB_PROVIDER || "sqlite").toLowerCase();
export const SQLITE_DB_PATH = process.env.SQLITE_DB_PATH || "data/data.db";

export const MATCH_THRESHOLD = Number(process.env.MATCH_THRESHOLD || 30);
export const FRESHNESS_WINDOW_HOURS = Number(process.env.FRESHNESS_WINDOW_HOURS || 24);
