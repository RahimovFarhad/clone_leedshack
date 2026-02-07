# Combined Server (Rooms + Intent Router)

This repo now hosts both backends in one process:
- Community/room REST + WebSocket APIs
- Intent classification + matchmaking APIs

## Run

1. `cd /Users/farhadrahimov/programming/projects (with team)/LEEDSHACK26/server`
2. `npm install`
3. `cp .env.example .env`
4. Update `.env` values if needed
5. `npm run dev`

Default base URL: `http://localhost:4000`

## Endpoints

### Core
- `GET /health`
- `GET /`

### Intent router
- `GET /api/options`
- `POST /api/classify-intent`
- `POST /post-request`

### Communities / rooms
- `GET /communities`
- `GET /communities/:communityId/rooms`
- `POST /rooms`
- `GET /rooms/:roomId`
- `POST /rooms/:roomId/join`
- `POST /rooms/:roomId/leave`

### WebSocket
- `WS /ws`

## Notes

- Room/community data is in-memory and resets on restart.
- Matchmaking storage uses MongoDB when configured; otherwise it falls back to in-memory.
