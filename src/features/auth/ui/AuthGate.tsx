/**
 * AuthGate — renders login screen when not authenticated,
 * or children when the user is signed in.
 */

import { useAuthStore } from "@/features/auth/state/authStore";
import { LoginScreen } from "./LoginScreen";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return <>{children}</>;
}
