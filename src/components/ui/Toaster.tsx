/**
 * Toast host.
 *
 * Sonner defaults to its own light palette, so toasts stayed white-on-red in
 * dark mode. This follows Cork's resolved theme and maps Sonner's CSS
 * variables onto Cork tokens, so toasts match the app in both themes.
 */

import { Toaster as SonnerToaster } from "sonner";

import { useThemeMode } from "@/hooks/useThemeMode";

import type { CSSProperties } from "react";

const TOAST_TOKENS = {
  "--normal-bg": "var(--color-cork-panel)",
  "--normal-text": "var(--color-cork-ink)",
  "--normal-border": "var(--color-cork-border)",
  "--error-bg": "var(--color-cork-danger-tint)",
  "--error-text": "var(--color-cork-danger)",
  "--error-border": "var(--color-cork-danger)",
  "--success-bg": "var(--color-cork-success-tint)",
  "--success-text": "var(--color-cork-success)",
  "--success-border": "var(--color-cork-success)",
  "--warning-bg": "var(--color-cork-panel-2)",
  "--warning-text": "var(--color-cork-ink)",
  "--warning-border": "var(--color-cork-border-strong)",
  "--info-bg": "var(--color-cork-panel-2)",
  "--info-text": "var(--color-cork-ink)",
  "--info-border": "var(--color-cork-border)",
} as CSSProperties;

export function Toaster() {
  const theme = useThemeMode();

  return (
    <SonnerToaster
      position="bottom-right"
      theme={theme}
      richColors
      closeButton
      style={TOAST_TOKENS}
      toastOptions={{
        style: {
          fontFamily: "var(--font-sans)",
          fontSize: "13px",
          borderRadius: "10px",
          boxShadow: "var(--shadow-lg)",
        },
      }}
    />
  );
}
