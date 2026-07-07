/**
 * Inspector — right panel with note metadata, tags, outline, and AI actions.
 *
 * @see F32 — Inspector redesign spec
 */

import { OutlineSection } from "./OutlineSection";
import { TagsSection } from "./TagsSection";
import { PropertiesSection } from "./PropertiesSection";
import { BacklinksSection } from "./BacklinksSection";
import { AiSection } from "./AiSection";
import { HistorySection } from "./HistorySection";

export function Inspector({ noteMtime }: { noteMtime: number }) {
  return (
    <aside
      style={{ paddingTop: "var(--density-card-py)", paddingBottom: "var(--density-card-py)" }}
      className="flex h-full flex-col overflow-y-auto border-l border-[var(--color-cork-border)] bg-[var(--color-cork-panel)] px-4"
    >
      <div style={{ gap: "var(--density-section-gap)" }} className="flex flex-col">
        <OutlineSection />
        <TagsSection />
        <PropertiesSection noteMtime={noteMtime} />
        <BacklinksSection />
        <AiSection />
        <HistorySection />
      </div>
    </aside>
  );
}
