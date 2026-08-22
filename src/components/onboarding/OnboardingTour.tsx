/**
 * First-run tour — spotlight overlay with step-by-step cards.
 *
 * The dimming is a single SVG path with an even-odd fill rather than four
 * positioned divs, so the cutout stays exact at any size and the corners round
 * correctly. Pointer events pass through nothing: the tour is modal on purpose,
 * so a click cannot land on a half-explained control.
 */

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { useDragRegion } from "@/hooks/useDragRegion";
import { cn } from "@/utils/cn";

import { TOUR_STEPS, type TourStep } from "./tourSteps";
import { useTourTarget, type Rect } from "./useTourTarget";

const PADDING = 6;
const CARD_WIDTH = 320;
const GAP = 14;

function spotlightPath(rect: Rect | null): string {
  const outer = `M0,0 H${window.innerWidth} V${window.innerHeight} H0 Z`;
  if (!rect) return outer;
  const t = rect.top - PADDING;
  const l = rect.left - PADDING;
  const w = rect.width + PADDING * 2;
  const h = rect.height + PADDING * 2;
  const r = Math.min(10, w / 2, h / 2);
  // Reverse-wound rounded rect — with fill-rule="evenodd" this becomes a hole.
  return (
    `${outer} M${l + r},${t} H${l + w - r} A${r},${r} 0 0 1 ${l + w},${t + r} ` +
    `V${t + h - r} A${r},${r} 0 0 1 ${l + w - r},${t + h} H${l + r} ` +
    `A${r},${r} 0 0 1 ${l},${t + h - r} V${t + r} A${r},${r} 0 0 1 ${l + r},${t} Z`
  );
}

function cardPosition(step: TourStep, rect: Rect | null) {
  if (!rect || step.placement === "center" || !step.placement) {
    return {
      top: Math.max(24, window.innerHeight / 2 - 120),
      left: Math.max(24, window.innerWidth / 2 - CARD_WIDTH / 2),
    };
  }

  const clampTop = (value: number) => Math.min(Math.max(24, value), window.innerHeight - 220);
  const clampLeft = (value: number) =>
    Math.min(Math.max(24, value), window.innerWidth - CARD_WIDTH - 24);

  switch (step.placement) {
    case "right":
      return { top: clampTop(rect.top), left: clampLeft(rect.left + rect.width + GAP) };
    case "left":
      return { top: clampTop(rect.top), left: clampLeft(rect.left - CARD_WIDTH - GAP) };
    case "top":
      return { top: clampTop(rect.top - 200), left: clampLeft(rect.left) };
    default:
      return { top: clampTop(rect.top + rect.height + GAP), left: clampLeft(rect.left) };
  }
}

export function OnboardingTour({ onFinish }: { onFinish: () => void }) {
  const [index, setIndex] = useState(0);
  // The overlay sits above the window's drag regions, which would otherwise
  // trap the window in place for the length of the tour. Dragging the dimmed
  // backdrop moves it, exactly like dragging the app chrome underneath.
  const dragRef = useDragRegion<HTMLDivElement>();
  const [steps, setSteps] = useState<TourStep[]>(TOUR_STEPS);

  // Drop steps whose target never mounted, so the tour cannot point at nothing.
  // This has to run in an effect, not during render: the tour is committed in
  // the same pass as the columns it points at, so querying the DOM while
  // rendering finds none of them and would silently skip most of the tour.
  useEffect(() => {
    setSteps(
      TOUR_STEPS.filter((s) => !s.target || document.querySelector(`[data-tour="${s.target}"]`)),
    );
  }, []);

  const step = steps[Math.min(index, steps.length - 1)];
  const rect = useTourTarget(step?.target ?? null);

  const next = useCallback(() => {
    // The finish call has to happen outside the updater: a state updater must
    // be pure, and calling the parent's setState from inside one updates a
    // different component mid-render.
    if (index >= steps.length - 1) {
      onFinish();
      return;
    }
    setIndex((i) => i + 1);
  }, [index, steps.length, onFinish]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onFinish();
      } else if (e.key === "Enter" || e.key === "ArrowRight") {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [next, onFinish]);

  if (!step) return null;

  const pos = cardPosition(step, rect);
  const isLast = index === steps.length - 1;

  return createPortal(
    <div
      className="fixed inset-0 z-[10000]"
      role="dialog"
      aria-modal="true"
      aria-label="Product tour"
    >
      {/* The drag handler needs an HTMLElement target, so the SVG is wrapped
          rather than carrying the ref itself. */}
      <div ref={dragRef} className="absolute inset-0">
        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
          <path d={spotlightPath(rect)} fillRule="evenodd" fill="rgba(0,0,0,0.62)" />
        </svg>
      </div>

      <div
        className={cn(
          "absolute rounded-xl border border-[var(--color-cork-border)]",
          "bg-[var(--color-cork-panel)] p-4 shadow-[var(--shadow-lg)]",
        )}
        style={{ top: pos.top, left: pos.left, width: CARD_WIDTH }}
      >
        <div className="text-[14px] font-semibold text-[var(--color-cork-ink)]">{step.title}</div>
        <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--color-cork-muted)]">
          {step.body}
        </p>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-1.5" aria-hidden>
            {steps.map((s, i) => (
              <span
                key={s.id}
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-colors",
                  i === index
                    ? "bg-[var(--color-cork-accent)]"
                    : "bg-[var(--color-cork-border-strong)]",
                )}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onFinish}
              className="rounded-md px-2 py-1 text-[12px] text-[var(--color-cork-muted)] hover:text-[var(--color-cork-ink)]"
            >
              Skip
            </button>
            <button
              onClick={next}
              autoFocus
              className={cn(
                "rounded-full bg-[var(--color-cork-ink)] px-3.5 py-1.5",
                "text-[12px] font-medium text-[var(--color-cork-primary-foreground)] hover:opacity-90",
              )}
            >
              {isLast ? "Got it" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
