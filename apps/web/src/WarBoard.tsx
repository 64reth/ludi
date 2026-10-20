import { BoardHint } from "./BoardHint";
import {
  counterLabel,
  playerLabel,
} from "../../../packages/game-engine/events";
import { tokensFor, pointFor } from "../../../packages/board/layout";
import { type Game } from "../../../packages/game-engine/index";
import {
  effect,
  hazardName,
  type SkillAction,
} from "../../../packages/war/index";
export function WarBoard({
  game,
  preview,
  terrain = false,
  onExplain,
}: {
  game: Game;
  preview?: SkillAction;
  terrain?: boolean;
  onExplain?: (text: string) => void;
}) {
  const w = game.war;
  if (!w) return null;
  return (
    <g className="war-board" pointerEvents="none">
      {terrain &&
        [
          ...w.active.map((h) => ({ ...h, incoming: false })),
          ...w.incoming.map((h) => ({ ...h, incoming: true })),
        ].map((h, i) => {
          const p = pointFor(`track-${h.cell}`);
          return (
            <g
              key={i}
              transform={`translate(${p.x} ${p.y})`}
              opacity={h.incoming ? 0.5 : 1}
              className={h.incoming ? "incoming-hazard" : "active-hazard"}
            >
              <BoardHint
                label={`${h.incoming ? "Incoming" : "Active"} ${hazardName(h.kind)}`}
                onExplain={onExplain}
                text={`${hazardName(h.kind)} · ${h.incoming ? `incoming in round ${w.activates}; no effect yet.` : "active; triggers on a new landing."} ${h.kind === "slip" ? "Up to 2 extra legal spaces; cannot force a blocked route or finish in Heaven." : h.kind === "sand" ? "Next eligible move up to 2 shorter, then the slow expires; at least 1 space remains." : "Ordinary capture protection is removed on this tile; a purchased Guard Up shield still works."}`}
              >
                <rect
                  x="-.44"
                  y="-.44"
                  width=".88"
                  height=".88"
                  rx=".09"
                  fill={h.incoming ? "none" : "#192e28"}
                  stroke="#ffe4a1"
                  strokeWidth=".065"
                  strokeDasharray={h.incoming ? ".12 .08" : undefined}
                />
                <text
                  textAnchor="middle"
                  y=".19"
                  fill="#fff0bc"
                  fontSize=".56"
                  fontWeight="900"
                >
                  {h.kind === "slip" ? "»" : h.kind === "sand" ? "≈" : "!"}
                </text>
              </BoardHint>
            </g>
          );
        })}
      {!terrain &&
        tokensFor(game).map((t) => {
          const e = effect(game, { owner: t.owner, piece: t.piece }),
            chosen =
              preview?.source?.owner === t.owner &&
              preview.source.piece === t.piece,
            target = preview?.targets.some(
              (r) => r.owner === t.owner && r.piece === t.piece,
            );
          const fx =
            w.lastSkill?.revision === game.revision &&
            w.lastSkill.refs.some(
              (r) => r.owner === t.owner && r.piece === t.piece,
            )
              ? w.lastSkill.skill
              : undefined;
          return (
            <g key={t.key} transform={`translate(${t.x} ${t.y})`}>
              {fx && (
                <circle
                  className={`skill-flash skill-${fx}`}
                  r={t.size + 0.27}
                  fill="none"
                  stroke="#ffe5a1"
                  strokeWidth=".09"
                />
              )}
              {(e?.shield || e?.slow || chosen || target) && (
                <>
                  <circle
                    r={t.size + 0.18}
                    fill="none"
                    stroke={target ? "#ff9680" : "#fff6be"}
                    strokeWidth=".08"
                    strokeDasharray={target ? ".1 .07" : undefined}
                  />
                  <text
                    y={-t.size - 0.18}
                    textAnchor="middle"
                    fill="#fff6be"
                    fontSize=".38"
                    fontWeight="900"
                  >
                    {e?.shield
                      ? "◇"
                      : e?.slow
                        ? "−" + e.slow
                        : chosen
                          ? "↑"
                          : "×"}
                  </text>
                </>
              )}
            </g>
          );
        })}
      {!terrain && w.lock && (
        <g className="heaven-lock">
          <BoardHint
            label="Heaven Lock"
            onExplain={onExplain}
            text={`Heaven sealed by ${playerLabel(game, w.lock)}. Nobody can finish, including the caster. Legal home-lane moves continue. The seal ends at the caster’s next normal turn or if they leave.`}
          >
            <title>Heaven sealed for all players</title>
            <circle
              cx="7.5"
              cy="7.5"
              r=".78"
              fill="#162c25"
              stroke="#f4c953"
              strokeWidth=".08"
            />
            <text
              x="7.5"
              y="7.67"
              textAnchor="middle"
              fill="#f4c953"
              fontSize=".52"
            >
              ▣
            </text>
          </BoardHint>
        </g>
      )}
    </g>
  );
}
