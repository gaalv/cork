import {
  Airplane,
  Atom,
  Bell,
  Bookmark,
  BookOpen,
  Brain,
  Briefcase,
  Bug,
  Buildings,
  Calendar,
  Camera,
  ChartLine,
  ChatCircle,
  Code,
  Coffee,
  Compass,
  Cpu,
  Database,
  Envelope,
  FileText,
  Flag,
  Flask,
  Folder,
  GameController,
  Gear,
  GitBranch,
  Globe,
  GraduationCap,
  Hammer,
  Hash,
  Heart,
  Image as ImageIcon,
  Lightbulb,
  Lightning,
  Link,
  ListChecks,
  MapPin,
  MusicNote,
  Notepad,
  Package,
  Palette,
  Pencil,
  Phone,
  Plant,
  Rocket,
  ShieldCheck,
  ShoppingBag,
  Sparkle,
  Star,
  Sword,
  Tag,
  Target,
  Terminal,
  Trophy,
  Users,
  Wrench,
} from "@phosphor-icons/react";

import type { Icon } from "@phosphor-icons/react";

export type NoteIconKey =
  | "file"
  | "notepad"
  | "book"
  | "brain"
  | "lightbulb"
  | "sparkle"
  | "star"
  | "heart"
  | "bookmark"
  | "flag"
  | "tag"
  | "hash"
  | "checks"
  | "pencil"
  | "code"
  | "terminal"
  | "git"
  | "bug"
  | "database"
  | "package"
  | "cpu"
  | "atom"
  | "flask"
  | "rocket"
  | "lightning"
  | "briefcase"
  | "buildings"
  | "chart"
  | "shield"
  | "wrench"
  | "hammer"
  | "gear"
  | "target"
  | "trophy"
  | "calendar"
  | "bell"
  | "compass"
  | "globe"
  | "map"
  | "airplane"
  | "envelope"
  | "phone"
  | "chat"
  | "users"
  | "image"
  | "music"
  | "camera"
  | "palette"
  | "game"
  | "sword"
  | "graduation"
  | "plant"
  | "coffee"
  | "shopping"
  | "link"
  | "folder";

type NoteIconDef = {
  key: NoteIconKey;
  label: string;
  Icon: Icon;
};

export const NOTE_ICONS: ReadonlyArray<NoteIconDef> = [
  { key: "file", label: "Note", Icon: FileText },
  { key: "notepad", label: "Notepad", Icon: Notepad },
  { key: "book", label: "Book", Icon: BookOpen },
  { key: "brain", label: "Brain", Icon: Brain },
  { key: "lightbulb", label: "Idea", Icon: Lightbulb },
  { key: "sparkle", label: "Sparkle", Icon: Sparkle },
  { key: "star", label: "Star", Icon: Star },
  { key: "heart", label: "Heart", Icon: Heart },
  { key: "bookmark", label: "Bookmark", Icon: Bookmark },
  { key: "flag", label: "Flag", Icon: Flag },
  { key: "tag", label: "Tag", Icon: Tag },
  { key: "hash", label: "Hash", Icon: Hash },
  { key: "checks", label: "Checklist", Icon: ListChecks },
  { key: "pencil", label: "Draft", Icon: Pencil },
  { key: "code", label: "Code", Icon: Code },
  { key: "terminal", label: "Terminal", Icon: Terminal },
  { key: "git", label: "Git", Icon: GitBranch },
  { key: "bug", label: "Bug", Icon: Bug },
  { key: "database", label: "Database", Icon: Database },
  { key: "package", label: "Package", Icon: Package },
  { key: "cpu", label: "CPU", Icon: Cpu },
  { key: "atom", label: "Atom", Icon: Atom },
  { key: "flask", label: "Lab", Icon: Flask },
  { key: "rocket", label: "Rocket", Icon: Rocket },
  { key: "lightning", label: "Lightning", Icon: Lightning },
  { key: "briefcase", label: "Work", Icon: Briefcase },
  { key: "buildings", label: "Office", Icon: Buildings },
  { key: "chart", label: "Chart", Icon: ChartLine },
  { key: "shield", label: "Security", Icon: ShieldCheck },
  { key: "wrench", label: "Tool", Icon: Wrench },
  { key: "hammer", label: "Build", Icon: Hammer },
  { key: "gear", label: "Settings", Icon: Gear },
  { key: "target", label: "Goal", Icon: Target },
  { key: "trophy", label: "Win", Icon: Trophy },
  { key: "calendar", label: "Calendar", Icon: Calendar },
  { key: "bell", label: "Reminder", Icon: Bell },
  { key: "compass", label: "Compass", Icon: Compass },
  { key: "globe", label: "Globe", Icon: Globe },
  { key: "map", label: "Place", Icon: MapPin },
  { key: "airplane", label: "Travel", Icon: Airplane },
  { key: "envelope", label: "Mail", Icon: Envelope },
  { key: "phone", label: "Phone", Icon: Phone },
  { key: "chat", label: "Chat", Icon: ChatCircle },
  { key: "users", label: "People", Icon: Users },
  { key: "image", label: "Image", Icon: ImageIcon },
  { key: "music", label: "Music", Icon: MusicNote },
  { key: "camera", label: "Camera", Icon: Camera },
  { key: "palette", label: "Design", Icon: Palette },
  { key: "game", label: "Game", Icon: GameController },
  { key: "sword", label: "Sword", Icon: Sword },
  { key: "graduation", label: "Learn", Icon: GraduationCap },
  { key: "plant", label: "Plant", Icon: Plant },
  { key: "coffee", label: "Coffee", Icon: Coffee },
  { key: "shopping", label: "Shop", Icon: ShoppingBag },
  { key: "link", label: "Link", Icon: Link },
  { key: "folder", label: "Folder", Icon: Folder },
];

const ICON_MAP: Record<string, Icon> = Object.fromEntries(NOTE_ICONS.map((entry) => [entry.key, entry.Icon]));

export function resolveNoteIcon(key: unknown): Icon {
  if (typeof key === "string" && key in ICON_MAP) {
    return ICON_MAP[key];
  }
  return FileText;
}

export function isNoteIconKey(value: unknown): value is NoteIconKey {
  return typeof value === "string" && value in ICON_MAP;
}
