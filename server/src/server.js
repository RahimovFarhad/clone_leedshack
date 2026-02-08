import "dotenv/config";
import http from "node:http";
import crypto from "node:crypto";
import express from "express";
import WebSocket, { WebSocketServer } from "ws";
import { classifyIntent } from "./agent.js";
import { ALLOWED_CATEGORIES, ALLOWED_TAGS, ALLOWED_MODES, LOCATION_TAGS } from "./config.js";
import { getCommunityByIdStore, listCommunitiesStore } from "./community-store.js";
import {
  attachRequestToRoom,
  createRequest,
  findOrCreateTopicRoom,
  listOpenRequestsExcludingUser,
  listUserRequests
} from "./store.js";
import { computeCandidateScore, isGoodMatch } from "./matchmaking.js";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

const rooms = new Map();
const roomSockets = new Map();
const roomReports = new Map();

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

function inferLocationTagsFromText(text) {
  const input = String(text || "").toLowerCase();
  if (!input) return [];

  for (const tag of LOCATION_TAGS) {
    const canonicalTag = String(tag || "").trim().toLowerCase();
    const phrase = canonicalTag.replace(/_/g, " ");
    const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const phrasePattern = new RegExp(`\\b${escapedPhrase}\\b`, "i");
    if (phrasePattern.test(input)) {
      const relatedCountry = CITY_TO_COUNTRY_TAG[canonicalTag];
      return Array.from(new Set([canonicalTag, relatedCountry].filter(Boolean)));
    }
  }

  return [];
}

function ensureRealtimeRoom({ roomId, communityId, roomName }) {
  const normalizedRoomId = String(roomId || "").trim();
  if (!normalizedRoomId) return null;

  if (rooms.has(normalizedRoomId)) {
    return rooms.get(normalizedRoomId);
  }

  const room = {
    id: normalizedRoomId,
    communityId: String(communityId || "unassigned"),
    name: String(roomName || "Community Room").trim() || "Community Room",
    createdAt: new Date().toISOString(),
    participants: new Map(),
    messages: []
  };

  rooms.set(normalizedRoomId, room);
  sendRoomEvent("room_created", room);
  return room;
}

function scoreToPercentage(score) {
  const maxScore = 105;
  const normalized = (Number(score || 0) / maxScore) * 100;
  return Math.max(0, Math.min(99, Math.round(normalized)));
}

const CITY_TO_COUNTRY_TAG = {
  edinburgh: "united_kingdom",
  london: "united_kingdom",
  glasgow: "united_kingdom",
  manchester: "united_kingdom",
  bristol: "united_kingdom",
  leeds: "united_kingdom",
  liverpool: "united_kingdom",
  new_york: "united_states",
  los_angeles: "united_states",
  chicago: "united_states",
  texas: "united_states"
};

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

const getSerializedCommunities = async () =>
  (await listCommunitiesStore()).map((community) =>
    serializeCommunity({
      id: String(community.id),
      name: String(community.name),
      members: Number(community.members),
      theme: String(community.theme)
    })
  );

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
      "/rooms/:roomId/report",
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
    const communityId = String(req.body?.communityId || req.body?.community_id || "").trim();
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
    if (!communityId || !(await getCommunityByIdStore(communityId))) {
      return res.status(400).json({ error: "'communityId' is required and must be valid" });
    }

    console.log("[post-request][step 2] classifying intent");
    const intent = await classifyIntent(text);
    const inferredLocationTags = inferLocationTagsFromText(text);
    const mergedTags = Array.from(
      new Set([...(Array.isArray(intent.tags) ? intent.tags : []), ...inferredLocationTags].filter(Boolean))
    );
    const resolvedLocation = inferredLocationTags[0] || null;
    const firstTag = [...mergedTags].sort((a, b) => a.localeCompare(b))[0] || "general";
    console.log("[post-request][step 3] classification complete", {
      category: intent.category,
      tags: mergedTags,
      inferredLocationTags,
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
    const rankedCandidates = openCandidates
      .map((candidate) => ({
        candidate,
        ...computeCandidateScore(newRequest, candidate, { requesterHistory })
      }))
      .sort((a, b) => b.score - a.score);

    if (rankedCandidates.length > 0) {
      const best = rankedCandidates[0];
      console.log("[post-request][step 6] best candidate scored", {
        candidateRequestId: String(best.candidate._id),
        score: best.score,
        reasons: best.reasons,
        score_breakdown: best.score_breakdown
      });
    } else {
      console.log("[post-request][step 6] no candidate found");
    }

    const candidateRoomById = new Map();

    for (const entry of rankedCandidates) {
        const roomId = String(entry.candidate.topic_room_id || entry.candidate.room_id || "").trim();
        if (!roomId) continue;

        const realtimeRoom = ensureRealtimeRoom({
          roomId,
          communityId,
          roomName: String(entry.candidate.topic_label || intent.topic_label || "Community Room")
        });

        const option = {
          room_id: roomId,
          room_title: String(
            realtimeRoom?.name ||
            entry.candidate.topic_label ||
            intent.topic_label ||
            "Community Room"
          ),
          request_id: String(entry.candidate._id),
          score: entry.score,
          percentage: scoreToPercentage(entry.score),
          qualifies: isGoodMatch(entry.score),
          recommended: false,
          reasons: entry.reasons,
          score_breakdown: entry.score_breakdown
        };

        const existing = candidateRoomById.get(roomId);
        if (!existing || option.score > existing.score) {
          candidateRoomById.set(roomId, option);
        }
    }

    const candidateRooms = [...candidateRoomById.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    if (candidateRooms.length > 0) {
      candidateRooms[0].recommended = true;
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
    const qualifyingRooms = candidateRooms.filter((room) => room.qualifies);
    const closestRoom = candidateRooms.length > 0 ? candidateRooms[0] : null;
    console.log("[post-request][step 7] topic room assigned", {
      roomId: String(topicRoom._id),
      category: intent.category,
      firstTag,
      isCreator,
      qualifyingCount: qualifyingRooms.length
    });

    if (qualifyingRooms.length > 0) {
      return res.json({
        room_id: String(qualifyingRooms[0].room_id),
        waiting_room_id: String(topicRoom._id),
        match_status: "candidates",
        has_qualifying_match: true,
        is_creator: isCreator,
        candidate_rooms: qualifyingRooms,
        closest_room: qualifyingRooms[0],
        message:
          "Found qualifying rooms. Best option is marked as recommended, but you can choose any."
      });
    }

    return res.json({
      room_id: String(topicRoom._id),
      waiting_room_id: String(topicRoom._id),
      match_status: "waiting",
      has_qualifying_match: false,
      matched_existing_room: false,
      is_creator: isCreator,
      candidate_rooms: [],
      closest_room: closestRoom,
      message: closestRoom
        ? "No qualifying match found. We created a room for you, and included the closest option."
        : isCreator
          ? "No match found yet. We created a room for you and you're now waiting for someone to join."
          : "No direct match yet. You were added to a waiting room."
    });
  } catch (error) {
    console.error("post-request error", error);
    return res.status(500).json({ error: "Post request failed" });
  }
});

app.get("/communities", async (_req, res) => {
  res.json({ communities: await getSerializedCommunities() });
});

app.get("/communities/:communityId/rooms", async (req, res) => {
  const { communityId } = req.params;
  if (!(await getCommunityByIdStore(communityId))) {
    return res.status(404).json({ error: "Community not found" });
  }

  const communityRooms = Array.from(rooms.values())
    .filter((room) => room.communityId === communityId)
    .map(serializeRoom);

  return res.json({ rooms: communityRooms });
});

app.post("/rooms", async (req, res) => {
  const { communityId, name } = req.body || {};
  if (!(await getCommunityByIdStore(communityId))) {
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

  const requestedDisplayName =
    typeof req.body?.displayName === "string" && req.body.displayName.trim()
      ? req.body.displayName.trim()
      : "Guest";

  const participantId = crypto.randomUUID();
  const isAnonymous = /^anonymous$/i.test(requestedDisplayName);
  const displayName = isAnonymous
    ? `Anonymous-${participantId.slice(0, 4).toUpperCase()}`
    : requestedDisplayName;
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
    roomReports.delete(room.id);
    sendRoomDeletedEvent(room.id);
    if (roomSockets.has(room.id)) {
      roomSockets.delete(room.id);
    }
    return res.json({ roomDeleted: true });
  }

  sendRoomEvent("room_updated", room);
  return res.json({ roomDeleted: false, room: serializeRoom(room) });
});

app.post("/rooms/:roomId/report", (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (!room) {
    return res.status(404).json({ error: "Room not found" });
  }

  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  const details = typeof req.body?.details === "string" ? req.body.details.trim() : "";
  const participantId =
    typeof req.body?.participantId === "string" ? req.body.participantId.trim() : "";

  if (!reason) {
    return res.status(400).json({ error: "'reason' is required" });
  }

  const report = {
    id: crypto.randomUUID(),
    roomId: room.id,
    participantId: participantId || null,
    reason,
    details: details || null,
    createdAt: new Date().toISOString()
  };

  if (!roomReports.has(room.id)) {
    roomReports.set(room.id, []);
  }
  roomReports.get(room.id).push(report);

  return res.status(201).json({ ok: true, report });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", async (socket) => {
  const snapshot = {
    type: "snapshot",
    communities: await getSerializedCommunities(),
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
