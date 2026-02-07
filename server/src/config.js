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
  "chill",
  "exam_prep",
  "homework_help",
  "study_groups",
  "project_support",
  "algorithms",
  "data_structures",
  "recursion",
  "math",
  "debugging",
  "internship_search",
  "cv_review",
  "interview_prep",
  "mental_health",
  "stress_management",
  "work_life_balance",
  "wifi_issues",
  "software_install",
  "printer_support",
  "new_zealand_adventure",
  "language_exchange",
  "english_tutoring",
  "french_speaking",
  "fitness_group",
  "cooking_class",
  "travel_buddies",
  "food_enthusiasts",
  "trip_planning",
  "adventure",
  "tourism",
  "backpacking",
  "city_exploration",
  "conference",
  "workshop",
  "gym_buddies",
  "hiking",
  "running",
  "yoga",
  "workout",
  "resume_help",
  "interview_preparation",
  "job_search",
  "networking",
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
];

export const ALLOWED_MODES = ["help", "offer", "group"];
export const LOCATION_TAGS = [
  "United_Kingdom",
  "United_States",
  "Canada",
  "Australia",
  "Germany",
  "France",
  "Spain",
  "Italy",
  "Netherlands",
  "Sweden",
  "Norway",
  "Denmark",
  "Finland",
  "Switzerland",
  "Austria",
  "Belgium",
  "Ireland",
  "New_Zealand",
  "Russia",
  "China",
  "Japan",
  "South_Korea",
  "Singapore",
  "Edinburgh",
  "London",
  "Glasgow",
  "Manchester",
  "Bristol",
  "Leeds",
  "Liverpool",
  "New_York",
  "Los_Angeles",
  "Chicago",
  "Texas",
];

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
export const DB_PROVIDER = (process.env.DB_PROVIDER || "sqlite").toLowerCase();
export const SQLITE_DB_PATH = process.env.SQLITE_DB_PATH || "data/data.db";

export const MATCH_THRESHOLD = Number(process.env.MATCH_THRESHOLD || 30);
export const FRESHNESS_WINDOW_HOURS = Number(process.env.FRESHNESS_WINDOW_HOURS || 24);
