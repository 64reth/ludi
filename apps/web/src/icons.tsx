import {
  ArrowLeftRight,
  Check,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Footprints,
  LockKeyhole,
  Shield,
  StepForward,
  type LucideIcon,
} from "lucide-react";
import type { Skill } from "../../../packages/war/index";

// Named exports keep imports tree-shakeable; no dynamic or whole-library registry.
export {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Circle,
  CircleCheck,
  CircleHelp,
  Clock,
  Coins,
  Copy,
  Crosshair,
  Dices,
  Flag,
  Footprints,
  Home,
  Info,
  LogIn,
  LogOut,
  LockKeyhole,
  Menu,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Scroll,
  Settings,
  Shield,
  Swords,
  Target,
  TriangleAlert,
  UserRound,
  Users,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  X,
  Zap,
} from "lucide-react";

/** Icons supplement text or the parent control's accessible name. */
export function Icon({
  icon: Glyph,
  size = 18,
  className = "",
}: {
  icon: LucideIcon;
  size?: number;
  className?: string;
}) {
  return (
    <Glyph
      size={size}
      strokeWidth={1.8}
      className={`ui-icon ${className}`}
      aria-hidden="true"
      focusable="false"
    />
  );
}
const skillGlyphs: Record<Skill, LucideIcon> = {
  guard: Shield,
  tempo: Footprints,
  switch: ArrowLeftRight,
  long: Crosshair,
  jump: StepForward,
  double: Crosshair,
  lock: LockKeyhole,
};
export function SkillIcon({
  skill,
  size = 18,
}: {
  skill: Skill;
  size?: number;
}) {
  return <Icon icon={skillGlyphs[skill]} size={size} />;
}
export function DisclosureIcon() {
  return (
    <span className="disclosure-icon" aria-hidden="true">
      <Icon icon={ChevronDown} className="when-closed" />
      <Icon icon={ChevronUp} className="when-open" />
    </span>
  );
}
export function SelectedIcon({ selected }: { selected: boolean }) {
  return selected ? (
    <Icon icon={Check} size={12} className="selected-icon" />
  ) : null;
}
