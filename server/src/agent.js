import { ALLOWED_CATEGORIES, ALLOWED_MODES, ALLOWED_TAGS } from "./config.js";
import { IntentSchema } from "./schema.js";

const CATEGORY_HINTS = {
  academic: /\b(study|exam|assignment|course|homework|module|lecture|coding|programming|project)\b/i,
  career: /\b(resume|cv|job|career|interview|internship|hiring|linkedin)\b/i,
  tech_support: /\b(debug|bug|error|install|setup|api|backend|frontend|database|sql)\b/i,
  social: /\b(meetup|hangout|friends|chill|club|event)\b/i,
  wellbeing: /\b(stress|burnout|anxiety|mental health|overwhelmed)\b/i,
  language: /\b(language|english|french|speaking practice)\b/i
};

const TAG_RULES = [
  { tag: "debugging", pattern: /\b(debug|bug|error|fix|stack trace)\b/i, weight: 6 },
  { tag: "frontend", pattern: /\b(frontend|front end|react|css|html|ui)\b/i, weight: 5 },
  { tag: "backend", pattern: /\b(backend|back end|node|server|api)\b/i, weight: 5 },
  { tag: "databases", pattern: /\b(database|db|sql|postgres|mysql|mongodb)\b/i, weight: 5 },
  { tag: "api_design", pattern: /\b(api design|endpoint|schema|payload)\b/i, weight: 4 },
  { tag: "algorithms", pattern: /\b(algorithm|leetcode|complexity)\b/i, weight: 4 },
  { tag: "data_structures", pattern: /\b(data structure|tree|graph|hash map|queue|stack)\b/i, weight: 4 },
  { tag: "recursion", pattern: /\b(recursion|recursive)\b/i, weight: 4 },
  { tag: "project_support", pattern: /\b(project|build together|pair program)\b/i, weight: 4 },
  { tag: "study_groups", pattern: /\b(study group|study together|revise together)\b/i, weight: 4 },
  { tag: "exam_prep", pattern: /\b(exam|midterm|final|test prep)\b/i, weight: 4 },
  { tag: "homework_help", pattern: /\b(homework|assignment|coursework)\b/i, weight: 4 },
  { tag: "resume_help", pattern: /\b(resume|cv|portfolio)\b/i, weight: 4 },
  { tag: "interview_prep", pattern: /\b(interview|mock interview)\b/i, weight: 4 },
  { tag: "internship_search", pattern: /\b(internship|placement)\b/i, weight: 4 },
  { tag: "job_search", pattern: /\b(job search|job hunt|apply)\b/i, weight: 4 },
  { tag: "networking", pattern: /\b(networking|linkedin|connect)\b/i, weight: 3 },
  { tag: "mental_health", pattern: /\b(mental health|anxiety|burnout)\b/i, weight: 4 },
  { tag: "stress_management", pattern: /\b(stress|overwhelmed|coping)\b/i, weight: 3 },
  { tag: "language_exchange", pattern: /\b(language exchange|conversation partner)\b/i, weight: 4 },
  { tag: "english_tutoring", pattern: /\b(english help|english tutoring)\b/i, weight: 4 },
  { tag: "french_speaking", pattern: /\b(french|francais)\b/i, weight: 4 },
  { tag: "events", pattern: /\b(event|events|meetup)\b/i, weight: 3 },
  { tag: "conference", pattern: /\b(conference|summit)\b/i, weight: 3 },
  { tag: "workshop", pattern: /\b(workshop|bootcamp)\b/i, weight: 3 }
];

const CATEGORY_DEFAULT_TAGS = {
  academic: ["project_support", "study_groups"],
  career: ["resume_help", "interview_prep"],
  tech_support: ["debugging", "backend"],
  social: ["meetup", "events"],
  wellbeing: ["mental_health", "stress_management"],
  language: ["language_exchange", "english_tutoring"]
};

function cleanText(text) {
  return String(text || "").trim().replace(/\s+/g, " ");
}

function detectMode(text) {
  const input = cleanText(text).toLowerCase();
  if (/\b(work together|collab|collaborate|pair program|team up|group)\b/.test(input)) {
    return "group";
  }
  if (/\b(i can help|happy to help|offering help|mentor|i can support)\b/.test(input)) {
    return "offer";
  }
  return "help";
}

function detectCategory(text) {
  const input = cleanText(text);
  for (const [category, pattern] of Object.entries(CATEGORY_HINTS)) {
    if (pattern.test(input)) return category;
  }
  return "academic";
}

function inferTags(text, mode, category) {
  const input = cleanText(text);
  const scores = new Map();

  for (const rule of TAG_RULES) {
    if (!ALLOWED_TAGS.includes(rule.tag)) continue;
    if (rule.pattern.test(input)) {
      scores.set(rule.tag, (scores.get(rule.tag) || 0) + rule.weight);
    }
  }

  for (const tag of ALLOWED_TAGS) {
    const phrase = tag.replace(/[_-]/g, " ");
    if (input.toLowerCase().includes(phrase)) {
      scores.set(tag, (scores.get(tag) || 0) + 2);
    }
  }

  if (mode === "group" && /\b(work together|collab|collaborate|pair program|team up)\b/i.test(input)) {
    scores.set("project_support", (scores.get("project_support") || 0) + 5);
  }

  const ranked = [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag]) => tag);

  const fallback = CATEGORY_DEFAULT_TAGS[category] || ["project_support", "study_groups"];
  const merged = [...ranked, ...fallback].filter((tag, i, arr) => arr.indexOf(tag) === i);
  return merged.slice(0, 5);
}

function makeTopicLabel(text) {
  const cleaned = cleanText(text);
  if (!cleaned) return "Request";
  return cleaned.slice(0, 60);
}

export async function classifyIntent(inputText) {
  const text = cleanText(inputText);
  const mode = ALLOWED_MODES.includes(detectMode(text)) ? detectMode(text) : "help";
  const category = ALLOWED_CATEGORIES.includes(detectCategory(text)) ? detectCategory(text) : "academic";
  const tags = inferTags(text, mode, category);

  while (tags.length < 2) {
    const fallback = CATEGORY_DEFAULT_TAGS[category] || ["project_support", "study_groups"];
    tags.push(fallback[tags.length] || "study_groups");
  }

  return IntentSchema.parse({
    category,
    tags,
    topic_label: makeTopicLabel(text),
    mode
  });
}
