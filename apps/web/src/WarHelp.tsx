import { useState, useEffect, useRef } from "react";
import { hazardName } from "../../../packages/war/index";
import type { Game } from "../../../packages/game-engine/index";
import type { Notice } from "../../../packages/presentation/notices";
export type HelpPage = "key" | "events" | "intro";
export const onboardingKey = "ludi.warIntroduction.v1";
export function needsWarIntro() {
  try {
    return localStorage.getItem(onboardingKey) !== "done";
  } catch {
    return true;
  }
}
const lessons = [
  {
    title: "Roll to earn. Buy before rolling.",
    text: "Each roll adds half the combined dice total, rounded up to your shared War Bank, up to 12 points. Overflow is lost. At the start of a later normal turn, choose Prepare Skill or Roll Dice. Confirming a purchase spends its price and fills your one prepared slot. Hold it across turns, or deploy before rolling when a legal target exists.",
  },
  {
    title: "One skill per table rotation.",
    text: "You may buy one skill into an empty slot before your first roll in a normal turn. Deploy at most one skill per table rotation; you cannot buy again after deployment in that window. Rolling closes the window. Sixes and bonus rolls do not reopen it. Your next opportunity comes after the other active players complete their normal turns. Prices rise by 3 after each purchase, up to 12.",
  },
  {
    title: "Read the battlefield.",
    text: "Arrows are permanent entry markings. Solid » Slipstream gives up to 2 extra legal spaces; ≈ Quicksand slows the next move by up to 2; ! Danger removes ordinary capture protection on that tile. Dashed symbols are incoming, not active. ▣ Heaven Lock stops everyone finishing until the caster’s next normal turn. Open Battlefield Key whenever you need it.",
  },
];
export function WarHelp({
  page,
  game,
  history,
  onClose,
  onPage,
}: {
  page: HelpPage;
  game: Game;
  history: Notice[];
  onClose: () => void;
  onPage: (p: HelpPage) => void;
}) {
  const [step, setStep] = useState(0);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    panel.current?.focus();
  }, []);
  function finish() {
    if (page === "intro")
      try {
        localStorage.setItem(onboardingKey, "done");
      } catch {}
    onClose();
  }
  return (
    <section
      ref={panel}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          finish();
        }
      }}
      className="war-drawer war-help"
      aria-label={
        page === "intro"
          ? "War introduction"
          : page === "key"
            ? "Battlefield key"
            : "Match events"
      }
    >
      <header>
        <h2 aria-live="polite">
          {page === "intro"
            ? `Welcome to War · ${step + 1}/3`
            : page === "key"
              ? "Battlefield Key"
              : "Match Events"}
        </h2>
        <button className="ghost" aria-label="Close War help" onClick={finish}>
          ×
        </button>
      </header>
      {page === "intro" ? (
        <>
          <h3>{lessons[step].title}</h3>
          <p>{lessons[step].text}</p>
          <div className="button-row">
            {step > 0 && (
              <button className="secondary" onClick={() => setStep(step - 1)}>
                Back
              </button>
            )}
            <button
              className="primary"
              onClick={() => (step < 2 ? setStep(step + 1) : finish())}
            >
              {step < 2 ? "Next →" : "Let’s play"}
            </button>
          </div>
          <button className="ghost" onClick={finish}>
            Skip introduction
          </button>
          <p className="subtle">
            Replay from the table menu. This device will remember your choice.
          </p>
        </>
      ) : page === "key" ? (
        <>
          <p>
            Tap a board symbol or focus it with your keyboard for its
            explanation. Symbols describe terrain, not an extra dice rule.
          </p>
          <dl className="battlefield-key">
            <dt>→ ↓ ← ↑ · Starting arrows</dt>
            <dd>
              Permanent entry and direction markings for each colour. They do
              not push a counter forward. Your house entry rule still applies.
            </dd>
            <dt>1–4 · Counter numbers and gold rings</dt>
            <dd>
              Numbers identify each player’s four counters. Gold rings mark
              legal choices; a dashed ring marks the selected counter. Choose a
              highlighted landing or dice action for ordinary movement.
            </dd>
            <dt>○ · Optional safe-square marking</dt>
            <dd>
              Present only when safe squares are enabled in your house rules.
              Ordinary cuts are protected there unless an active Danger Tile has
              exposed the landing counter; Guard Up still works.
            </dd>
            <dt>L · Heaven destination</dt>
            <dd>
              The centre is Heaven. Bring all four counters here through legal
              dice moves to win; skills cannot finish a counter.
            </dd>
            <dt>» · Slipstream</dt>
            <dd>
              After landing on an active tile, advance up to 2 further legal
              spaces. A blocked route prevents the extra movement; it cannot
              finish in Heaven.
            </dd>
            <dt>≈ · Quicksand</dt>
            <dd>
              The landing counter’s next eligible move is up to 2 spaces
              shorter, then the penalty ends. It still moves at least 1 space.
            </dd>
            <dt>! · Danger Tile</dt>
            <dd>
              Ordinary capture protection is removed while the landing counter
              occupies the tile. A purchased Guard Up shield still works.
            </dd>
            <dt>▣ · Heaven Lock</dt>
            <dd>
              Everyone, including the caster, is prevented from finishing. Legal
              home-lane movement continues. It ends at the caster’s next normal
              turn or if the caster leaves.
            </dd>
            <dt>◇ · Guard Up</dt>
            <dd>
              Absorbs the next eligible cut or hostile effect. If unused, it
              expires at the owner’s next normal turn.
            </dd>
            <dt>−2 / −3 · Slowed counter</dt>
            <dd>
              The next eligible move is shorter by up to that amount; at least 1
              space remains. The penalty is single-use.
            </dd>
            <dt>↑ / × · Skill preview</dt>
            <dd>
              A raised selection marks your chosen counter; the crossed target
              marks the opponent affected. Highlighted rings show legal choices.
              Nothing is spent until confirmation.
            </dd>
            <dt>Solid and dashed tiles</dt>
            <dd>
              Solid: active now, triggered only by a new landing. Dashed:
              incoming, with no effect yet. Hazards rotate every two completed
              rounds after a full round of warning.
            </dd>
          </dl>
          <p>
            <strong>Active:</strong>{" "}
            {game.war?.active.map((h) => hazardName(h.kind)).join(" + ") ||
              "None"}
          </p>
          <p>
            <strong>Incoming:</strong>{" "}
            {game.war?.incoming.length
              ? `${game.war.incoming.map((h) => hazardName(h.kind)).join(" + ")} · round ${game.war.activates}`
              : "Next warning has not arrived."}
          </p>
          <button className="secondary" onClick={() => onPage("intro")}>
            Replay introduction
          </button>
        </>
      ) : (
        <>
          <p>
            Confirmed match events, newest first. Selection guidance and
            rejected actions are labelled separately; they do not change the
            match.
          </p>
          <ol className="match-event-history">
            {[...history].reverse().map((e) => (
              <li key={e.id}>{e.text}</li>
            ))}
          </ol>
          {!history.length && <p>No significant events yet.</p>}
        </>
      )}
    </section>
  );
}
