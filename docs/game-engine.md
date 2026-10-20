# Heritage engine · Build 002

`packages/game-engine` is a deterministic TypeScript module. It has no React, storage, networking, clocks or random-number calls. Controller runtimes supply two validated dice values. The local runtime uses Web Crypto; the room server uses Node crypto. Both call the same roll, legal-move, move, pass, timeout and forfeit functions. AI chooses only from that generator.

## Path and state

Four counters per player use progress -1 (yard), 0–50 (shared path from their gate), 51–55 (own home lane) and 56 (finished). This follows the retained 52-cell cross: each colour turns into home at the cell before the cell immediately preceding its gate. Board IDs and coordinates are unchanged. The engine derives cell IDs from the pure board geometry; rendering never decides movement.

Game version 1 embeds the versioned locked rules, roster, counter progress, home qualification, turn/roll counters, remaining dice indices, queued bonus rolls, revision, a bounded event feed and the actual winner. Every state transition returns a fresh state. Turn order is clockwise by colour on the fixed board; the first configured player starts the first match. Rematches rotate the starting player. This starting-player choice is a provisional product default, not the opening-high-die ritual described by Ludi 4 Life.

## Executable interpretations

- Entry spends a single die to place one counter at its gate; the six requirement can be disabled. Compulsory entry prioritises legal releases before other moves.
- Each ordinary die resolves independently. Optional combined movement makes one summed move with one final landing. Intervening blocks still stop passage. Combined exact finishing has a separate permission.
- With both-dice enforcement enabled, a depth-two lookahead retains only actions belonging to sequences that consume the maximum number of available dice. Without it, the player may explicitly forfeit unused dice. Unplayable dice end automatically.
- Friendly stacks on shared cells form blocks at the configured threshold and cannot exceed the configured maximum. Friendly counters may pass their own blocks. Opposing blocks can be passed only if passage blocking is disabled; they cannot normally be landed on.
- A whole block may move on doubles, consuming both dice and travelling one die's distance. The optional equal-block capture variant permits capturing an equal-sized opposing block with this action. Safe cells remain protected.
- Exposed opposing counters are captured on exact landing and return to their original yards. A stack smaller than the configured block threshold is treated as exposed and captured together. Turning captures off makes those enemy-occupied destinations unavailable.
- Safe-square protection covers the explicitly provisional cells 8, 21, 34 and 47. Protected starting gates apply to all coloured gates. Disabling gate blocking prevents forming a block on another active colour's gate; it does not ban a single counter from occupying that gate.
- A home-entry block must **land** at progress 50 with the configured number of counters. This permanently unlocks the home lane for that colour. Passing the entrance as a moving group does not qualify. Counters inside their own home lane cannot be captured and may share home-lane cells.
- Exact finish rejects overshooting. If disabled, an overshoot finishes the counter. Four finished counters win immediately.
- A throw containing a six earns one bonus when enabled. The double-six policy overrides this with zero, one or two queued throws. The penalty counts consecutive throws containing a six; the third discards that throw and remaining credits, retaining earlier legal moves.
- Turn timers cover the entire player's turn, including bonus rolls. Expiration discards unspent dice and credits but retains completed moves. Local pause/settings/rules screens suspend the clock and computer controller. Online clocks and other players continue while a personal menu is open.

Ambiguous choices above are deliberate provisional house interpretations. The presets are not universal Jamaican standards. See rules.md and board-references.md for sources and authenticity limits.

## Authority and lifecycle

Clients submit a move ID, expected match number and revision, or a roll/pass request with that same version. The server recomputes every legal move. Client dice, distance or winner fields are rejected; stale and out-of-turn actions are rejected. The server alone generates online dice, runs bots, advances clocks and determines results. Room rules stay locked throughout the match and rematches.

Online rematches require agreement from every human at a full connected table. The host may instead return a completed match to the lobby to refill seats/change rules. Local rematches reuse names, colours, controllers and rules. Disconnects retain their seat for 30 seconds; the opaque resume token survives a page reload in sessionStorage. That token is a credential, not authoritative room state. Explicit leave or grace expiry forfeits a player; the last remaining racer wins legitimately by forfeit. Rooms and online matches remain memory-only and are lost on server restart.

### Presentation and clocks (Build 002A)

Presentation consumes confirmed states and never changes move legality, dice, bonuses or winners. Computer Pace is not a house rule and is never included in the locked match configuration. Local computer actions wait for the display and the selected thinking interval; local human clocks count decision time, excluding queued presentation and pause. The authoritative online clock and computer scheduler are unchanged and do not wait for client animations. Reconnect restores the latest server state without replaying stale moves.
