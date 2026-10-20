export const fields = {
  sixRequired: {
    group: "Entry",
    label: "Born on a six",
    help: "Spend a six to release a counter.",
    value: true,
  },
  compulsoryEntry: {
    group: "Entry",
    label: "Compulsory entry",
    help: "Release a counter whenever a legal entry exists.",
    value: false,
  },
  extraSix: {
    group: "Dice",
    label: "Extra roll after a six",
    help: "One bonus throw when either die shows six.",
    value: true,
  },
  doubleSix: {
    group: "Dice",
    label: "Double-six bonus",
    help: "How many extra throws a double six earns.",
    value: "one",
    options: ["none", "one", "two"],
  },
  sixPenalty: {
    group: "Dice",
    label: "Consecutive-six penalty",
    help: "Count consecutive throws containing a six.",
    value: "none",
    options: ["none", "third throw ends turn"],
  },
  useBoth: {
    group: "Dice",
    label: "Use both dice when possible",
    help: "Choose a sequence that uses both dice if one exists.",
    value: true,
  },
  combined: {
    group: "Dice",
    label: "Combined movement",
    help: "Separate resolves each landing; combined permits a single summed move.",
    value: "separate",
    options: ["separate", "combined permitted"],
  },
  blockSize: {
    group: "Blocking",
    label: "Counters to form a block",
    help: "Same-colour counters occupying one cell.",
    value: 2,
    options: [2, 3, 4],
  },
  maxBlock: {
    group: "Blocking",
    label: "Maximum block size",
    help: "Maximum friendly counters on a shared cell.",
    value: 2,
    options: [2, 3, 4],
  },
  moveBlocks: {
    group: "Blocking",
    label: "Move blocks on doubles",
    help: "Move a block by one die’s value when doubles are thrown.",
    value: true,
  },
  blockPassage: {
    group: "Blocking",
    label: "Blocks prevent passage",
    help: "Opponents cannot pass through an intact block.",
    value: true,
  },
  gateBlocking: {
    group: "Blocking",
    label: "Allow starting-gate blocks",
    help: "A block can prevent an opponent entering.",
    value: true,
  },
  blockCapture: {
    group: "Blocking",
    label: "Special block capture",
    help: "House variant: an equal-sized block may capture on doubles.",
    value: "never",
    options: ["never", "equal block on doubles"],
  },
  captureSingles: {
    group: "Capturing",
    label: "Capture single counters",
    help: "An exact landing returns an opposing single to its yard.",
    value: true,
  },
  safeSquares: {
    group: "Capturing",
    label: "Safe-square protection",
    help: "Protect provisional track cells 8, 21, 34 and 47.",
    value: false,
  },
  protectedGates: {
    group: "Capturing",
    label: "Protect starting gates",
    help: "Single counters at gates cannot be captured.",
    value: false,
  },
  blockBeforeHome: {
    group: "Home",
    label: "Block before home entry",
    help: "Land a block at your home entrance once to unlock home for your colour.",
    value: false,
  },
  exactFinish: {
    group: "Home",
    label: "Exact roll to finish",
    help: "Overshooting heaven is not permitted.",
    value: true,
  },
  combinedFinish: {
    group: "Home",
    label: "Combine dice for exact finish",
    help: "Allow a sum of both dice for the final move.",
    value: false,
  },
  players: {
    group: "Match",
    label: "Player slots",
    help: "The conventional board seats two to four.",
    value: 4,
    options: [2, 3, 4],
  },
  timer: {
    group: "Match",
    label: "Turn timer",
    help: "Seconds for the whole turn, including bonus rolls; zero means unlimited.",
    value: 0,
    options: [0, 15, 30, 45, 60, 90, 120],
  },
  visibility: {
    group: "Match",
    label: "Table visibility",
    help: "Public is labelled only; discovery is coming later. Joining requires a code.",
    value: "private",
    options: ["private", "public"],
  },
} as const;
type Value<T> = T extends boolean
  ? boolean
  : T extends number
    ? number
    : string;
export type RuleKey = keyof typeof fields;
export type Rules = {
  version: 1;
  mode?: "heritage" | "war";
  preset: "don" | "life" | "custom";
  slots: ("human" | "computer")[];
} & { [K in RuleKey]: Value<(typeof fields)[K]["value"]> };
export const presetNames = {
  don: "Ludi Don",
  life: "Ludi 4 Life",
  custom: "Custom House Rules",
};
export function preset(id: Rules["preset"]): Rules {
  const base = Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, v.value]),
  );
  return {
    ...base,
    version: 1,
    preset: id,
    slots: ["human", "human", "computer", "computer"],
    ...(id === "life"
      ? {
          maxBlock: 4,
          moveBlocks: false,
          blockBeforeHome: true,
          combinedFinish: true,
        }
      : {}),
  } as Rules;
}
export function validate(
  value: unknown,
  includeCompatibility = true,
): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return ["Configuration must be an object."];
  const r = value as Record<string, unknown>;
  const errors: string[] = [];
  if (r.mode !== undefined && r.mode !== "heritage" && r.mode !== "war")
    errors.push("Unknown game mode.");
  if (r.version !== 1) errors.push("Unsupported rules version.");
  if (!["don", "life", "custom"].includes(String(r.preset)))
    errors.push("Unknown preset.");
  for (const [key, f] of Object.entries(fields)) {
    const v = r[key];
    if (
      typeof v !== typeof f.value ||
      ("options" in f && !(f.options as readonly unknown[]).includes(v))
    )
      errors.push(`Invalid setting: ${f.label}.`);
  }
  if (
    !Array.isArray(r.slots) ||
    r.slots.length !== 4 ||
    r.slots.some((x) => !["human", "computer"].includes(x)) ||
    r.slots[0] !== "human"
  )
    errors.push("Four slot types are required; the host must be human.");
  if (!includeCompatibility) return errors;
  if (Number(r.maxBlock) < Number(r.blockSize))
    errors.push("Maximum block size must be at least the block threshold.");
  if (!r.extraSix && r.doubleSix !== "none")
    errors.push("Double-six bonuses require extra rolls after a six.");
  if (!r.extraSix && r.sixPenalty !== "none")
    errors.push("Consecutive-six penalties require bonus rolls after a six.");
  if (!r.exactFinish && r.combinedFinish)
    errors.push("Combined exact finish requires exact finishing.");
  if (r.protectedGates && r.gateBlocking)
    errors.push("Protected gates conflict with starting-gate blocking.");
  if (r.blockCapture !== "never" && !r.moveBlocks)
    errors.push("Block capture on doubles requires moving blocks on doubles.");
  return errors;
}
export function summary(r: Rules) {
  return `${presetNames[r.preset]} · ${r.players} players · ${r.timer ? r.timer + "s turns" : "Untimed"} · ${r.visibility}`;
}
export function serialize(r: Rules) {
  return JSON.stringify(r, null, 2);
}
