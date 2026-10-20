# LUDI · Playable Heritage

A full-viewport React/TypeScript Ludi game with the Yard Style board, configurable Heritage rules, local pass & play, basic computer opponents and authoritative WebSocket matches.

## Launch

Requires Node 22+ and npm.

```sh
npm install
npm run dev
```

Open http://127.0.0.1:5173. **Local and Solo need no multiplayer server and do not open a lobby WebSocket.**

For online matches, run this in another terminal:

```sh
npm run server
```

Lobby/game endpoint: ws://127.0.0.1:3001/ws · Health: http://127.0.0.1:3001. Vite proxies `/ws`. `VITE_WS_URL` can select another authoritative endpoint. Services bind to loopback for local development; this repository has not been deployed as a public service.

## Play

- **Local:** Play → Local. Choose 2–4 players, names, colours, human/computer controllers and house rules. Start, roll the two dice, then choose a legal move in the left command area or select a counter and highlighted destination. Pass the device when the turn changes.
- **Solo:** Play → Solo. One human faces 1–3 computers. Computer turns run automatically through the same engine. Choose a preset or customise house rules before starting.
- **Online:** Play → Online → Create table. Set the player count and human/computer slots in Match Rules. Open an incognito window or another browser, choose Join table and enter the six-character code. Humans ready up; the host starts. Dice and moves come from the server. On completion, all humans can agree to a rematch.

The default online table has two human seats and two computer seats. For a two-human match, choose two players before creating it. Public visibility remains only a label; public discovery/matchmaking is intentionally absent.

The board stays fixed. Gold rings mark playable counters. Select one to highlight its destinations; multiple dice allocations are offered as explicit choices. Finished counters stay in their colour's central finishing region. Captured counters return to their own yards.

Pause suspends local AI and timers. An online table continues while an individual menu is open. Leave requires confirmation. Results appear only after a real victory (all four home, or last racer after forfeits). Rematches preserve the rules and roster and rotate the starting player.

Reconnect within 30 seconds to keep an online seat, including after a page reload. Expiry/explicit leave forfeits that player. Rooms/matches are in server memory. Local games live in the current page and are not saved across reloads.

## Checks

```sh
npm run build
npm test
```

Focused tests exercise the shared engine, full 2–4-player matches under both presets, house-rule variants, invalid actions, real WebSocket synchronisation, authoritative results and rematches. See [engine semantics](docs/game-engine.md) for the documented provisional rule interpretations.

## Development inspector

Player-facing screens contain no JSON, coordinates or development controls. To enable the retained board stack/reset and JSON copy/download tools locally:

```sh
VITE_ENABLE_INSPECTOR=true npm run dev
```

Production builds omit this inspector even if the flag is set. Do not expose development servers publicly.

No accounts, external AI services or public matchmaking are included. Reference presets and board geometry remain provisional interpretations, not a universal Jamaican standard. See [rules](docs/rules.md) and [board research](docs/board-references.md).

## Gameplay clarity

Counters travel through the board's actual track and home-lane corners, then land before capture, block or home feedback resolves. The command area identifies the active colour, player name and Human/Computer controller, with a clockwise turn order. Controls wait for confirmed movement to finish; Results follows the final landing.

Choose **Computer Pace: Quick / Normal / Relaxed** in Settings or Pause. Normal is the default; the preference persists on this device. Online pace affects presentation while the server retains authority and its turn clock. Optional game sound covers dice, landing, capture and home; reduced-motion system preferences preserve textual and landing feedback without travel animation.

## War

Play → **War**, then choose Local, Solo or Online. Roll to fill a shared bank up to 12. At the beginning of your next normal turn, choose **Use Skill** to select a skill, counter and target, then preview and confirm it—or **Roll dice** to skip. A full bank after rolling does not reopen the skill window. Prices rise after each purchase. Solid battlefield symbols are active; dashed symbols warn of the next deployment. Skills never finish a counter in Heaven; a legal dice move still wins the match.

See [War rules and interactions](docs/war.md). Heritage remains a separate mode with its original house rules and presentation.

War includes a skippable first-match introduction (replay it from the table menu), a **Battlefield Key**, keyboard/touch symbol explanations and **Match Events** history. Notifications remain readable independently of counter animations, and can be dismissed manually.
