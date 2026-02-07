const http = require('http');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

const communities = [
  { id: 'c1', name: 'Computer Science Club', members: 248, theme: 'bg-blue-500' },
  { id: 'c2', name: 'Design & Creators', members: 143, theme: 'bg-emerald-500' },
  { id: 'c3', name: 'First-Year Study Circle', members: 319, theme: 'bg-amber-500' },
  { id: 'c4', name: 'Hack Nights Community', members: 97, theme: 'bg-rose-500' },
];

const rooms = new Map();

const app = express();
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});
app.use(cors());
app.use(express.json());

const broadcast = (wss, message) => {
  const payload = JSON.stringify(message);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
};

const serializeRoom = room => ({
  id: room.id,
  communityId: room.communityId,
  name: room.name,
  createdAt: room.createdAt,
  participants: Array.from(room.participants.values()).map(participant => ({
    id: participant.id,
    displayName: participant.displayName,
    joinedAt: participant.joinedAt,
  })),
});

const serializeCommunity = community => {
  const activeRooms = Array.from(rooms.values()).filter(
    room => room.communityId === community.id
  );
  return {
    ...community,
    activeRooms: activeRooms.length,
    rooms: activeRooms.length,
  };
};

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    endpoints: [
      '/health',
      '/communities',
      '/communities/:communityId/rooms',
      '/rooms',
      '/rooms/:roomId',
      '/rooms/:roomId/join',
      '/rooms/:roomId/leave',
      '/ws',
    ],
  });
});

app.get('/communities', (req, res) => {
  res.json({ communities: communities.map(serializeCommunity) });
});

app.get('/communities/:communityId/rooms', (req, res) => {
  const { communityId } = req.params;
  const community = communities.find(item => item.id === communityId);
  if (!community) {
    return res.status(404).json({ error: 'Community not found' });
  }

  const communityRooms = Array.from(rooms.values())
    .filter(room => room.communityId === communityId)
    .map(serializeRoom);

  res.json({ rooms: communityRooms });
});

app.post('/rooms', (req, res) => {
  const { communityId, name } = req.body || {};
  const community = communities.find(item => item.id === communityId);
  if (!community) {
    return res.status(400).json({ error: 'Invalid communityId' });
  }

  const roomId = crypto.randomUUID();
  const room = {
    id: roomId,
    communityId,
    name: typeof name === 'string' && name.trim() ? name.trim() : 'New Room',
    createdAt: new Date().toISOString(),
    participants: new Map(),
  };

  rooms.set(roomId, room);
  const payload = { room: serializeRoom(room) };
  sendRoomEvent('room_created', room);
  res.status(201).json(payload);
});

app.get('/rooms/:roomId', (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  res.json({ room: serializeRoom(room) });
});

app.post('/rooms/:roomId/join', (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  const displayName =
    typeof req.body?.displayName === 'string' && req.body.displayName.trim()
      ? req.body.displayName.trim()
      : 'Guest';

  const participantId = crypto.randomUUID();
  const participant = {
    id: participantId,
    displayName,
    joinedAt: new Date().toISOString(),
  };

  room.participants.set(participantId, participant);
  const payload = { participant, room: serializeRoom(room) };
  sendRoomEvent('room_updated', room);
  res.status(201).json(payload);
});

app.post('/rooms/:roomId/leave', (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  const { participantId } = req.body || {};
  if (!participantId || !room.participants.has(participantId)) {
    return res.status(400).json({ error: 'Invalid participantId' });
  }

  room.participants.delete(participantId);
  if (room.participants.size === 0) {
    rooms.delete(room.id);
    sendRoomDeletedEvent(room.id);
    return res.json({ roomDeleted: true });
  }

  sendRoomEvent('room_updated', room);
  res.json({ roomDeleted: false, room: serializeRoom(room) });
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

wss.on('connection', socket => {
  const snapshot = {
    type: 'snapshot',
    communities: communities.map(serializeCommunity),
    rooms: Array.from(rooms.values()).map(serializeRoom),
  };
  socket.send(JSON.stringify(snapshot));
});

const sendRoomEvent = (type, room) => {
  broadcast(wss, { type, room: serializeRoom(room) });
};

const sendRoomDeletedEvent = roomId => {
  broadcast(wss, { type: 'room_deleted', roomId });
};

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`WebSocket available at ws://localhost:${PORT}/ws`);
});
