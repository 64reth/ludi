import {
  useSkill,
  chooseSkill,
  legalSkills,
  purchaseReason,
  type Skill,
} from "../../../packages/war/index";
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import {
  createGame,
  currentPlayer,
  rollGame,
  moveGame,
  passGame,
  timeoutGame,
  chooseMove,
  legalMoves,
  type Game,
  type Seat,
} from "../../../packages/game-engine/index";
import type { Rules } from "../../../packages/rules/index";
import { paces, type Pace } from "../../../packages/presentation/index";
export function randomDice(): [number, number] {
  const die = () => {
    const a = new Uint32Array(1);
    do {
      crypto.getRandomValues(a);
    } while (a[0] >= 4294967292);
    return (a[0] % 6) + 1;
  };
  return [die(), die()];
}
export function useLocalMatch(
  paused: boolean,
  pace: Pace,
  ready: MutableRefObject<boolean>,
) {
  const [game, setGame] = useState<Game>(),
    [deadline, setDeadline] = useState<number>();
  const clock = useRef({ turn: 0, match: 0, left: 0 });
  useEffect(() => {
    if (!game || game.phase === "finished") {
      setDeadline(undefined);
      return;
    }
    const c = clock.current;
    if (c.turn !== game.turn || c.match !== game.match) {
      c.turn = game.turn;
      c.match = game.match;
      c.left = game.rules.timer * 1000;
    }
    if (paused || !game.rules.timer) {
      setDeadline(undefined);
      return;
    }
    // Presentation never consumes a local player's decision time. Computer decisions are immediate;
    // their waits are presentation only. The online clock remains entirely server-owned.
    let last = Date.now();
    const tick = () => {
      const now = Date.now(),
        elapsed = now - last;
      last = now;
      if (!ready.current || currentPlayer(game).computer) {
        setDeadline(undefined);
        return;
      }
      c.left = Math.max(0, c.left - elapsed);
      setDeadline(now + c.left);
      if (c.left === 0) {
        clearInterval(timer);
        setGame((g) =>
          g && g.turn === game.turn && g.phase !== "finished"
            ? timeoutGame(g)
            : g,
        );
      }
    };
    const timer = setInterval(tick, 80);
    return () => clearInterval(timer);
  }, [game?.turn, game?.match, game?.phase === "finished", paused]);
  useEffect(() => {
    if (
      !game ||
      paused ||
      game.phase === "finished" ||
      !currentPlayer(game).computer
    )
      return;
    // Calculate immediately against this revision; commit once, after the prior visual sequence.
    const skill = chooseSkill(game);
    const move = game.phase === "move" ? chooseMove(game) : undefined;
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;
    const commit = () => {
      if (cancelled) return;
      if (!ready.current) {
        wait();
        return;
      }
      const dice = game.phase === "roll" ? randomDice() : undefined;
      setGame((g) => {
        if (!g || g.revision !== game.revision || g.match !== game.match)
          return g;
        const p = currentPlayer(g);
        return skill
          ? useSkill(g, p.id, skill.id)
          : g.phase === "roll"
            ? rollGame(g, p.id, dice!)
            : moveGame(g, p.id, move!.id);
      });
    };
    const wait = () => {
      timer = setTimeout(() => {
        if (cancelled) return;
        if (!ready.current) wait();
        else timer = setTimeout(commit, paces[pace].think);
      }, 30);
    };
    wait();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [game, paused, pace, ready]);
  return {
    game,
    deadline,
    start(r: Rules, seats: Seat[]) {
      clock.current.turn = 0;
      const g = createGame(r, seats);
      setGame(g);
      return g;
    },
    clear() {
      setGame(undefined);
      clock.current.turn = 0;
    },
    rematch() {
      if (game) {
        clock.current.turn = 0;
        setGame(
          createGame(
            game.rules,
            game.players.map(({ id, name, colour, computer }) => ({
              id,
              name,
              colour,
              computer,
            })),
            game.match + 1,
          ),
        );
      }
    },
    skill(id: string) {
      if (!ready.current) return;
      setGame((g) =>
        g &&
        !currentPlayer(g).computer &&
        (legalSkills(g).some((a) => a.id === id) ||
          (id.startsWith("purchase:") && !purchaseReason(g, id.slice(9) as Skill)))
          ? useSkill(g, currentPlayer(g).id, id)
          : g,
      );
    },
    roll() {
      if (!ready.current) return;
      const dice = randomDice();
      setGame((g) =>
        g && g.phase === "roll" && !currentPlayer(g).computer
          ? rollGame(g, currentPlayer(g).id, dice)
          : g,
      );
    },
    move(id: string) {
      if (!ready.current) return;
      setGame((g) =>
        g &&
        g.phase === "move" &&
        !currentPlayer(g).computer &&
        legalMoves(g).some((m) => m.id === id)
          ? moveGame(g, currentPlayer(g).id, id)
          : g,
      );
    },
    pass() {
      if (!ready.current) return;
      setGame((g) =>
        g &&
        g.phase === "move" &&
        !g.rules.useBoth &&
        !currentPlayer(g).computer
          ? passGame(g, currentPlayer(g).id)
          : g,
      );
    },
  };
}
