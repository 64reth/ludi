import { BoardHint } from "./BoardHint";
import { WarBoard } from "./WarBoard";
import type { SkillAction, Ref } from "../../../packages/war/index";
import { useEffect, useId, useRef, useState } from "react";
import type { View } from "../../../packages/presentation/index";
import { BoardPieces } from "./BoardPieces";
import type { Game, Move } from "../../../packages/game-engine/index";
import {
  track,
  homes,
  yards,
  yardCells,
  finishes,
  gates,
  type Cell,
} from "../../../packages/board/geometry";
const colours = ["#bd3831", "#28754b", "#e7b62b", "#27759c"];
const names = ["Red", "Green", "Gold", "Blue"];
type Props = {
  skillPreview?: SkillAction;
  skillCandidates?: Ref[];
  onSkillPiece?: (r: Ref) => void;
  inspector?: boolean;
  onInspect?: (text: string) => void;
  onSelect?: (text: string) => void;
  stack?: boolean;
  safeSquares?: boolean;
  seat?: number;
  game?: Game;
  moves?: Move[];
  selectedPiece?: number;
  onPiece?: (piece: number) => void;
  onDestination?: (moves: Move[]) => void;
  canAct?: boolean;
  presentation?: View;
  motionPaused?: boolean;
};
export function Board({
  skillPreview,
  skillCandidates,
  onSkillPiece,
  inspector = false,
  onInspect,
  onSelect,
  stack = false,
  safeSquares = false,
  seat,
  game,
  moves,
  selectedPiece,
  onPiece,
  onDestination,
  canAct,
  presentation,
  motionPaused = false,
}: Props) {
  const [explanation, explain] = useState("");
  const id = useId().replaceAll(":", "");
  const svg = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (onSkillPiece) explain("");
  }, [!!onSkillPiece]);
  useEffect(() => {
    if (motionPaused) svg.current?.pauseAnimations();
    else svg.current?.unpauseAnimations();
  }, [motionPaused]);
  function band(c: Cell) {
    if (c.colour !== undefined) return colours[c.colour];
    const lane = c.y >= 6 && c.y <= 8 ? c.y - 6 : c.x - 6;
    return ["#edc64d", "#45845a", "#cd5143"][lane] || "#f0dfb4";
  }
  return (
    <div className="board-frame">
      <svg
        ref={svg}
        viewBox="-0.75 -0.75 16.5 16.5"
        role="group"
        aria-label="Heritage Ludi board, fixed orientation"
      >
        <defs>
          <filter
            id={`${id}shadow`}
            x="-70%"
            y="-70%"
            width="240%"
            height="260%"
          >
            <feDropShadow
              dx="0"
              dy=".08"
              stdDeviation=".07"
              floodOpacity=".45"
            />
          </filter>
          <pattern
            id={`${id}grain`}
            width="1.3"
            height=".14"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M0 .07Q.4 .02 1.3 .06"
              fill="none"
              stroke="#4f3217"
              strokeOpacity=".08"
              strokeWidth=".013"
            />
          </pattern>
          {colours.map((c, i) => (
            <radialGradient key={c} id={`${id}piece${i}`} cx="30%" cy="25%">
              <stop stopColor={c} />
              <stop offset=".72" stopColor={c} />
              <stop
                offset="1"
                stopColor={["#70231e", "#16452d", "#987119", "#17475f"][i]}
              />
            </radialGradient>
          ))}
        </defs>
        <rect
          x="-.65"
          y="-.65"
          width="16.3"
          height="16.3"
          rx=".12"
          fill="#efdfb2"
          stroke="#1e3021"
          strokeWidth=".08"
        />
        {yards.map((p, i) => (
          <g key={i}>
            <rect
              x={p.x + 0.06}
              y={p.y + 0.06}
              width="5.88"
              height="5.88"
              fill={colours[i]}
              stroke="#203d2b"
              strokeWidth=".06"
            />
            <path
              d={`M${p.x + 0.32} ${p.y + 1.1}v-.78h.78 M${p.x + 4.9} ${p.y + 0.32}h.78v.78 M${p.x + 0.32} ${p.y + 4.9}v.78h.78 M${p.x + 4.9} ${p.y + 5.68}h.78v-.78`}
              fill="none"
              stroke="#faedbc"
              strokeWidth=".06"
              opacity=".7"
            />
            <path
              d={`M${p.x + 2.05} ${p.y + 3}l.95-.62.95.62-.95.62Z`}
              fill="#153a29"
              opacity=".22"
            />
            <text
              x={p.x + 3}
              y={p.y + 3.15}
              textAnchor="middle"
              fontFamily="Impact, sans-serif"
              fontSize=".38"
              letterSpacing=".04"
              fill={i === 2 ? "#2a361c" : "#fff0be"}
            >
              {names[i].toUpperCase()}
            </text>
            {seat === i && (
              <rect
                x={p.x + 0.18}
                y={p.y + 0.18}
                width="5.64"
                height="5.64"
                fill="none"
                stroke="#ffed9a"
                strokeWidth=".09"
                strokeDasharray=".2 .12"
              />
            )}
          </g>
        ))}
        {[...track, ...homes].map((c) => (
          <g
            key={c.id}
            role={inspector ? "button" : undefined}
            tabIndex={inspector ? 0 : undefined}
            aria-label={inspector ? `Inspect ${c.id}` : undefined}
            onClick={
              inspector
                ? () => onInspect?.(`${c.id} · (${c.x}, ${c.y})`)
                : undefined
            }
            onKeyDown={
              inspector
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onInspect?.(`${c.id} · (${c.x}, ${c.y})`);
                    }
                  }
                : undefined
            }
          >
            <rect
              x={c.x + 0.02}
              y={c.y + 0.02}
              width=".96"
              height=".96"
              fill={band(c)}
              stroke="#263e2c"
              strokeWidth=".035"
            />
            {gates.includes(Number(c.id.slice(6))) && c.kind === "track" && (
              <BoardHint
                label={`${names[c.colour!]} starting arrow`}
                onExplain={game?.war ? explain : undefined}
                text={`Permanent ${names[c.colour!]} entry marking. It shows the starting direction, not extra movement. Your configured entry rule still applies.`}
              >
                <rect
                  x={c.x + 0.12}
                  y={c.y + 0.12}
                  width=".76"
                  height=".76"
                  rx=".05"
                  fill="#fbedbb"
                />
                <text
                  x={c.x + 0.5}
                  y={c.y + 0.71}
                  fontWeight="900"
                  fontSize=".68"
                  textAnchor="middle"
                  fill="#233f29"
                >
                  {["→", "↓", "←", "↑"][c.colour!]}
                </text>
              </BoardHint>
            )}
            {safeSquares &&
              [8, 21, 34, 47].some((i) => c.id === `track-${i}`) && (
                <circle
                  cx={c.x + 0.5}
                  cy={c.y + 0.5}
                  r=".17"
                  fill="none"
                  stroke="#f9edc7"
                  strokeWidth=".06"
                />
              )}
          </g>
        ))}
        {finishes.map((c, i) => (
          <polygon
            key={c.id}
            points={
              [
                "6,9 6,6 7.5,7.5",
                "6,6 9,6 7.5,7.5",
                "9,6 9,9 7.5,7.5",
                "9,9 6,9 7.5,7.5",
              ][i]
            }
            fill={colours[i]}
            stroke="#253d29"
            strokeWidth=".06"
          />
        ))}
        <path
          d="M7.5 6.86l.64.64-.64.64-.64-.64Z"
          fill="#f8e6aa"
          stroke="#253d29"
          strokeWidth=".04"
        />
        <text
          x="7.5"
          y="7.66"
          textAnchor="middle"
          fill="#203e2a"
          fontSize=".45"
          fontWeight="900"
        >
          L
        </text>
        <rect
          x="-.55"
          y="-.55"
          width="16.1"
          height="16.1"
          fill={`url(#${id}grain)`}
          pointerEvents="none"
        />
        {game?.war && <WarBoard game={game} terrain onExplain={explain} />}
        <BoardPieces
          prefix={id}
          skillCandidates={skillCandidates}
          onSkillPiece={
            onSkillPiece
              ? (r) => {
                  explain("");
                  onSkillPiece(r);
                }
              : undefined
          }
          onExplain={game?.war ? explain : undefined}
          presentation={presentation}
          game={game}
          moves={moves}
          selectedPiece={selectedPiece}
          onPiece={onPiece}
          onDestination={onDestination}
          canAct={canAct}
          stack={stack}
          onSelect={onSelect}
          onInspect={onInspect}
        />
        {game?.war && (
          <WarBoard game={game} preview={skillPreview} onExplain={explain} />
        )}
        {[
          [-0.4, -0.4],
          [15.4, -0.4],
          [-0.4, 15.4],
          [15.4, 15.4],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r=".07" fill="#614321" />
        ))}
      </svg>
      {game?.war && explanation && (
        <div className="board-explainer" role="status">
          <p>{explanation}</p>
          <button
            onClick={() => explain("")}
            aria-label="Close symbol explanation"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
