# Build 004B — local review, 24 October 2026

Implemented locally. Nothing pushed, uploaded or deployed. Existing Worker `ludi`, `LudiRoom` binding, routing domain, compatibility date and migration configuration are unchanged.

## Confirmed failure paths

Code inspection confirmed these defects; these are reproducible paths, not a claim that production logs identify every reported interruption:

- Every socket closure scheduled removal/forfeit after 30 seconds. Restoring a Durable Object also started the same short removal timer for every saved member. A suspended phone, refresh or network outage could permanently lose its seat.
- Create routing chose a new random room code on every attempt. Create/join credentials existed only in the first server reply. Losing that reply stranded a reserved seat; retrying could create a second room or player.
- Resume rejected any member with an existing socket, including a half-open connection left by Safari suspension. It provided one ambiguous error for missing rooms, invalid credentials and an occupied socket.
- The client advertised connection success at WebSocket open, before resume acceptance. It cleared the presented board on closure, had fixed retries without offline/lifecycle handling, and guarded callbacks only by effect lifetime rather than socket identity.
- Client recovery data lived only in sessionStorage. There was no explicit saved-session recovery control on a fresh tab.

Existing gameplay snapshots and match/revision checks already provided useful persistence and duplicate-action protection. They were retained and strengthened around connection ownership rather than replacing the engine.

## Identity and transactional entry

Room UUID, player UUID and the server-generated 192-bit private resume token remain stable. Tokens and operation IDs are stored only in the private member snapshot, never the public Room broadcast. A code/name alone cannot resume a seat.

Before sending create/join, the client saves a cryptographically random operation UUID. Worker create routing hashes that UUID to the existing six-character code format; the authoritative room records the private operation-to-member association. Replays return the same player and credential. Initial state/credential acknowledgement precedes ordinary broadcasts. A code collision fails rather than overwriting an existing room.

A private persisted retired-operation set prevents replay of a closed/left operation from silently recreating its room. New operations can still create new rooms. This field is additive.

Valid credentials deliberately transfer ownership to the new connection. The former socket is closed with application code 4001, and its browser stops automatic recovery. Both server action handling and close callbacks verify current socket ownership. An old connection cannot act or mark the replacement disconnected. The displaced tab can explicitly Retry to reclaim ownership.

## Reconnection and UI

Connected means an authoritative state was received, not merely that transport opened. Recovery uses one socket/retry loop, socket identity guards, a 15-second initial connection timeout, exponential delay capped at 30 seconds with jitter, and application heartbeat detection of silent connections. Offline browsers wait for connectivity; online, pageshow and visibilitychange events prompt recovery. Board state remains visible and actions remain disabled until a new snapshot arrives.

A compact connection strip provides status, stale-board wording, Retry and Return to Lobby. Credentials and pending operations survive reload in localStorage with sessionStorage compatibility. Reopening offers Resume Game; it never creates a replacement room after a failed resume. Explicit leave clears local recovery intent and returns to a fresh lobby transport. If the browser is offline, the server cannot receive a leave command: its reserved seat remains until room expiry or a later server-side departure.

Missing/expired rooms and invalid credentials produce distinct actionable errors and stop automatic retries. A displaced session explains that its seat is connected elsewhere. Temporary server failures preserve saved recovery information.

## Persistence, expiry and rules

Every meaningful published transition persists the full existing authoritative snapshot: rules, identities, seats, game mode, turns, dice/movement, War banks, prepared inventory, restrictions, hazards, results and rematch readiness. Entry/resume persistence occurs before its acknowledgement. The existing storage output gate remains enabled; outgoing state depends on successful storage writes.

A single disconnected human retains their seat for as long as another human remains connected. When all humans disconnect, a persisted `expiresAt` starts a 30-minute room recovery window. Rejoining clears the expiry. A Durable Object alarm enforces expiry even when the process is absent; local timers also enforce it in the Node development adapter. Expiry removes room members and their credentials together. Explicit leave retains the existing forfeit/host-transfer rules. Leaving the last connected seat also schedules recovery for any remaining offline humans.

Untimed human turns hold normally; there is no automatic AI takeover. Existing explicit turn timers/house rules remain in force. Board/game revision and match checks reject duplicate rolls, movement and skill operations before dice generation, charging or state mutation. No gameplay-engine, War economy, dice-generation or AI code changed.

The existing standard WebSocket adapter is retained; this build does not switch to hibernating sockets. Runtime restarts close transports, restore storage and let clients reclaim seats. See Cloudflare's [WebSocket lifecycle documentation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/) and [storage/output gate documentation](https://developers.cloudflare.com/durable-objects/api/legacy-kv-storage-api/).

## Verification

- `npm test`: 58/58 passed, including complete Heritage/War matches, rematches, AI/rules regressions, the 30-minute all-human retention boundary, and legacy snapshot restoration.
- `npm run test:recovery`: passed using isolated Wrangler/workerd, SQLite persistence and real Worker-to-Durable Object WebSockets. It verifies interrupted create/join before consuming initial state; same-operation retries; private credential isolation; impersonation rejection; valid new-tab transfer; host/guest refresh; duplicate roll/purchase rejection; complete Heritage and War matches; rematches; deleted rooms; and retired-operation replay rejection.
- That suite stops and restarts the entire local runtime with the same SQLite files during a War preparation window. Both seats, game state, bank, prepared skill, phase and hazards restore exactly. Reclaiming during skill targeting preserves the authoritative legal target set.
- Real Chromium checks passed against the running built app: create through the form, join/start, offline board preservation and disabled rolls, online recovery, reload/Resume Game, new-tab takeover without reconnect fighting, and returning from an interrupted session to create another table. No page errors. Desktop and 390 × 844 screenshots are alongside this report.
- `npm run build`: TypeScript and production Vite build passed. Existing Lucide `use client` bundling warnings remain non-fatal.
- `wrangler deploy --dry-run`: passed with the existing local bindings; no deployment performed.
- `git diff --check`: passed.

## Compatibility and remaining risks

No Durable Object namespace migration is required. Existing `room` and `code` keys, room UUIDs, player IDs, tokens and legacy create/join commands remain supported. New snapshot fields are optional. Existing saved rooms receive the longer recovery policy on load. Already removed 004A seats cannot be reconstructed. Older cached clients retain their older recovery UX until refreshed; updating code can close sockets, so the new client must be loaded for the full recovery behaviour.

Local workerd tests cover production runtime APIs, but do not prove real Cloudflare edge routing, live eviction, or physical Safari suspension. Physical iPhone/Safari testing is still required during review. The 30-minute boundary was tested with a controlled clock; no live edge room was left for 30 minutes. Browser lifecycle listeners were exercised via actual offline/reload/tab operations in Chromium, not a physical Safari process kill. A user who clears browser storage loses their private recovery credential. Retired operations are kept in room storage; long-term storage compaction is outside this focused fix.

## Local review

The local review server is available at http://127.0.0.1:8787 while its Wrangler process remains running. To start it again:

```sh
npm run build
npx wrangler dev --local --port 8787 --persist-to .wrangler/build-004b-review
```

Use separate browser profiles/devices for separate players; tabs in one profile share the saved identity. Create/join, ready everyone and start. Disable networking, verify the board remains with actions disabled, then restore networking. Reload each player and choose Resume Game. Open another tab in the same profile and choose Resume Game to transfer its seat; the old tab should explain the transfer and stop retrying. Leave all players disconnected briefly, then resume them.

Run the isolated persistence/recovery suite separately:

```sh
npm test
npm run test:recovery
```

Optional reproducible browser verification is `node tests/browser-recovery.mjs` against the local review server. It requires an existing Playwright installation and Chromium; `LUDI_PLAYWRIGHT_MODULE` may point to that installation's `index.mjs`, and `LUDI_CHROMIUM_EXECUTABLE` may select an installed Chromium. No new browser dependency was added to this project.

Production deployment and Git push require the user's approval of this completed local build.
