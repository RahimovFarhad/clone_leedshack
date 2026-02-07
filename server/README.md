# Intent Router Server

This server provides REST and WebSocket endpoints for communities, rooms, and participants.

## Base URL

- http://localhost:4000

## REST Endpoints

### GET /health

Simple liveness check.

Response:
```json
{ "status": "ok" }
```

### GET /

Lists available endpoints.

Response:
```json
{
  "status": "ok",
  "endpoints": [
    "/health",
    "/communities",
    "/communities/:communityId/rooms",
    "/rooms",
    "/rooms/:roomId",
    "/rooms/:roomId/join",
    "/rooms/:roomId/leave",
    "/ws"
  ]
}
```

### GET /communities

Returns the fixed demo communities and current active room counts.

Response:
```json
{
  "communities": [
    {
      "id": "c1",
      "name": "Computer Science Club",
      "members": 248,
      "theme": "bg-blue-500",
      "activeRooms": 0,
      "rooms": 0
    }
  ]
}
```

### GET /communities/:communityId/rooms

Lists rooms for a community.

Response:
```json
{
  "rooms": [
    {
      "id": "room-id",
      "communityId": "c1",
      "name": "Study Room A",
      "createdAt": "2026-02-07T00:00:00.000Z",
      "participants": [
        {
          "id": "participant-id",
          "displayName": "Guest",
          "joinedAt": "2026-02-07T00:00:00.000Z"
        }
      ]
    }
  ]
}
```

### POST /rooms

Create a room in a community.

Request body:
```json
{ "communityId": "c1", "name": "Study Room A" }
```

Response:
```json
{ "room": { "id": "room-id", "communityId": "c1", "name": "Study Room A", "createdAt": "...", "participants": [] } }
```

### GET /rooms/:roomId

Get details for a specific room.

Response:
```json
{ "room": { "id": "room-id", "communityId": "c1", "name": "Study Room A", "createdAt": "...", "participants": [] } }
```

### POST /rooms/:roomId/join

Join a room as a participant (no auth required).

Request body (optional displayName):
```json
{ "displayName": "Guest 1" }
```

Response:
```json
{
  "participant": { "id": "participant-id", "displayName": "Guest 1", "joinedAt": "..." },
  "room": { "id": "room-id", "communityId": "c1", "name": "Study Room A", "createdAt": "...", "participants": [ { "id": "participant-id", "displayName": "Guest 1", "joinedAt": "..." } ] }
}
```

### POST /rooms/:roomId/leave

Leave a room. If the last participant leaves, the room is deleted.

Request body:
```json
{ "participantId": "participant-id" }
```

Response when room still exists:
```json
{ "roomDeleted": false, "room": { "id": "room-id", "communityId": "c1", "name": "Study Room A", "createdAt": "...", "participants": [] } }
```

Response when room is deleted:
```json
{ "roomDeleted": true }
```

## WebSocket

### WS /ws

Connect to receive real-time updates.

Message types:
- `snapshot`: sent on connect, includes all communities and rooms
- `room_created`: sent when a room is created
- `room_updated`: sent when participants join/leave
- `room_deleted`: sent when a room reaches zero participants

Example snapshot:
```json
{
  "type": "snapshot",
  "communities": [ { "id": "c1", "name": "Computer Science Club", "members": 248, "theme": "bg-blue-500", "activeRooms": 1, "rooms": 1 } ],
  "rooms": [ { "id": "room-id", "communityId": "c1", "name": "Study Room A", "createdAt": "...", "participants": [] } ]
}
```

## Notes

- Data is stored in memory only. Rooms reset on server restart.
- Rooms are deleted automatically when the last participant leaves.
