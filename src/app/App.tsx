import { Shell } from "@/screens/Shell";
import { AuthGate } from "@/components/auth/AuthGate";

/**
 * Root app component. AuthGate wraps the shell — unauthenticated users
 * see login/register screens; authenticated users enter the app.
 */
export function App() {
  return (
    <div className="flex h-full flex-col">
      <AuthGate>
        <Shell />
      </AuthGate>
    </div>
  );
}

export default App;
