# Heritage architecture

- `packages/game-engine`: pure deterministic setup, dice allocation, legal moves, entry, capture, blocks, home, bonuses, turns, timeouts, forfeits, victory and a legal-action AI scorer. No browser, React, storage, network, clock or random APIs.
- `packages/rules`: versioned configuration, reference presets, validation, compatibility checks and serialization.
- `packages/board`: stable provisional geometry. React SVG and `BoardPieces` map engine progress to these coordinates; they never decide legality.
- `packages/shared`: typed room/player snapshots and commands/replies, including authoritative game state and deadlines.
- `apps/server`: Node HTTP health endpoint and WebSocket room/game authority, crypto dice, AI scheduling, turn timers, membership, readiness, host-only locked configuration, reconnect grace, cleanup and rematch voting.
- `apps/web`: explicit viewport-sized game screens. `useLocalMatch` supplies local dice, timers and computer turns. `useLobby` connects lazily for online play. `GameTable` offers only engine-generated actions; Results comes from actual completion.

## State and authority

Local and online call the same engine. Local games need no WebSocket connection. The local controller supplies Web Crypto dice; the server supplies Node crypto dice. No client-supplied dice, movement distance or outcome is accepted online. A move command carries its generated move ID and expected match/revision; the server regenerates legal moves and rejects stale/out-of-turn/illegal actions. Server game snapshots are broadcast to every member.

The Rules Studio edits a draft. Only validated, acknowledged host updates become shared room rules. Local setup retains names and assigned colours while visiting Rules. Active matches are immutable configurations. First-player selection rotates on rematches; turn order follows colours clockwise on the fixed board.

Online rematches require every human at a full, connected table to agree. The host can instead return a completed table to the lobby. Transient disconnects reserve membership for 30 seconds. SessionStorage holds only an opaque server-issued resume credential; it does not own membership or game state. Explicit leave or expiry forfeits a racer. The last remaining racer can win by forfeit. Memory-only rooms disappear when the last human leaves/expires or the server restarts.

## Interface and lifecycle

The shell uses 100dvh, safe-area padding, bounded grid tracks and square board sizing. Commands are left of the board on desktop and beneath it on mobile. Secondary move lists, rules and setup panels may scroll internally. Primary game controls and the board fit the viewport. Modal menus/confirmations trap focus and make background controls inert.

Local pause, rules and settings screens suspend AI and preserve remaining turn time. Online menus are personal overlays: the authoritative match/clock continues. Timers cover a whole turn including bonus rolls, and retain legal moves already completed on expiry. Results only appears for an engine-determined winner. Local games are not persisted across page reloads.

The inspector is lazy-loaded only when both DEV and VITE_ENABLE_INSPECTOR=true. Production removes the import even if that flag is set. JSON/coordinates/stack/reset controls remain outside the player interface.

No event-sourcing infrastructure, accounts, Supabase integration, matchmaking or external AI dependencies were added. Before a public deployment, add TLS, a deliberate room-instance ownership strategy and operational connection/rate controls; the current launch is a local development service.

## Build 002A presentation

`packages/presentation` reads consecutive confirmed engine snapshots and derives a presentation plan: dice, selection, route travel, landing, capture/block/home resolution and turn announcement. `packages/board/layout` supplies the same track/home/yard coordinates to static counters and travel paths. Neither module decides legal actions or mutates authority. Only moving counters receive native SVG route animation; stationary counters retain their positions until resolution. Captures show a fading mark at the landing and a pulse in the returned counter's yard.

`PresentationQueue` accepts every online snapshot before React batching. Input requires the queue to be idle at exactly the authoritative match/revision/roster. Results waits for final resolution. The queue serialises animations, accelerates short backlogs and resets to the latest confirmed state on gaps, overflow, reconnect or hidden screens. It never commits a move. Pause preserves the remaining local presentation phase and freezes SVG motion; reconnect cancels old callbacks and does not replay obsolete moves.

Computer Pace is a per-device localStorage preference, separate from rules and protocol: Quick, Normal (default), Relaxed. Local computers wait for presentation readiness and the selected thinking interval before submitting one engine action. Online computer scheduling and deadlines remain server-owned; pace changes only each client's display. Local human decision clocks exclude presentation time, computer turns and pause, so decorative delays cannot spend a human's turn. Online clocks continue independently of client presentation.

Reduced-motion preference removes travel while preserving dice, landing, outcome and turn feedback. Central audio plays optional dice/landing/capture/home cues after a user gesture; mute is persistent. Sound and animation never determine outcomes.

## Build 003 War

The optional locked rules `mode` selects Heritage or War. `Game.war` is absent for Heritage and contains versioned bank, per-skill purchase counts, normal-turn rotation, effects and deterministic hazard forecasts for War. `packages/war` extends the existing movement engine through roll/move/normal-turn hooks. The single additional network command, `skill`, carries only a generated action ID and expected match/revision; server and local runtime call the same validator. No client-supplied balances, targets, outcomes or hazards are accepted. See war.md for the chosen interaction semantics.

## Build 003A / 003B clarity and interaction

War communication uses authoritative event records with monotonically increasing sequence numbers, severity, topic and originating round. The engine retains 100 recent records for a War match. Heritage retains its original event format and limits. Additional events describe confirmed bank changes, skill-window changes, defensive negations, penalties, hazard deployment/expiry and Heaven Lock transitions. They do not change costs, legal actions, randomness or turn progression.

`packages/war/guidance` explains the current validated skill catalogue and restrictions. `useWarSelection` guides skill → mode (when needed) → source → target(s)/distance → preview → confirmation, using only `legalSkills` candidates. The board and labelled counter buttons share the same candidates. Confirmation submits the existing action ID; bank deduction remains in the existing engine/server validator. Invalid local selections are labelled as guidance, and server error replies retain their own wording in history.

The command-area drawers contain skills, Battlefield Key, a collapsible recent-events history and a skippable three-step introduction. The introduction dismissal is stored in `ludi.warIntroduction.v1` and can be replayed from the table menu. Board hints use existing symbols, support focus and tap, and do not intercept skill-target taps. War’s stacked-counter hit area follows the visible counter rather than a neighbouring counter's invisible hit area.

`NoticeQueue` is independent of movement presentation and authority. It shows one notification, queues at most eight significant pending records, and keeps 100 recent significant history entries. Ordinary updates cannot discard a pending capture. Default reading times are 4/6/8 seconds for ordinary/bank-and-hazard/significant events; critical notices persist until acknowledged or an appropriate state supersedes them. Hover, focus and table pause hold the remaining reading time. Queued notices identify their originating round. Reconnection initializes from confirmed records rather than replaying an unbounded toast backlog.
