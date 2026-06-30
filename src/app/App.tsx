import { Shell } from "@/screens/Shell";

/**
 * Root app component. v1 is offline-first with no auth —
 * users go straight to the Shell (which shows WelcomeScreen if no vault is open).
 * AuthGate + LoginScreen are preserved for v2 when accounts/sync ship.
 */
export function App() {
  return (
    <div className="flex h-full flex-col">
      <Shell />
    </div>
  );
}

export default App;
