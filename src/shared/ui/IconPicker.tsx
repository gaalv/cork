/**
 * IconPicker — grid popover for selecting a Phosphor icon.
 *
 * Used by folder creation/editing to assign an icon.
 * Curated subset of ~80 Phosphor icons organized by category.
 *
 * Uses sub-path imports to avoid loading the full Phosphor barrel (~4500 lines).
 */

import { useState, useMemo } from "react";

// Sub-path imports — each loads only the single icon module
import { FolderSimple } from "@phosphor-icons/react/dist/icons/FolderSimple";
import { Folder } from "@phosphor-icons/react/dist/icons/Folder";
import { FolderStar } from "@phosphor-icons/react/dist/icons/FolderStar";
import { Archive } from "@phosphor-icons/react/dist/icons/Archive";
import { Tray } from "@phosphor-icons/react/dist/icons/Tray";
import { TrayArrowDown } from "@phosphor-icons/react/dist/icons/TrayArrowDown";
import { BookmarkSimple } from "@phosphor-icons/react/dist/icons/BookmarkSimple";
import { Star } from "@phosphor-icons/react/dist/icons/Star";
import { Heart } from "@phosphor-icons/react/dist/icons/Heart";
import { Flag } from "@phosphor-icons/react/dist/icons/Flag";
import { NotePencil } from "@phosphor-icons/react/dist/icons/NotePencil";
import { Note } from "@phosphor-icons/react/dist/icons/Note";
import { Article } from "@phosphor-icons/react/dist/icons/Article";
import { BookOpen } from "@phosphor-icons/react/dist/icons/BookOpen";
import { Notebook } from "@phosphor-icons/react/dist/icons/Notebook";
import { FileText } from "@phosphor-icons/react/dist/icons/FileText";
import { ClipboardText } from "@phosphor-icons/react/dist/icons/ClipboardText";
import { Newspaper } from "@phosphor-icons/react/dist/icons/Newspaper";
import { PencilSimple } from "@phosphor-icons/react/dist/icons/PencilSimple";
import { HighlighterCircle } from "@phosphor-icons/react/dist/icons/HighlighterCircle";
import { Code } from "@phosphor-icons/react/dist/icons/Code";
import { Terminal } from "@phosphor-icons/react/dist/icons/Terminal";
import { GitBranch } from "@phosphor-icons/react/dist/icons/GitBranch";
import { Database } from "@phosphor-icons/react/dist/icons/Database";
import { Bug } from "@phosphor-icons/react/dist/icons/Bug";
import { Cpu } from "@phosphor-icons/react/dist/icons/Cpu";
import { Cloud } from "@phosphor-icons/react/dist/icons/Cloud";
import { Globe } from "@phosphor-icons/react/dist/icons/Globe";
import { Link } from "@phosphor-icons/react/dist/icons/Link";
import { BracketsCurly } from "@phosphor-icons/react/dist/icons/BracketsCurly";
import { Briefcase } from "@phosphor-icons/react/dist/icons/Briefcase";
import { Buildings } from "@phosphor-icons/react/dist/icons/Buildings";
import { Calendar } from "@phosphor-icons/react/dist/icons/Calendar";
import { Clock } from "@phosphor-icons/react/dist/icons/Clock";
import { ChartLineUp } from "@phosphor-icons/react/dist/icons/ChartLineUp";
import { Presentation } from "@phosphor-icons/react/dist/icons/Presentation";
import { Target } from "@phosphor-icons/react/dist/icons/Target";
import { Trophy } from "@phosphor-icons/react/dist/icons/Trophy";
import { Users } from "@phosphor-icons/react/dist/icons/Users";
import { User } from "@phosphor-icons/react/dist/icons/User";
import { Palette } from "@phosphor-icons/react/dist/icons/Palette";
import { Camera } from "@phosphor-icons/react/dist/icons/Camera";
import { MusicNote } from "@phosphor-icons/react/dist/icons/MusicNote";
import { Microphone } from "@phosphor-icons/react/dist/icons/Microphone";
import { FilmStrip } from "@phosphor-icons/react/dist/icons/FilmStrip";
import { PaintBrush } from "@phosphor-icons/react/dist/icons/PaintBrush";
import { FigmaLogo } from "@phosphor-icons/react/dist/icons/FigmaLogo";
import { PenNib } from "@phosphor-icons/react/dist/icons/PenNib";
import { Image } from "@phosphor-icons/react/dist/icons/Image";
import { VideoCamera } from "@phosphor-icons/react/dist/icons/VideoCamera";
import { Atom } from "@phosphor-icons/react/dist/icons/Atom";
import { Flask } from "@phosphor-icons/react/dist/icons/Flask";
import { Dna } from "@phosphor-icons/react/dist/icons/Dna";
import { Brain } from "@phosphor-icons/react/dist/icons/Brain";
import { Lightning } from "@phosphor-icons/react/dist/icons/Lightning";
import { Planet } from "@phosphor-icons/react/dist/icons/Planet";
import { Tree } from "@phosphor-icons/react/dist/icons/Tree";
import { Leaf } from "@phosphor-icons/react/dist/icons/Leaf";
import { Fire } from "@phosphor-icons/react/dist/icons/Fire";
import { Drop } from "@phosphor-icons/react/dist/icons/Drop";
import { House } from "@phosphor-icons/react/dist/icons/House";
import { Gear } from "@phosphor-icons/react/dist/icons/Gear";
import { Key } from "@phosphor-icons/react/dist/icons/Key";
import { Lock } from "@phosphor-icons/react/dist/icons/Lock";
import { Shield } from "@phosphor-icons/react/dist/icons/Shield";
import { Rocket } from "@phosphor-icons/react/dist/icons/Rocket";
import { GameController } from "@phosphor-icons/react/dist/icons/GameController";
import { GraduationCap } from "@phosphor-icons/react/dist/icons/GraduationCap";
import { FirstAid } from "@phosphor-icons/react/dist/icons/FirstAid";
import { ShoppingCart } from "@phosphor-icons/react/dist/icons/ShoppingCart";

import type { Icon as PhosphorIcon } from "@phosphor-icons/react";

// Curated icon registry — organized by category
const ICON_REGISTRY: Record<string, { name: string; icon: PhosphorIcon }[]> = {
  General: [
    { name: "folder-simple", icon: FolderSimple },
    { name: "folder", icon: Folder },
    { name: "folder-star", icon: FolderStar },
    { name: "archive", icon: Archive },
    { name: "tray", icon: Tray },
    { name: "inbox", icon: TrayArrowDown },
    { name: "bookmark", icon: BookmarkSimple },
    { name: "star", icon: Star },
    { name: "heart", icon: Heart },
    { name: "flag", icon: Flag },
  ],
  Content: [
    { name: "note-pencil", icon: NotePencil },
    { name: "note", icon: Note },
    { name: "article", icon: Article },
    { name: "book-open", icon: BookOpen },
    { name: "notebook", icon: Notebook },
    { name: "file-text", icon: FileText },
    { name: "clipboard-text", icon: ClipboardText },
    { name: "newspaper", icon: Newspaper },
    { name: "pencil-simple", icon: PencilSimple },
    { name: "highlighter-circle", icon: HighlighterCircle },
  ],
  Dev: [
    { name: "code", icon: Code },
    { name: "terminal", icon: Terminal },
    { name: "git-branch", icon: GitBranch },
    { name: "database", icon: Database },
    { name: "bug", icon: Bug },
    { name: "cpu", icon: Cpu },
    { name: "cloud", icon: Cloud },
    { name: "globe", icon: Globe },
    { name: "link", icon: Link },
    { name: "brackets-curly", icon: BracketsCurly },
  ],
  Work: [
    { name: "briefcase", icon: Briefcase },
    { name: "buildings", icon: Buildings },
    { name: "calendar", icon: Calendar },
    { name: "clock", icon: Clock },
    { name: "chart-line-up", icon: ChartLineUp },
    { name: "presentation", icon: Presentation },
    { name: "target", icon: Target },
    { name: "trophy", icon: Trophy },
    { name: "users", icon: Users },
    { name: "user", icon: User },
  ],
  Creative: [
    { name: "palette", icon: Palette },
    { name: "camera", icon: Camera },
    { name: "music-note", icon: MusicNote },
    { name: "microphone", icon: Microphone },
    { name: "film-strip", icon: FilmStrip },
    { name: "paint-brush", icon: PaintBrush },
    { name: "figma-logo", icon: FigmaLogo },
    { name: "pen-nib", icon: PenNib },
    { name: "image", icon: Image },
    { name: "video-camera", icon: VideoCamera },
  ],
  Science: [
    { name: "atom", icon: Atom },
    { name: "flask", icon: Flask },
    { name: "dna", icon: Dna },
    { name: "brain", icon: Brain },
    { name: "lightning", icon: Lightning },
    { name: "planet", icon: Planet },
    { name: "tree", icon: Tree },
    { name: "leaf", icon: Leaf },
    { name: "fire", icon: Fire },
    { name: "drop", icon: Drop },
  ],
  Misc: [
    { name: "house", icon: House },
    { name: "gear", icon: Gear },
    { name: "key", icon: Key },
    { name: "lock", icon: Lock },
    { name: "shield", icon: Shield },
    { name: "rocket", icon: Rocket },
    { name: "game-controller", icon: GameController },
    { name: "graduation-cap", icon: GraduationCap },
    { name: "first-aid", icon: FirstAid },
    { name: "shopping-cart", icon: ShoppingCart },
  ],
};

// Flat list for search
const ALL_ICONS = Object.values(ICON_REGISTRY).flat();

export function getIconComponent(name: string): PhosphorIcon | null {
  return ALL_ICONS.find((i) => i.name === name)?.icon ?? null;
}

export function IconPicker({
  value,
  onChange,
  onClose,
}: {
  value: string | null;
  onChange: (iconName: string | null) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return ICON_REGISTRY;
    const q = search.toLowerCase();
    const result: Record<string, { name: string; icon: PhosphorIcon }[]> = {};
    for (const [category, icons] of Object.entries(ICON_REGISTRY)) {
      const matches = icons.filter((i) => i.name.includes(q));
      if (matches.length > 0) result[category] = matches;
    }
    return result;
  }, [search]);

  return (
    <div className="w-64 rounded-lg border border-[var(--color-cork-border)] bg-[var(--color-cork-panel)] p-2 shadow-xl">
      <input
        autoFocus
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
        placeholder="Search icons…"
        className="mb-2 w-full rounded-md border border-[var(--color-cork-border)] bg-[var(--color-cork-panel-2)] px-2 py-1 text-xs outline-none placeholder:text-[var(--color-cork-subtle)] focus:border-[var(--color-cork-accent)]"
      />
      {value && (
        <button
          onClick={() => {
            onChange(null);
            onClose();
          }}
          className="mb-2 w-full rounded-md px-2 py-1 text-left text-[11px] text-[var(--color-cork-muted)] hover:bg-[var(--color-cork-panel-2)]"
        >
          Remove icon
        </button>
      )}
      <div className="max-h-48 overflow-y-auto">
        {Object.entries(filtered).map(([category, icons]) => (
          <div key={category} className="mb-2">
            <p className="mb-1 px-1 text-[9px] font-semibold uppercase tracking-wider text-[var(--color-cork-subtle)]">
              {category}
            </p>
            <div className="grid grid-cols-5 gap-0.5">
              {icons.map((item) => {
                const Icon = item.icon;
                const isSelected = value === item.name;
                return (
                  <button
                    key={item.name}
                    onClick={() => {
                      onChange(item.name);
                      onClose();
                    }}
                    title={item.name}
                    className={`flex items-center justify-center rounded-md p-1.5 ${
                      isSelected
                        ? "bg-[var(--color-cork-accent-soft)] text-[var(--color-cork-accent)]"
                        : "text-[var(--color-cork-muted)] hover:bg-[var(--color-cork-panel-2)] hover:text-[var(--color-cork-ink)]"
                    }`}
                  >
                    <Icon size={16} />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
