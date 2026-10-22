import { useState, useMemo, useEffect } from "react";
import {
  legalSkills,
  type Ref,
  type Skill,
  type SkillAction,
} from "../../../packages/war/index";
import { sameRef, invalidTarget } from "../../../packages/war/guidance";
import type { Game } from "../../../packages/game-engine/index";
export function useWarSelection(game: Game, report: (text: string) => void) {
  const [problem, setProblem] = useState("");
  const [skill, setSkill] = useState<Skill>(),
    [mode, setMode] = useState<"forward" | "back">(),
    [source, setSource] = useState<Ref>(),
    [targets, setTargets] = useState<Ref[]>([]),
    [choice, setChoice] = useState<SkillAction>();
  const all = useMemo(() => (game.war ? legalSkills(game) : []), [game]);
  function reset() {
    setProblem("");
    setSkill(undefined);
    setMode(undefined);
    setSource(undefined);
    setTargets([]);
    setChoice(undefined);
  }
  useEffect(reset, [game.match, game.revision]);
  const pool = all.filter(
    (a) => a.skill === skill && (!mode || a.mode === mode),
  );
  const needsMode = skill === "tempo" && !mode;
  const needsSource =
    !!skill && skill !== "lock" && !(skill === "tempo" && mode === "back");
  const matching = pool.filter(
    (a) =>
      (!source || sameRef(a.source, source)) &&
      targets.every((t) => a.targets.some((r) => sameRef(r, t))),
  );
  const step = !skill
    ? "skill"
    : needsMode
      ? "mode"
      : needsSource && !source
        ? "source"
        : skill === "tempo" && mode === "forward"
          ? "distance"
          : skill === "guard" || skill === "lock" || skill === "jump"
            ? "confirm"
            : targets.length === 0
              ? "target"
              : skill === "double" && targets.length === 1
                ? "second"
                : "confirm";
  const unique = (refs: Ref[]) =>
    refs.filter((r, i, a) => a.findIndex((t) => sameRef(r, t)) === i);
  const eligible = unique(
    step === "source"
      ? pool.flatMap((a) => (a.source ? [a.source] : []))
      : ["target", "second"].includes(step)
        ? matching
            .flatMap((a) => a.targets)
            .filter((r) => !targets.some((t) => sameRef(r, t)))
        : [],
  );
  function choose(r: Ref) {
    if (!skill || !eligible.some((t) => sameRef(t, r))) {
      const text = skill
        ? invalidTarget(game, skill, r, source)
        : "Choose a skill first.";
      setProblem(text);
      report(text);
      return;
    }
    setProblem("");
    if (step === "source") {
      setSource(r);
      if (skill === "guard" || skill === "jump") setChoice(pool.find((a) => sameRef(a.source, r)));
    } else {
      const next = [...targets, r];
      setTargets(next);
      setChoice(
        pool.find(
          (a) =>
            (!source || sameRef(a.source, source)) &&
            a.targets.length === next.length &&
            next.every((t) => a.targets.some((r) => sameRef(r, t))),
        ),
      );
    }
  }
  function selectSkill(s: Skill) {
    setProblem("");
    setSkill(s);
    setMode(undefined);
    setSource(undefined);
    setTargets([]);
    setChoice(s === "lock" ? all.find((a) => a.skill === s) : undefined);
  }
  function back() {
    setProblem("");
    setChoice(undefined);
    if (targets.length) {
      const next = targets.slice(0, -1);
      setTargets(next);
      if (skill === "double" && next.length === 1)
        setChoice(
          pool.find(
            (a) =>
              (!source || sameRef(a.source, source)) &&
              a.targets.length === 1 &&
              sameRef(a.targets[0], next[0]),
          ),
        );
    } else if (source) setSource(undefined);
    else if (mode) setMode(undefined);
    else setSkill(undefined);
  }
  return {
    problem,
    skill,
    mode,
    source,
    targets,
    choice,
    step,
    eligible,
    all,
    matching,
    selectSkill,
    setMode,
    choose,
    back,
    reset,
    setChoice,
    preview:
      choice ??
      (skill && source
        ? ({ ...matching[0], skill, source, targets } as SkillAction)
        : undefined),
  };
}
export type WarSelection = ReturnType<typeof useWarSelection>;
