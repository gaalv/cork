import { useAppSettingsStore } from "@/features/settings/state/appSettingsStore";
import { Splitter } from "@/features/shell/ui/Splitter";
import { ViewRouter } from "@/features/shell/ui/ViewRouter";

import { ListPane } from "./ListPane";
import { NavPane } from "./NavPane";

export function TriageBody() {
  const navWidth = useAppSettingsStore((state) => state.settings.layout.triageNavWidth);
  const listWidth = useAppSettingsStore((state) => state.settings.layout.triageListWidth);
  const setTriageWidths = useAppSettingsStore((state) => state.setTriageWidths);

  return (
    <div data-testid="triage-body" className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
      <Splitter
        panels={[
          { id: "nav", size: navWidth, min: 180, max: 360 },
          { id: "list", size: listWidth, min: 240, max: 480 },
          { id: "view", size: "fill" },
        ]}
        onResize={(sizes) => {
          void setTriageWidths({ nav: sizes.nav, list: sizes.list });
        }}
      >
        <NavPane />
        <ListPane />
        <ViewRouter />
      </Splitter>
    </div>
  );
}
