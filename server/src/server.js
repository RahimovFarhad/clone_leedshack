import "dotenv/config";
import http from "node:http";
import crypto from "node:crypto";
import express from "express";
import WebSocket, { WebSocketServer } from "ws";
import { classifyIntent } from "./agent.js";
import { ALLOWED_CATEGORIES, ALLOWED_TAGS, ALLOWED_MODES, LOCATION_TAGS } from "./config.js";
import {
  attachRequestToRoom,
  createDirectRoom,
  createRequest,
  findOrCreateTopicRoom,
  listOpenRequestsExcludingUser,
  listUserRequests,
  markRequestsMatched
} from "./store.js";
import { isGoodMatch, pickBestMatch } from "./matchmaking.js";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

const communities = [
  { id: "c1", name: "Computer Science Club", members: 248, theme: "bg-blue-500" },
  { id: "c2", name: "Design & Creators", members: 143, theme: "bg-emerald-500" },
  { id: "c3", name: "First-Year Study Circle", members: 319, theme: "bg-amber-500" },
  { id: "c4", name: "Hack Nights Community", members: 97, theme: "bg-rose-500" }
];

const rooms = new Map();
const roomSockets = new Map();

function buildHistoryProfile(requests) {
  const categories = new Set();
  const tags = new Set();

  for (const request of Array.isArray(requests) ? requests : []) {
    const category = String(request?.category || "").trim();
    if (category) {
      categories.add(category);
    }
    for (const tag of Array.isArray(request?.tags) ? request.tags : []) {
      const normalized = String(tag || "").trim().toLowerCase();
      if (normalized) {
        tags.add(normalized);
      }
    }
  }

  return { categories, tags };
}

function inferLocationTagFromText(text) {
  const input = String(text || "").toLowerCase();
  if (!input) return null;

  for (const tag of LOCATION_TAGS) {
    const canonicalTag = String(tag || "").trim().toLowerCase();
    const phrase = canonicalTag.replace(/_/g, " ");
    const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const phrasePattern = new RegExp(`\\b${escapedPhrase}\\b`, "i");
    if (phrasePattern.test(input)) {
      return canonicalTag;
    }
  }

  return null;
}

function normalizeCommunityId(value) {
  const candidate = String(value || "").trim();
  if (!candidate) return "c1";
  return communities.some((community) => community.id === candidate) ? candidate : "c1";
}

function ensureRealtimeRoom({ roomId, communityId, roomName }) {
  const normalizedRoomId = String(roomId || "").trim();
  if (!normalizedRoomId) return null;

  if (rooms.has(normalizedRoomId)) {
    return rooms.get(normalizedRoomId);
  }

  const room = {
    id: normalizedRoomId,
    communityId: normalizeCommunityId(communityId),
    name: String(roomName || "Community Room").trim() || "Community Room",
    createdAt: new Date().toISOString(),
    participants: new Map(),
    messages: []
  };

  rooms.set(normalizedRoomId, room);
  sendRoomEvent("room_created", room);
  return room;
}

const app = express();
app.use((req, res, next) => {
  const requestedHeaders = req.headers["access-control-request-headers"];
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Vary", "Origin, Access-Control-Request-Headers");
  res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    requestedHeaders || "Content-Type, Authorization, x-user-id"
  );
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});
app.use(express.json());

const broadcast = (wss, message) => {
  const payload = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
};

const broadcastToRoom = (roomId, message) => {
  const sockets = roomSockets.get(roomId);
  if (!sockets) {
    return;
  }
  const payload = JSON.stringify(message);
  sockets.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
};

const addSocketToRoom = (roomId, socket) => {
  if (!roomSockets.has(roomId)) {
    roomSockets.set(roomId, new Set());
  }
  roomSockets.get(roomId).add(socket);
};

const removeSocketFromRoom = (socket) => {
  if (!socket.roomId) {
    return;
  }
  const sockets = roomSockets.get(socket.roomId);
  if (!sockets) {
    return;
  }
  sockets.delete(socket);
  if (sockets.size === 0) {
    roomSockets.delete(socket.roomId);
  }
};

const serializeRoom = (room) => ({
  id: room.id,
  communityId: room.communityId,
  name: room.name,
  createdAt: room.createdAt,
  participants: Array.from(room.participants.values()).map((participant) => ({
    id: participant.id,
    displayName: participant.displayName,
    joinedAt: participant.joinedAt
  }))
});

const serializeCommunity = (community) => {
  const activeRooms = Array.from(rooms.values()).filter(
    (room) => room.communityId === community.id
  );
  return {
    ...community,
    activeRooms: activeRooms.length,
    rooms: activeRooms.length
  };
};

app.get("/health", (_req, res) => {
  res.json({ status: "ok", ok: true, service: "intent-router-server" });
});

app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    endpoints: [
      "/health",
      "/api/options",
      "/api/classify-intent",
      "/post-request",
      "/communities",
      "/communities/:communityId/rooms",
      "/rooms",
      "/rooms/:roomId",
      "/rooms/:roomId/join",
      "/rooms/:roomId/leave",
      "/ws"
    ]
  });
});

app.get("/api/options", (_req, res) => {
  res.json({
    allowed_categories: ALLOWED_CATEGORIES,
    allowed_tags: ALLOWED_TAGS,
    allowed_modes: ALLOWED_MODES,
    location_tags: LOCATION_TAGS
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
    const communityId = normalizeCommunityId(req.body?.communityId || req.body?.community_id);
    const userId = String(req.body?.user_id || req.headers["x-user-id"] || "anonymous").trim();
    console.log("[post-request][step 1] received request", { userId, urgency, communityId });

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
    const inferredLocationTag = inferLocationTagFromText(text);
    const mergedTags = Array.from(
      new Set([...(Array.isArray(intent.tags) ? intent.tags : []), inferredLocationTag].filter(Boolean))
    );
    const resolvedLocation = inferredLocationTag || null;
    const firstTag = mergedTags?.[0] || "general";
    console.log("[post-request][step 3] classification complete", {
      category: intent.category,
      tags: mergedTags,
      inferredLocationTag,
      resolvedLocation
    });

    const newRequest = await createRequest({
      user_id: userId,
      text,
      urgency,
      location: resolvedLocation,
      status: "OPEN",
      category: intent.category,
      tags: mergedTags,
      topic_label: intent.topic_label,
      mode: intent.mode
    });
    console.log("[post-request][step 4] request saved", {
      requestId: String(newRequest._id),
      status: newRequest.status
    });

    const openCandidates = await listOpenRequestsExcludingUser(userId);
    const requesterHistoryRequests = await listUserRequests(userId, {
      excludeRequestId: String(newRequest._id),
      limit: 50
    });
    const requesterHistory = buildHistoryProfile(requesterHistoryRequests);
    console.log("[post-request][step 5] loaded open candidates", {
      count: openCandidates.length,
      historyCount: requesterHistoryRequests.length
    });
    const best = pickBestMatch(newRequest, openCandidates, { requesterHistory });

    if (best) {
      console.log("[post-request][step 6] best candidate scored", {
        candidateRequestId: String(best.candidate._id),
        score: best.score,
        reasons: best.reasons,
        score_breakdown: best.score_breakdown
      });
    } else {
      console.log("[post-request][step 6] no candidate found");
    }

    if (best && isGoodMatch(best.score)) {
      const candidateRoomId = String(
        best.candidate.topic_room_id || best.candidate.room_id || ""
      ).trim();

      let resolvedRoomId = candidateRoomId;
      let matchedIntoExistingRoom = Boolean(candidateRoomId);

      if (!resolvedRoomId) {
        const room = await createDirectRoom({
          userIds: [newRequest.user_id, best.candidate.user_id],
          requestIds: [newRequest._id, best.candidate._id],
          score: best.score,
          reasons: best.reasons
        });
        resolvedRoomId = String(room._id);
        matchedIntoExistingRoom = false;
      }

      ensureRealtimeRoom({
        roomId: resolvedRoomId,
        communityId,
        roomName: intent.topic_label
      });

      await markRequestsMatched([newRequest._id, best.candidate._id], resolvedRoomId);
      console.log("[post-request][step 7] direct match created", {
        roomId: resolvedRoomId,
        score: best.score,
        matchedIntoExistingRoom
      });

      return res.json({
        room_id: resolvedRoomId,
        score: best.score,
        reasons: best.reasons,
        score_breakdown: best.score_breakdown,
        match_status: "matched",
        matched_existing_room: matchedIntoExistingRoom,
        is_creator: false,
        message: matchedIntoExistingRoom
          ? "Matched with an existing request. You are assigned to their room."
          : "Matched successfully. A room is ready."
      });
    }

    const topicRoom = await findOrCreateTopicRoom({
      category: intent.category,
      firstTag,
      userId
    });
    await attachRequestToRoom(newRequest._id, topicRoom._id);
    ensureRealtimeRoom({
      roomId: topicRoom._id,
      communityId,
      roomName: intent.topic_label
    });

    const isCreator = Boolean(topicRoom.created);
    console.log("[post-request][step 7] topic room assigned", {
      roomId: String(topicRoom._id),
      category: intent.category,
      firstTag,
      isCreator
    });

    return res.json({
      room_id: String(topicRoom._id),
      match_status: "waiting",
      matched_existing_room: false,
      is_creator: isCreator,
      message: isCreator
        ? "No match found yet. You created this room and are now waiting for peers."
        : "No direct match yet. You were added to an existing room waiting for peers."
    });
  } catch (error) {
    console.error("post-request error", error);
    return res.status(500).json({ error: "Post request failed" });
  }
});

app.get("/communities", (_req, res) => {
  res.json({ communities: communities.map(serializeCommunity) });
});

app.get("/communities/:communityId/rooms", (req, res) => {
  const { communityId } = req.params;
  const community = communities.find((item) => item.id === communityId);
  if (!community) {
    return res.status(404).json({ error: "Community not found" });
  }

  const communityRooms = Array.from(rooms.values())
    .filter((room) => room.communityId === communityId)
    .map(serializeRoom);

  return res.json({ rooms: communityRooms });
});

app.post("/rooms", (req, res) => {
  const { communityId, name } = req.body || {};
  const community = communities.find((item) => item.id === communityId);
  if (!community) {
    return res.status(400).json({ error: "Invalid communityId" });
  }

  const roomId = crypto.randomUUID();
  const room = {
    id: roomId,
    communityId,
    name: typeof name === "string" && name.trim() ? name.trim() : "New Room",
    createdAt: new Date().toISOString(),
    participants: new Map(),
    messages: []
  };

  rooms.set(roomId, room);
  sendRoomEvent("room_created", room);
  return res.status(201).json({ room: serializeRoom(room) });
});

app.get("/rooms/:roomId", (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (!room) {
    return res.status(404).json({ error: "Room not found" });
  }

  return res.json({ room: serializeRoom(room) });
});

app.post("/rooms/:roomId/join", (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (!room) {
    return res.status(404).json({ error: "Room not found" });
  }

  const displayName =
    typeof req.body?.displayName === "string" && req.body.displayName.trim()
      ? req.body.displayName.trim()
      : "Guest";

  const participantId = crypto.randomUUID();
  const participant = {
    id: participantId,
    displayName,
    joinedAt: new Date().toISOString()
  };

  room.participants.set(participantId, participant);
  sendRoomEvent("room_updated", room);
  return res.status(201).json({ participant, room: serializeRoom(room) });
});

app.post("/rooms/:roomId/leave", (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (!room) {
    return res.status(404).json({ error: "Room not found" });
  }

  const { participantId } = req.body || {};
  if (!participantId || !room.participants.has(participantId)) {
    return res.status(400).json({ error: "Invalid participantId" });
  }

  room.participants.delete(participantId);
  if (room.participants.size === 0) {
    rooms.delete(room.id);
    sendRoomDeletedEvent(room.id);
    if (roomSockets.has(room.id)) {
      roomSockets.delete(room.id);
    }
    return res.json({ roomDeleted: true });
  }

  sendRoomEvent("room_updated", room);
  return res.json({ roomDeleted: false, room: serializeRoom(room) });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (socket) => {
  const snapshot = {
    type: "snapshot",
    communities: communities.map(serializeCommunity),
    rooms: Array.from(rooms.values()).map(serializeRoom)
  };
  socket.send(JSON.stringify(snapshot));

  socket.on("message", (raw) => {
    let payload;
    try {
      payload = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (payload?.type === "join_room") {
      const room = rooms.get(payload.roomId);
      if (!room) {
        return;
      }
      socket.roomId = payload.roomId;
      socket.participantId = payload.participantId || "";
      socket.displayName = payload.displayName || "Guest";
      addSocketToRoom(payload.roomId, socket);
      socket.send(
        JSON.stringify({
          type: "room_history",
          roomId: payload.roomId,
          messages: room.messages
        })
      );
      return;
    }

    if (payload?.type === "leave_room") {
      removeSocketFromRoom(socket);
      socket.roomId = "";
      return;
    }

    if (payload?.type === "chat_message") {
      const roomId = socket.roomId || payload.roomId;
      const room = rooms.get(roomId);
      if (!room) {
        return;
      }
      const text = typeof payload.text === "string" ? payload.text.trim() : "";
      if (!text) {
        return;
      }
      const message = {
        id: crypto.randomUUID(),
        roomId,
        senderId: socket.participantId || "guest",
        senderName: socket.displayName || "Guest",
        text,
        createdAt: new Date().toISOString()
      };
      room.messages.push(message);
      if (room.messages.length > 200) {
        room.messages = room.messages.slice(-200);
      }
      broadcastToRoom(roomId, { type: "chat_message", message });
    }
  });

  socket.on("close", () => {
    removeSocketFromRoom(socket);
  });
});

const sendRoomEvent = (type, room) => {
  broadcast(wss, { type, room: serializeRoom(room) });
};

const sendRoomDeletedEvent = (roomId) => {
  broadcast(wss, { type: "room_deleted", roomId });
};

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`WebSocket available at ws://localhost:${PORT}/ws`);
});
