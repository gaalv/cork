/**
 * Inspector — right panel with note metadata, tags, outline, and AI actions.
 *
 * @see F32 — Inspector redesign spec
 */

import { OutlineSection } from "./inspector/OutlineSection";
import { TagsSection } from "./inspector/TagsSection";
import { PropertiesSection } from "./inspector/PropertiesSection";
import { BacklinksSection } from "./inspector/BacklinksSection";
import { AiSection } from "./inspector/AiSection";

export function Inspector({ noteMtime }: { noteMtime: number }) {
  return (
    <aside className="flex h-full flex-col overflow-y-auto border-l border-[var(--color-cork-border)] bg-[var(--color-cork-panel)] px-4 py-4">
      <div className="flex flex-col gap-5">
        <OutlineSection />
        <TagsSection />
        <PropertiesSection noteMtime={noteMtime} />
        <BacklinksSection />
        <AiSection />
      </div>
    </aside>
  );
}
