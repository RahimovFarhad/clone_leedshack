import "dotenv/config";
import express from "express";
import { classifyIntent } from "./agent.js";
import { ALLOWED_CATEGORIES, ALLOWED_TAGS, ALLOWED_MODES } from "./config.js";
import {
  attachRequestToRoom,
  createDirectRoom,
  createRequest,
  findOrCreateTopicRoom,
  listOpenRequestsExcludingUser,
  markRequestsMatched
} from "./store.js";
import { isGoodMatch, pickBestMatch } from "./matchmaking.js";

const app = express();
const PORT = Number(process.env.PORT || 4000);

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "intent-router-server" });
});

app.get("/api/options", (_req, res) => {
  res.json({
    allowed_categories: ALLOWED_CATEGORIES,
    allowed_tags: ALLOWED_TAGS,
    allowed_modes: ALLOWED_MODES
  });
});

app.post("/api/classify-intent", async (req, res) => {
  try {
    const text = String(req.body?.text || "").trim();

    if (!text) {
      return res.status(400).json({ error: "'text' is required" });
    }

    const result = await classifyIntent(text);
    return res.json(result);
  } catch (error) {
    console.error("classify-intent error", error);
    return res.status(500).json({ error: "Intent classification failed" });
  }
});

app.post("/post-request", async (req, res) => {
  try {
    const text = String(req.body?.text || "").trim();
    const urgency = String(req.body?.urgency || "").trim();
    const userId = String(req.body?.user_id || req.headers["x-user-id"] || "anonymous").trim();
    console.log("[post-request][step 1] received request", { userId, urgency });

    if (!text) {
      return res.status(400).json({ error: "'text' is required" });
    }
    if (!urgency) {
      return res.status(400).json({ error: "'urgency' is required" });
    }
    if (!userId) {
      return res.status(400).json({ error: "'user_id' is required (or provide x-user-id header)" });
    }

    console.log("[post-request][step 2] classifying intent");
    const intent = await classifyIntent(text);
    const firstTag = intent.tags?.[0] || "general";
    console.log("[post-request][step 3] classification complete", {
      category: intent.category,
      tags: intent.tags
    });

    const newRequest = await createRequest({
      user_id: userId,
      text,
      urgency,
      status: "OPEN",
      category: intent.category,
      tags: intent.tags,
      topic_label: intent.topic_label,
      mode: intent.mode
    });
    console.log("[post-request][step 4] request saved", {
      requestId: String(newRequest._id),
      status: newRequest.status
    });

    const openCandidates = await listOpenRequestsExcludingUser(userId);
    console.log("[post-request][step 5] loaded open candidates", {
      count: openCandidates.length
    });
    const best = pickBestMatch(newRequest, openCandidates);
    if (best) {
      console.log("[post-request][step 6] best candidate scored", {
        candidateRequestId: String(best.candidate._id),
        score: best.score,
        reasons: best.reasons
      });
    } else {
      console.log("[post-request][step 6] no candidate found");
    }

    if (best && isGoodMatch(best.score)) {
      const room = await createDirectRoom({
        userIds: [newRequest.user_id, best.candidate.user_id],
        requestIds: [newRequest._id, best.candidate._id],
        score: best.score,
        reasons: best.reasons
      });

      await markRequestsMatched([newRequest._id, best.candidate._id], room._id);
      console.log("[post-request][step 7] direct match created", {
        roomId: String(room._id),
        score: best.score
      });

      return res.json({
        room_id: String(room._id),
        score: best.score,
        reasons: best.reasons
      });
    }

    const topicRoom = await findOrCreateTopicRoom({
      category: intent.category,
      firstTag,
      userId
    });
    await attachRequestToRoom(newRequest._id, topicRoom._id);
    console.log("[post-request][step 7] topic room assigned", {
      roomId: String(topicRoom._id),
      category: intent.category,
      firstTag
    });

    return res.json({
      room_id: String(topicRoom._id)
    });
  } catch (error) {
    console.error("post-request error", error);
    return res.status(500).json({ error: "Post request failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Intent router server listening on http://localhost:${PORT}`);
});
