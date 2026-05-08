import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode } from "react";

export type SplitterPanel = {
  id: string;
  size: number | "fill";
  min?: number;
  max?: number;
};

export type SplitterProps = {
  panels: SplitterPanel[];
  onResize?: (sizes: Record<string, number>) => void;
  className?: string;
  children: ReactNode[];
  handleClassName?: string;
  step?: number;
};

const DEFAULT_STEP = 16;

export function Splitter({
  panels,
  onResize,
  className,
  children,
  handleClassName,
  step = DEFAULT_STEP,
}: SplitterProps) {
  if (panels.length !== children.length) {
    throw new Error(`Splitter expects ${panels.length} children, got ${children.length}`);
  }

  const initialSizes = useMemo(
    () => panels.map((panel) => (panel.size === "fill" ? 0 : panel.size)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [sizes, setSizes] = useState<number[]>(initialSizes);
  const sizesRef = useRef(sizes);
  sizesRef.current = sizes;

  const containerRef = useRef<HTMLDivElement>(null);

  const commit = useCallback(
    (next: number[]) => {
      setSizes(next);
      if (!onResize) return;
      const payload: Record<string, number> = {};
      panels.forEach((panel, idx) => {
        if (panel.size !== "fill") payload[panel.id] = next[idx];
      });
      onResize(payload);
    },
    [onResize, panels],
  );

  const resizeHandle = useCallback(
    (handleIndex: number, deltaPx: number) => {
      // Handle between panel handleIndex and handleIndex+1.
      const left = panels[handleIndex];
      const right = panels[handleIndex + 1];
      const next = [...sizesRef.current];
      if (left.size !== "fill") {
        const proposed = next[handleIndex] + deltaPx;
        const clamped = Math.min(Math.max(proposed, left.min ?? 0), left.max ?? Infinity);
        next[handleIndex] = clamped;
      } else if (right.size !== "fill") {
        const proposed = next[handleIndex + 1] - deltaPx;
        const clamped = Math.min(Math.max(proposed, right.min ?? 0), right.max ?? Infinity);
        next[handleIndex + 1] = clamped;
      }
      commit(next);
    },
    [commit, panels],
  );

  const onPointerDown = useCallback(
    (handleIndex: number) => (event: PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startX = event.clientX;
      const startSizes = [...sizesRef.current];
      const target = event.currentTarget;
      target.setPointerCapture(event.pointerId);

      const onMove = (moveEvent: globalThis.PointerEvent) => {
        const delta = moveEvent.clientX - startX;
        const left = panels[handleIndex];
        const right = panels[handleIndex + 1];
        const next = [...startSizes];
        if (left.size !== "fill") {
          const proposed = startSizes[handleIndex] + delta;
          const clamped = Math.min(Math.max(proposed, left.min ?? 0), left.max ?? Infinity);
          next[handleIndex] = clamped;
        } else if (right.size !== "fill") {
          const proposed = startSizes[handleIndex + 1] - delta;
          const clamped = Math.min(Math.max(proposed, right.min ?? 0), right.max ?? Infinity);
          next[handleIndex + 1] = clamped;
        }
        setSizes(next);
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        try {
          target.releasePointerCapture(event.pointerId);
        } catch {
          // ignore
        }
        commit(sizesRef.current);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [commit, panels],
  );

  const onKeyDown = useCallback(
    (handleIndex: number) => (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        resizeHandle(handleIndex, -step);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        resizeHandle(handleIndex, step);
      }
    },
    [resizeHandle, step],
  );

  // Sync sizes if panels.size changes externally (e.g. settings restore).
  useEffect(() => {
    setSizes(
      panels.map((panel, idx) =>
        panel.size === "fill" ? (sizesRef.current[idx] ?? 0) : panel.size,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panels.map((p) => `${p.id}:${p.size}`).join("|")]);

  const gridTemplate = panels
    .map((panel, idx) => {
      if (panel.size === "fill") return "minmax(0, 1fr)";
      return `${sizes[idx]}px`;
    })
    .reduce((acc, value, idx) => {
      if (idx === 0) return value;
      return `${acc} 1px ${value}`;
    }, "");

  const style: CSSProperties = {
    display: "grid",
    gridTemplateColumns: gridTemplate,
    height: "100%",
    minHeight: 0,
    width: "100%",
  };

  return (
    <div ref={containerRef} className={className} style={style} data-testid="splitter">
      {panels.flatMap((panel, idx) => {
        const node = (
          <div key={panel.id} style={{ minWidth: 0, minHeight: 0, overflow: "hidden" }}>
            {children[idx]}
          </div>
        );
        if (idx === panels.length - 1) return [node];
        return [
          node,
          <div
            key={`handle-${idx}`}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize panel"
            tabIndex={0}
            onPointerDown={onPointerDown(idx)}
            onKeyDown={onKeyDown(idx)}
            className={
              handleClassName ??
              "relative cursor-col-resize bg-[var(--color-noxe-border)] transition-colors hover:bg-[var(--color-noxe-accent)] focus-visible:bg-[var(--color-noxe-ring)] focus-visible:outline-none after:absolute after:inset-y-0 after:-left-1 after:-right-1 after:content-['']"
            }
            data-testid={`splitter-handle-${idx}`}
            style={{ width: 1 }}
          />,
        ];
      })}
    </div>
  );
}
