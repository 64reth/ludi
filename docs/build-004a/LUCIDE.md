# Build 004A addendum — Lucide interface icons

Implemented locally with one `lucide-react@1.61.0` installation, added using the existing npm package manager. This icon addendum is included in the approved Build 004A release; see RELEASE.md for deployment and verification.

The shared `apps/web/src/icons.tsx` module uses named imports/exports, a small typed skill mapping and a common decorative icon wrapper. Standard controls use 18 px icons with 1.8 px strokes; secondary status indicators use 12–14 px icons and larger headings/entry illustrations use explicit sizes. `icons.css` owns alignment and shared icon presentation.

Icons supplement readable labels. Icon-only controls retain accessible names. The SVGs have `aria-hidden="true"` and `focusable="false"`; they do not create extra screen-reader or keyboard stops. Selected skills, counters, rule categories and game modes include visible checkmarks alongside their existing ARIA state. Disabled skills retain their unavailability explanations. Existing mobile touch targets are preserved, and close controls have a 44 px minimum target. No icon animation was added.

| Interface function | Lucide icon |
|---|---|
| Menu / settings | Menu / Settings |
| Roll action | Dices |
| Skills / prepare or deploy | Zap |
| Guard Up | Shield |
| Fast Forward / Draw Back | Footprints |
| Switcheroo | ArrowLeftRight |
| Long Cut / Double Cut | Crosshair |
| Block Jumper | StepForward |
| Heaven Lock skill label | LockKeyhole |
| War Bank | Coins |
| Players / human / computer | Users / UserRound / Bot |
| Battlefield Key / Match Rules | BookOpen |
| Match Events | Scroll |
| Help | CircleHelp |
| Sound | Volume2 / VolumeX |
| Connection / reconnection | Wifi / WifiOff |
| Back / forward / expand / collapse | ArrowLeft / ArrowRight / ChevronDown / ChevronUp |
| Confirm / cancel / warning | Check / X / TriangleAlert |

The LUDI wordmark and star, wooden frame, board SVG artwork, counter artwork, colour tokens, dice faces, route geometry and animations were preserved. Board effects and hazard symbols are unchanged. Battlefield Key deliberately retains the literal symbols used on the board, including » / ≈ / !, ▣ and ◇. Interface skill icons do not replace those board markings.

Actual skill names, costs, targeting rules and hazard explanations continue to come from the existing game data and functions. No mechanics, economy or authority code was changed for this addendum.

## Verification

- `npm ls lucide-react --depth=0`: one installation.
- `npm run build`: passed, including TypeScript; the production bundle includes the imported icons rather than the full icon catalogue.
- `npm test`: all 56 existing tests passed.
- `git diff --check`: passed.
- Chrome: Heritage and War before/after rolling at 375 × 667, 390 × 844, 393 × 852, 430 × 932; landscapes at 844 × 390 and 667 × 375; desktop at 1440 × 1000.
- All 24 phone-state measurements retained the same board widths, with zero gameplay-page scroll and no horizontal overflow.
- Actual Guard Up purchase/deployment and board selection; offensive Long Cut fixture; orientation continuity; sheet keyboard focus and larger-text/narrow-phone checks passed.
- Desktop and mobile icon audit: no unnamed visible buttons; all visible interface SVGs used the shared stroke weight and decorative accessibility attributes; sound toggle changed its icon; mode selection showed its checkmark; warning and connection controls rendered correctly.
- Multiplayer lobby, synchronized turns and reload recovery were checked in two mobile browsers against the local production Worker for both modes.

Fresh captures are in the existing screenshot gallery (`index.html`), including the refreshed `reference-check-*`, portrait/landscape and desktop images. `lucide-connection-warning.png` captures the connection/error controls. These are Chrome emulation checks; physical Safari hardware was not used.

For icon component conventions, see the [official Lucide React guide](https://lucide.dev/guide/react).
