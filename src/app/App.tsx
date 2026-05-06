import { Shell } from "@/features/shell";

/**
 * Root app component. Currently renders the migrated Layout C as a single
 * legacy bundle; subsequent features (F04+) will progressively replace
 * `_legacy/LayoutMinimalCommand` with proper shell/home/note-view modules.
 */
export function App() {
  return (
    <div className="flex h-full flex-col">
      <Shell />
    </div>
  );
}

export default App;
