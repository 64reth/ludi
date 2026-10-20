# Build 002 validation · 19 October 2026

Completed automated UI play-throughs in installed headless Google Chrome, clicking the actual player-facing roll/move controls with unmodified runtime dice. These were browser-controlled play-throughs, not claimed hand-played sessions or injected near-finish fixtures.

- Two-human Local / Ludi Don: Local Green won with four home after 290 UI actions and 109 rolls. Results showed eight total captures and 21 block formations. Local rematch started. No lobby WebSocket opened.
- Solo / Ludi 4 Life at 390px: the human won after 159 human UI actions / 55 human rolls; the automatic computer finished three counters. Both colours had entered home under the home-block prerequisite. Results showed 12 total captures and 18 blocks.
- Online / two isolated browser contexts: Online Red won with four home after 211 UI actions / 81 rolls. Both clients showed the same winner. The guest reloaded and resumed during play. Both humans agreed to a rematch, which started on both clients.
- Direct board interaction at 390px: selecting a legal counter highlighted destinations; the selected landing executed a real move after explicitly choosing dice when necessary. A three-player mixed local table demonstrated automatic computer turns, reassigned clockwise colours and the open-entry house rule.
- Actual 15-second local timer: pause preserved remaining time and resume eventually advanced the player on expiry. Actual 15-second server timer: both connected clients received the same next-player snapshot after expiry.
- Layout checks at 1440×900, 1920×1080, 390×844, 390×667 and 844×390: board remained square/in bounds; primary dice/menu/rules actions fit; no document overflow. Counter/move lists scroll internally. Browser contexts reported no application page errors on the successful runs.

The focused repository suite contains 16 tests: geometry/configuration, mechanical variants and ordering-dependent dice usage, complete 2–4-player matches under both presets, membership/host/ready/lock/resume, a complete authoritative two-human online match, tamper/stale-action rejection, rematch agreement, and a complete server-controlled-computer match. Strict TypeScript and Vite production build pass.

Remaining product limits: physical geometry and some Jamaican interpretations are provisional and documented; local state lasts for the current page; online rooms/matches are memory-only. No public deployment, accounts, public matchmaking or War systems were added.

## Build 002A · Gameplay clarity and pacing

Repeated full UI play-throughs in installed headless Google Chrome using actual controls and unmodified runtime dice:

- Two-human Local: Player 1 won after 234 roll/move UI actions.
- Solo at 390×844: Computer 2 won after 132 human roll/move UI actions; computer actions ran automatically. Initially observed Normal pacing: about 1,375 ms from computer turn appearance to roll (including the turn announcement), with at least 580 ms of observed dice animation. Switched to Quick through Pause for the remaining full match.
- Online with isolated host/guest contexts (desktop/mobile): Guest won after 274 roll/move UI actions. Both sessions showed the same winner. Forced a guest socket disconnect during dice presentation; reconnect restored the latest state without stale travel. Both humans agreed to a rematch, which started on both clients.

DOM observations across these matches confirmed selection → route travel → landing → resolution, actual paths turning corners, capture marks plus yard-return feedback, block formation, home acknowledgement and generated sound cues. No application page errors occurred. Results waited for the presentation to finish.

Focused Chrome checks also passed:

- Moving counter matrices changed across rendered frames, rather than teleporting; legal action controls were unavailable during dice/travel.
- Normal was the initial pace; Relaxed persisted through reload. Settings and Pause expose the three named options without timing numbers.
- System reduced motion omitted route travel while retaining landing and accessible outcome information.
- Pausing during travel held the actual SVG transform unchanged for 900 ms; resume completed the same move.
- Desktop/mobile layouts at 1440×900, 1920×1080, 390×844, 390×667 and 844×390 kept the board and primary commands within the viewport without document overflow.

All **24** repository tests passed, including eight presentation tests for route geometry, ordered snapshots/capture timing, action readiness, pause/reconnect cancellation, reduced motion, pace invariance, completion timing, backlog resets and distinct moving-block offsets. The original engine and authority tests remain included. Strict TypeScript and production build passed; even with `VITE_ENABLE_INSPECTOR=true`, the production output excluded inspector controls.

These are automated browser UI play-throughs and visual inspections, not a claim of physical hand-play. Engine rules, WebSocket protocol and authoritative server scheduling were unchanged. Online turn clocks continue while clients present moves; local human decision clocks exclude presentation time.

## Build 003 · War · 20 October 2026

Completed new automated Chrome UI play-throughs using actual player-facing controls and unmodified runtime dice, without injected banks or near-finish states:

- Two-human Local War: Player 2 won after 242 roll, move and purchase UI actions.
- Solo War at 390×844 with system reduced motion and Quick pace: Computer 2 won after 207 human UI actions; the computer accumulated and spent its own bank automatically.
- Online War with isolated desktop/mobile browser contexts: War Host won after 258 UI actions. Both clients agreed on the winner. A forced guest socket disconnect during the first roll restored the confirmed game and bank. Both humans agreed to a rematch, which started with empty banks.
- Purchased all six skills during these runs; a separate actual mobile purchase exercised Draw Back and displayed its −3 marker. Preview cancellation preserved the bank. Purchase prices rose, and windows stayed closed after use and through bonus rolls.
- Three- and four-player mixed tables at 390×667 completed two normal-turn rotations with automatic computers and advanced to round three. These runs checked controls and board bounds at 390×667, 390×844 and 844×390. Desktop 1440×900 was also inspected. Active and incoming hazard markers were visible; deterministic warning/activation/rotation semantics have focused engine assertions.

Browser play exposed a mobile regression: the additional bank row clipped the legal move list. The bank was compacted and the War move area now scrolls with accessible move choices. Actual Solo/Online and mixed-table play then progressed successfully. Visual inspection of a mobile skill preview also led to moving the skill drawer over the command area so board targets remain visible, with a persistent close header.

The **45-test** suite passes: the previous Heritage/presentation coverage, complete authoritative matches and server computers in both modes, plus War bank/overflow, purchase validation/pricing, normal-turn rotations, shields, both tempo actions, protected territory, connected range, single/double cuts, swapping, Heaven Lock, each hazard, intact-block Slipstream movement, and complete deterministic 2–4-player War matches. The new roll-presentation test asserts visible gain/overflow text. Online tests reject forged/stale/out-of-turn skill commands and submitted balance fields, compare full snapshots on both clients, and reset War state on rematch.

TypeScript and the production build pass. Successful browser runs reported no application page errors. These are automated browser UI play-throughs and visual inspections, not a claim of physical hand-play. The app and multiplayer service remain local development services; no public deployment was performed.

Final rules audit also covered a forfeited Heaven Lock caster (the seal clears) and hazard resolution after Switcheroo for either exchanged counter. Both have passing focused tests.

## Build 003A / 003B · War clarity and interaction · 20 October 2026

Focused checks used installed Chrome, actual player-facing controls and unmodified runtime dice. These checks inspected individual human decisions and notification timing rather than relying only on full-match simulations. The purchase checks selected the existing open-entry house rule to reach active counters promptly; normal dice, bank generation and full-table turn rotations still ran through the authoritative engine.

- Local, Solo, three-player mixed and two isolated Online sessions each earned points, waited for an eligible normal turn, opened Use Skill, selected Guard Up through the board and labelled keyboard choices, previewed/cancelled without spending, then confirmed with exactly three points deducted. The table then showed the closed skill window and the increased next price. Ordinary dice play continued; no second skill could be purchased in the same turn sequence.
- Each table subsequently purchased the targeted Draw Back action on a later eligible turn. Invalid counter taps displayed an immediate reason without charging, valid opposing targets could be selected on the board, the confirmed action charged six points, and the recent history retained the purchase, cost, effect and separately labelled invalid selection. The final Online run used the restarted server with authoritative event sequence numbers and originating rounds.
- Verified the three-step introduction, Skip, dismissal persistence after reload, and replay from the table menu. Heritage had no War introduction, HUD, controls or history and continued normal dice/movement play.
- Inspected Battlefield Key and the actual starting-arrow, incoming-hazard and counter/effect explanations. Keyboard focus, touch taps, tooltip toggling and Escape dismissal worked. Covered command controls are removed from keyboard navigation while a drawer is open, and focus returns when it closes. Counter selection remains available on the board.
- Measured actual browser reading time: a skill notice remained for eight active seconds; a bank notice remained for six active seconds. Hovering held the remaining time. Dismissing all current messages did not leave later notifications permanently paused. Focused fake-clock tests additionally assert four-second ordinary messages, six/eight-second messages, critical persistence, lock supersession, pause/resume, bounded queues, preservation of queued captures and distinct repeated authoritative bank events in history.
- Checked 1440×900, 1920×1080, 390×844, 390×667 and 844×390. No document overflow; board and primary commands fit. Skill/help drawers occupied the command area rather than board cells. The short-mobile Use Skill button fitted without scrolling, and confirmation scrolled into view automatically. Reduced-motion contexts completed the same human interactions. Successful browser checks reported no application page errors.

Issues found and fixed during these checks: invisible hit areas on stacked counters could intercept a neighbouring selection; hover explanations could cover a target during a tap; mobile pre-roll guidance could hide Use Skill; a mobile confirmation needed automatic scrolling; dismissing the last notice could leave stale focus/hover pause state; header typography made a bank tooltip all caps. The final checks above passed after those fixes.

All **53 tests** pass, including the unchanged mechanical variants and complete Heritage/War matches, authoritative online play, and eight new guidance/event/notification tests. TypeScript and production build pass. No prices, ranges, bank limits, hazards, legal movement, skill timing or victory rules were changed. “First Blood” is absent from the interface. No public deployment was performed.
