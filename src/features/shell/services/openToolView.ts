import { useAppSettingsStore } from "@/features/settings/state/appSettingsStore";
import { useShellStore } from "@/features/shell/state/shellStore";
import {
  useTriageOverlayStore,
  type TriageOverlayKind,
} from "@/features/shell/state/triageOverlayStore";

export function openToolView(kind: TriageOverlayKind) {
  const layoutMode = useAppSettingsStore.getState().settings.layout.mode;
  if (layoutMode === "triage") {
    useTriageOverlayStore.getState().open(kind);
    return;
  }
  useShellStore.getState().navigate({ kind });
}

export function toggleToolView(kind: TriageOverlayKind) {
  const layoutMode = useAppSettingsStore.getState().settings.layout.mode;
  if (layoutMode === "triage") {
    useTriageOverlayStore.getState().toggle(kind);
    return;
  }
  const view = useShellStore.getState().view;
  if (view.kind === kind) {
    useShellStore.getState().navigate({ kind: "home" });
  } else {
    useShellStore.getState().navigate({ kind });
  }
}
