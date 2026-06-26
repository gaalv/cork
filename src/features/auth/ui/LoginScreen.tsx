/**
 * Login screen — OAuth-only auth following Cork design system.
 * GitHub, Google, and Apple sign-in. No email/password form needed.
 */

import { useState } from "react";

import { CorkLogo } from "@/shared/ui/NoxeLogo";
import { useAuthStore } from "@/features/auth/state/authStore";

function GitHubIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
    </svg>
  );
}

function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function AppleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

export function LoginScreen() {
  const login = useAuthStore((s) => s.login);
  const [loading, setLoading] = useState<string | null>(null);

  const handleOAuth = (provider: string) => {
    setLoading(provider);
    // Simulate OAuth — in v2 this redirects to the real OAuth flow
    setTimeout(() => {
      login(`user@${provider}.com`, "User");
      setLoading(null);
    }, 800);
  };

  return (
    <div className="flex h-full">
      {/* Left panel — charcoal brand surface */}
      <div
        className="hidden w-[420px] shrink-0 flex-col justify-between p-10 lg:flex"
        style={{
          background: "var(--surface-charcoal)",
          boxShadow: "var(--edge-highlight)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex size-10 items-center justify-center rounded-[10px]"
            style={{
              background: "rgba(255,255,255,0.06)",
              boxShadow: "var(--edge-highlight)",
            }}
          >
            <CorkLogo size={22} variant="mono" className="text-[var(--text-on-dark)]" />
          </div>
          <span
            className="font-display text-[20px] tracking-wide"
            style={{ color: "var(--text-on-dark)" }}
          >
            Cork
          </span>
        </div>

        <div>
          <p
            className="font-display max-w-[300px] text-[28px] leading-snug"
            style={{ color: "var(--text-on-dark)", letterSpacing: "0.2px" }}
          >
            Your notes, your way.
          </p>
          <p className="mt-3 max-w-[280px] text-[14px] leading-relaxed text-[var(--text-on-dark-muted)]">
            A quiet space for your thoughts. Local-first, Markdown-native, built for focus.
          </p>
        </div>

        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-on-dark-subtle)]">
          Local-first notes
        </p>
      </div>

      {/* Right panel — OAuth buttons */}
      <div className="flex flex-1 items-center justify-center bg-[var(--color-cork-bg)] p-8">
        <div className="w-full max-w-[360px]">
          {/* Mobile-only logo */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <CorkLogo size={24} />
            <span className="font-display text-[18px] text-[var(--color-cork-ink)]">
              Cork
            </span>
          </div>

          <h1 className="font-display text-[28px] text-[var(--color-cork-ink)]" style={{ letterSpacing: "0.2px" }}>
            Welcome to Cork
          </h1>
          <p className="mt-1.5 text-[14px] text-[var(--color-cork-muted)]">
            Sign in to sync your notes across devices.
          </p>

          <div className="mt-8 space-y-3">
            <button
              onClick={() => handleOAuth("github")}
              disabled={loading !== null}
              className="flex w-full items-center gap-3 rounded-[10px] bg-[var(--color-cork-primary)] px-4 py-2.5 text-[14px] font-medium text-[var(--color-cork-primary-foreground)] transition-transform hover:opacity-90 active:scale-[var(--press-scale)] disabled:opacity-50"
            >
              <GitHubIcon />
              {loading === "github" ? "Connecting..." : "Continue with GitHub"}
            </button>

            <button
              onClick={() => handleOAuth("google")}
              disabled={loading !== null}
              className="flex w-full items-center gap-3 rounded-[10px] border border-[var(--color-cork-border)] bg-[var(--color-cork-panel)] px-4 py-2.5 text-[14px] font-medium text-[var(--color-cork-ink)] transition-transform hover:bg-[var(--color-cork-panel-2)] active:scale-[var(--press-scale)] disabled:opacity-50"
            >
              <GoogleIcon />
              {loading === "google" ? "Connecting..." : "Continue with Google"}
            </button>

            <button
              onClick={() => handleOAuth("apple")}
              disabled={loading !== null}
              className="flex w-full items-center gap-3 rounded-[10px] border border-[var(--color-cork-border)] bg-[var(--color-cork-panel)] px-4 py-2.5 text-[14px] font-medium text-[var(--color-cork-ink)] transition-transform hover:bg-[var(--color-cork-panel-2)] active:scale-[var(--press-scale)] disabled:opacity-50"
            >
              <AppleIcon />
              {loading === "apple" ? "Connecting..." : "Continue with Apple"}
            </button>
          </div>

          <div className="mt-8 flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--color-cork-border)]" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-cork-subtle)]">
              or
            </span>
            <div className="h-px flex-1 bg-[var(--color-cork-border)]" />
          </div>

          <button
            onClick={() => login("local", "Local User")}
            className="mt-6 w-full rounded-[10px] border border-dashed border-[var(--color-cork-border-strong)] px-4 py-2.5 text-[13px] text-[var(--color-cork-muted)] transition-colors hover:border-[var(--color-cork-accent)] hover:text-[var(--color-cork-accent)]"
          >
            Continue without an account
          </button>
          <p className="mt-2 text-center text-[11px] text-[var(--color-cork-subtle)]">
            Notes stay local. You can sign in later to enable sync.
          </p>
        </div>
      </div>
    </div>
  );
}
