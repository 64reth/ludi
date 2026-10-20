import { effect, type Ref } from "../../../packages/war/index";
import { sameRef } from "../../../packages/war/guidance";
import { counterLabel } from "../../../packages/game-engine/events";
import { useState, useLayoutEffect, useRef } from "react";
import {
  tokensFor,
  pointFor,
  type Token,
} from "../../../packages/board/layout";
import {
  cellId,
  currentPlayer,
  type Game,
  type Move,
} from "../../../packages/game-engine/index";
import type { View } from "../../../packages/presentation/index";
const names = ["Red", "Green", "Gold", "Blue"];
function Travel({ path, duration }: { path: string; duration: number }) {
  const animation = useRef<SVGAnimateMotionElement>(null);
  useLayoutEffect(() => {
    animation.current?.beginElement();
  }, []);
  return (
    <animateMotion
      ref={animation}
      begin="indefinite"
      path={path}
      dur={`${duration}ms`}
      calcMode="linear"
      fill="freeze"
    />
  );
}
function Sprite({
  prefix,
  p,
  selected = false,
  legal = false,
  compactHit = false,
}: {
  prefix: string;
  p: Token;
  selected?: boolean;
  legal?: boolean;
  compactHit?: boolean;
}) {
  const size = p.size;
  return (
    <>
      <circle
        r={p.progress < 0 ? 0.85 : compactHit ? p.size : 0.48}
        fill="transparent"
      />
      <circle
        r={size + 0.13}
        fill="none"
        stroke={selected ? "#fff9d8" : legal ? "#ffdc48" : "transparent"}
        strokeWidth={selected ? 0.09 : 0.055}
        strokeDasharray={selected ? ".1 .07" : undefined}
      />
      <circle cy=".07" r={size + 0.01} fill="#17251a" opacity=".55" />
      <circle
        r={size}
        fill="#f9edcb"
        stroke="#1e3625"
        strokeWidth=".025"
        filter={`url(#${prefix}shadow)`}
      />
      <circle
        cy="-.02"
        r={size * 0.81}
        fill={`url(#${prefix}piece${p.colour})`}
      />
      <circle
        cy="-.025"
        r={size * 0.6}
        fill="none"
        stroke="#fff0ba"
        strokeOpacity=".5"
        strokeWidth=".02"
      />
      <text
        pointerEvents="none"
        y={size * 0.26}
        textAnchor="middle"
        fontSize={size * 0.81}
        fill={p.colour === 2 ? "#1e3826" : "#fff8db"}
        fontWeight="900"
      >
        {p.piece + 1}
      </text>
    </>
  );
}
export function BoardPieces({
  prefix,
  skillCandidates,
  onSkillPiece,
  onExplain,
  game,
  moves = [],
  selectedPiece,
  onPiece,
  onDestination,
  canAct = false,
  stack,
  onSelect,
  onInspect,
  presentation,
}: {
  prefix: string;
  skillCandidates?: Ref[];
  onSkillPiece?: (r: Ref) => void;
  onExplain?: (text: string) => void;
  game?: Game;
  moves?: Move[];
  selectedPiece?: number;
  onPiece?: (piece: number) => void;
  onDestination?: (moves: Move[]) => void;
  canAct?: boolean;
  stack: boolean;
  onSelect?: (text: string) => void;
  onInspect?: (text: string) => void;
  presentation?: View;
}) {
  const [selected, select] = useState("");
  const pieces = tokensFor(game, stack);
  const active = presentation?.active,
    stage = presentation?.stage;
  const traveling =
    !!active && ["select", "travel", "land"].includes(stage || "");
  const moving = new Set(
    traveling ? active.journeys.map((j) => j.token.key) : [],
  );
  const resolving = !!active && stage === "resolve";
  const destinations = new Map<string, Move[]>();
  if (game && canAct && selectedPiece !== undefined)
    for (const m of moves.filter((m) => m.pieces.includes(selectedPiece))) {
      const cell = cellId(currentPlayer(game).colour, m.to);
      destinations.set(cell, [...(destinations.get(cell) || []), m]);
    }
  return (
    <>
      {pieces
        .filter((p) => !moving.has(p.key))
        .map((p) => {
          const skillLegal = skillCandidates?.some((r) =>
            sameRef(r, { owner: p.owner, piece: p.piece }),
          );
          const status = game?.war
            ? effect(game, { owner: p.owner, piece: p.piece })
            : undefined;
          const description = game?.war
            ? `${counterLabel(game, p.owner, p.piece)}. ${status?.shield ? "Guard Up: the next eligible cut or hostile effect is absorbed until your next normal turn." : ""} ${status?.slow ? `Slowed: next eligible move up to ${status.slow} shorter; at least 1 space remains.` : ""} ${status?.danger !== undefined ? "Danger Tile exposure: ordinary capture protection lost; Guard Up still applies." : ""}`
            : "";
          const legal =
            !!game &&
            canAct &&
            p.owner === currentPlayer(game).id &&
            moves.some((m) => m.pieces.includes(p.piece));
          const isSelected = game
            ? p.owner === currentPlayer(game).id && selectedPiece === p.piece
            : selected === p.key;
          const arrived =
              resolving && active.journeys.some((j) => j.token.key === p.key),
            returned =
              resolving && active.captured.some((c) => c.key === p.key);
          const activate = () => {
            if (onSkillPiece) {
              onSkillPiece({ owner: p.owner, piece: p.piece });
              return;
            }
            if (game && !legal) {
              if (description && !onSkillPiece) onExplain?.(description);
              return;
            }
            select(p.key);
            onPiece?.(p.piece);
            onSelect?.(`${names[p.colour]} counter ${p.piece + 1}`);
            onInspect?.(
              `${p.cell} · ${names[p.colour]} counter ${p.piece + 1}`,
            );
          };
          return (
            <g
              key={p.key}
              transform={`translate(${p.x} ${p.y})`}
              role="button"
              tabIndex={!game || legal || game.war || onSkillPiece ? 0 : -1}
              aria-disabled={
                onSkillPiece
                  ? false
                  : game?.war
                    ? undefined
                    : game
                      ? !legal
                      : undefined
              }
              aria-label={`${names[p.colour]} counter ${p.piece + 1}${p.progress === 56 ? " · finished" : ""}`}
              aria-pressed={isSelected}
              onClick={activate}
              onMouseEnter={() => {
                if (description && !onSkillPiece) onExplain?.(description);
              }}
              onFocus={() => {
                if (description && !onSkillPiece) onExplain?.(description);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  activate();
                }
              }}
              className={`counter ${skillLegal ? "skill-eligible-counter" : ""} ${legal ? "legal-counter" : ""} ${arrived ? "arrived-counter" : ""} ${returned ? "returned-counter" : ""}`}
            >
              {arrived && (
                <circle
                  className={
                    active.finished
                      ? "home-ack"
                      : active.formedBlock
                        ? "block-ack"
                        : "landing-ack"
                  }
                  r={p.size + 0.2}
                  fill="none"
                  stroke="#ffdc69"
                  strokeWidth=".07"
                />
              )}
              {returned && (
                <circle
                  className="yard-return-ack"
                  r={p.size + 0.2}
                  fill="none"
                  stroke="#fff4c8"
                  strokeWidth=".07"
                />
              )}
              <g className="counter-art">
                <Sprite
                  prefix={prefix}
                  p={p}
                  selected={isSelected}
                  compactHit={!!game?.war}
                  legal={legal || skillLegal}
                />
              </g>
            </g>
          );
        })}
      {traveling &&
        active.journeys.map((j) => {
          const p = stage === "land" ? j.destination : j.token;
          const path = j.points
            .map((v, i) => `${i ? "L" : "M"} ${v.x} ${v.y}`)
            .join(" ");
          return (
            <g
              key={`${active.id}:${j.token.key}:${stage}`}
              className={`moving-counter ${stage === "select" ? "selecting-counter" : stage === "land" ? "landing-counter" : "travelling-counter"}`}
              aria-label={`${names[p.colour]} counter ${p.piece + 1} ${stage === "select" ? "selected" : stage === "land" ? "landed" : "moving"}`}
              role="img"
              transform={
                stage === "travel" ? undefined : `translate(${p.x} ${p.y})`
              }
            >
              {stage === "travel" && (
                <Travel path={path} duration={presentation.duration} />
              )}
              <g className="counter-art">
                <Sprite
                  prefix={prefix}
                  p={{ ...p, size: j.token.size }}
                  selected
                />
              </g>
            </g>
          );
        })}
      {resolving &&
        active.captured.map((p) => (
          <g
            key={`captured-${active.id}-${p.key}`}
            className="capture-ghost"
            transform={`translate(${p.x} ${p.y})`}
            aria-label={`${names[p.colour]} counter ${p.piece + 1} captured; returned to yard`}
            role="img"
          >
            <g className="counter-art">
              <Sprite prefix={prefix} p={p} />
            </g>
            <path
              d="M-.22 -.22L.22 .22M.22 -.22L-.22 .22"
              stroke="#fff5d9"
              strokeWidth=".09"
            />
          </g>
        ))}
      {[...destinations.entries()].map(([cell, actions]) => {
        const { x, y } = pointFor(cell);
        const values =
          actions[0].kind === "block"
            ? String(game!.dice![actions[0].dice[0]])
            : actions[0].dice.map((d) => game!.dice![d]).join("+");
        const activate = () => onDestination?.(actions);
        return (
          <g
            key={cell}
            role="button"
            tabIndex={0}
            className="legal-destination"
            aria-label={
              actions.length === 1
                ? `Move ${actions[0].kind === "block" ? "block" : "counter"} ${actions[0].pieces.map((i) => i + 1).join(" and ")} with ${actions[0].kind === "block" ? "doubles " : ""}${values}`
                : "Choose dice for highlighted square"
            }
            onClick={activate}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                activate();
              }
            }}
          >
            <rect
              x={x - 0.5}
              y={y - 0.5}
              width="1"
              height="1"
              fill="#fff8cc66"
              stroke="#fff6b3"
              strokeWidth=".09"
            />
            <circle
              cx={x}
              cy={y}
              r=".34"
              fill="#ffdf59"
              stroke="#193c29"
              strokeWidth=".04"
            />
            <text
              x={x}
              y={y + 0.12}
              fontSize=".35"
              fontWeight="900"
              fill="#173723"
              textAnchor="middle"
              pointerEvents="none"
            >
              {actions.length === 1 ? values : "?"}
            </text>
          </g>
        );
      })}
    </>
  );
}
