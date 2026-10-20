# Rules research · 19 October 2026

These are reference presets, not universal Jamaican standards. Both are now executable interpretations through the shared Heritage engine. Where the references are silent, the chosen provisional defaults below and in game-engine.md apply consistently to local, solo and online play.

- [Ludi Don](https://ludidon.com/how-to-play-ludi): six entry; separate dice; six bonus; two-counter blocks; doubles block movement; exact finish; no safe stars. Defaults preserve these documented choices.
- [Ludi 4 Life](https://www.ludi4life.com/pages/how-to-play-ludi-jamaican-rules): six entry/bonus; blocks of two or more; no block capture; gate blocking; home-entry block prerequisite; combined exact finish. The source is silent about doubles block movement; this preset disables it provisionally.
- [Caribbean Ludi](https://caribbeanludi.weebly.com/about-instructions.html): also describes moving another counter after capturing, and breaking a block if otherwise unable to complete a roll. These additional constraints are unresolved configuration extensions for the current presets.

Provisional defaults for both: entry optional, one bonus throw for double sixes, no consecutive-six penalty, both dice used if possible, unprotected gates, no special block capture. Maximum block: Don two, Life four. Life normal movement defaults to separate dice. Don does not require a block before home. Safe protection defaults off in Life because none is specified; Don explicitly states no safe stars. Player count four, timer unlimited, visibility private, first two seats human and last two computer.

The source does not fully settle maximum block size, compulsory entry, double-six treatment, penalties, home-block qualification (which counters qualify and how long), friendly passage, or ordering-dependent forced moves. Validate with Jamaican players before implementing executable presets. Special equal-block capture and alternate safe squares are configurable house choices, not source claims. Provisional safe squares: track-8, track-21, track-34, track-47. A protected gate disallows gate blocking under the selected interpretation; validation rejects their combination rather than silently overriding either.

Rules configuration version 1 is a typed JSON object, shared by the client and server. All keys and value domains are validated. Invalid local configurations remain editable and cannot create a room. Invalid shared updates are rejected and leave the previous server state intact. A rule change selects Custom. Reset restores the selected reference baseline. Settings are saved locally only for personal drafts; the server alone owns room rules and membership. Slot types are stored with the configuration, but connected people cannot be converted into bots or removed by a rules edit.

## Gameplay integration

All exposed configuration fields have operational effects: mechanical rules are enforced by the engine, player/controller settings configure the roster, the runtime enforces the timer, and visibility labels the private-code room without introducing public matchmaking. Consecutive-six penalties without bonus rolls are also rejected as incompatible.

The resolved provisional interpretations, including permanent home qualification, exposed sub-threshold stacks, whole-block doubles movement, bonus credits, exact finishing and timer policy, are detailed in game-engine.md. Caribbean Ludi's separate post-capture/different-counter requirement is not a setting or an additional preset here; it is not silently imposed on the two supported reference interpretations.
