import { Facet } from "@codemirror/state";

export type LiveMode = "live" | "source";

export const liveModeFacet = Facet.define<LiveMode, LiveMode>({
  combine: (values) => values[0] ?? "live",
});
