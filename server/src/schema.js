import { z } from "zod";
import { ALLOWED_CATEGORIES, ALLOWED_MODES } from "./config.js";

export const IntentSchema = z.object({
  category: z.enum(ALLOWED_CATEGORIES),
  tags: z.array(z.string().min(1)).min(2),
  topic_label: z.string().min(3),
  mode: z.enum(ALLOWED_MODES)
});
