# LUDI Build 004A — released 22 October 2026

Live application: https://ludi.allencreativetechnologies.uk

Cloudflare Worker: `ludi`, using the existing account, custom domain and `LudiRoom` Durable Object binding. Deployment version: `f25d044f-922b-4eeb-bdd9-2b87cc30ffa9`. The deployed `/api/health` reports build `004A`.

The release remains on the existing `main` branch of https://github.com/64reth/ludi. The final completion report records the release commit hash. No new project, repository or domain was created. The release includes the existing Cloudflare adapter and previously uncommitted application sources needed to reproduce the deployed build; existing prepared-skill mechanics were preserved.

## Final mobile polish

- Preserved the approved board-first Heritage/War layouts, 96%-width portrait board, wooden frame, counters, typography and Lucide icons.
- The existing native-dialog sheet now has a fixed title/close header and a shared War Bank balance/help summary. Only the sheet body scrolls; the underlying game scroll container is locked while a sheet is open. Safe-area padding and focus containment/restoration remain supported.
- Unavailable skill names, prices and explanations use readable opaque text. Dashed borders, a lock icon and explicit “Unavailable” text distinguish them from affordable/selected skills. Skill prices and availability checks are unchanged.
- Small prepared/window text and event messages are larger. Routine notices remain a compact two-line strip; significant/critical notices remain fully visible, with the existing event queue and history unchanged. Bottom navigation targets are at least 44 × 44 px. Prepared deployment has an explicit label and skill icon, while Roll Dice retains its primary styling.
- Targeting remains below the selectable board. Purchase review does not charge points; confirming purchase stores the skill. Cancellation preserves it. Deployment consumes the prepared slot without charging twice. Heaven Lock explains that no counter is needed and uses explicit confirmation.

No changes were made to Heritage rules, 50% War Bank conversion, costs/escalation, prepared inventory limits, hazard rules, dice generation, AI decisions or multiplayer authority for this final polish. The Worker change only updates the health build identifier.

## Verification

- `npm test`: 56 existing tests passed.
- `npm run build`: TypeScript and production build passed.
- `wrangler deploy --dry-run`: packaging passed with the existing bindings.
- `git diff --check`: passed. A scan of project text files found no matching private keys, token assignments or common credential patterns; local Wrangler state remains ignored by Git.
- Git branch was `main`, matched `origin/main` before release work was committed, and retained the existing history.

Chrome checks used touch-enabled phone emulation at 375 × 667, 390 × 844, 393 × 852 and 430 × 932; landscape at 844 × 390 and 667 × 375; desktop at 1440 × 1000. Before/after-roll states retained the same board widths with no horizontal overflow or gameplay-page scroll in the recorded cases. The Skills sheet was also checked after reducing/restoring viewport height by 100 px to emulate browser UI changing the usable height.

Actual interaction checks covered:

1. Fixed title, close and bank while scrolling; reachable final skill; no underlying board scroll; readable unavailable states; working bank help, keyboard focus, Escape and close.
2. Actual local skill purchase and immediate deployment; legal and invalid board targeting; cancellation; orientation continuity.
3. An isolated browser fixture using the unchanged engine held Guard Up across full turns, cancelled a deployment without losing it or changing the bank, and deployed it later without a second charge.
4. A no-target Heaven Lock fixture reviewed/purchased/confirmed the skill and verified board lock, bank, inventory and event updates.
5. Separate mobile browser sessions on production created/joined/started Heritage and War rooms, synchronized turns, reloaded the guest, forced a client connection close and verified automatic seat reconnection. All observed production lobby sockets used `wss://ludi.allencreativetechnologies.uk/ws`.
6. Live two-client smoke checks performed 20 synchronized actions in each mode, authority checks, reconnection and switching rooms over the same socket.
7. Complete private live Heritage and War matches rejected invalid actions, reached real winners, synchronized both clients and started rematches with reset state and rotated starters. Both passed.
8. Production HTTPS frontend and linked JS/CSS assets returned successfully; the live health endpoint reported `004A`.

## Limitations and operational scope

No physical iPhone was available. Safari hardware, actual notches/home indicators and browser chrome were not directly tested; safe-area CSS and dynamic-height behavior were checked through Chrome emulation. This was functional verification, not a production load test.

The deployment used the existing authenticated Wrangler installation and preserved variables. No additional permissions, billing changes or manual Cloudflare approvals were needed. No unrelated DNS records, applications, websites or Microsoft 365 services were modified. Cloudflare credentials were not exposed or committed.

The screenshot gallery is in `index.html`; viewport measurements are in `viewport-results.json`. The fixed-header images and prepared-skill capture document the final polish.
