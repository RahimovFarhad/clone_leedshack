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

## Database

- Default backend flow storage is SQLite (`DB_PROVIDER=sqlite`) at `data/data.db`.
- Initialize/upgrade schema: `npm run db:init`
- Clear all persisted data: `npm run db:clear`
- Insert sample users (translated from your Python script): `npm run db:seed:users`
- Seed communities for frontend: `npm run db:seed:communities`
- Optional providers:
  - `DB_PROVIDER=mongo` (uses `MONGODB_URI`)
  - `DB_PROVIDER=memory` (in-memory only)

## Endpoints

### Core
- `GET /health`
- `GET /`

### Intent router
- `GET /api/options`
- `POST /api/classify-intent`
- `POST /post-request`
  - Response now includes:
    - `match_status`: `matched`, `candidates`, or `waiting`
    - `is_creator`: `true` when user created a new waiting room
    - `matched_existing_room`: `true` when assigned into requester's existing room
    - `message`: user-facing status text

### Communities / rooms
- `GET /communities`
- `GET /communities/:communityId/rooms`
- `POST /rooms`
- `GET /rooms/:roomId`
- `POST /rooms/:roomId/join`
- `POST /rooms/:roomId/leave`
- `POST /admin/reset-data` (optional `x-admin-token` header if `ADMIN_RESET_TOKEN` is set)

### WebSocket
- `WS /ws`

## Notes

- Room/community data is in-memory and resets on restart.
- Matchmaking/request persistence uses the configured DB provider (SQLite by default).
- `POST /post-request` derives location from request text only when a clear location phrase is detected, and returns `score_breakdown` for direct matches.
- `POST /post-request` now returns ranked room options:
  - `candidate_rooms`: qualifying rooms with `percentage` and `recommended`
  - `match_status`: `matched` when qualifying rooms exist, `candidates` when only nearby rooms exist, otherwise `waiting`
  - `closest_room`: returned when no qualifying room exists
