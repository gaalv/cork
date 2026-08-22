/**
 * One model choice: a free-text field with suggestions and a test button.
 *
 * Free text is the point. No supported CLI can enumerate its own models, so a
 * closed menu would go stale the moment a provider renames something — which
 * is the failure this is meant to avoid. The suggestions are a convenience;
 * the test button is the only real verification available, since the only way
 * to know a name works is to run it.
 */

import { useState } from "react";
import { Check, Warning } from "@phosphor-icons/react";

import { client } from "@/ipc/client";
import { cn } from "@/utils/cn";

import type { ModelChoice, ModelTestResult } from "@/ipc/types";

export function ModelField({
  label,
  description,
  provider,
  value,
  suggestions,
  onChange,
}: {
  label: string;
  description: string;
  provider: string;
  value: string;
  suggestions: ModelChoice[];
  onChange: (value: string) => void;
}) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<ModelTestResult | null>(null);
  const listId = `models-${provider}-${label}`;

  const test = async () => {
    setTesting(true);
    setResult(null);
    try {
      setResult((await client.ai.testModel(provider, value)) as ModelTestResult);
    } catch (err) {
      setResult({ ok: false, message: String(err) });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="rounded-lg border border-[var(--color-cork-border)] px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-medium">{label}</div>
          <div className="text-[11px] text-[var(--color-cork-muted)]">{description}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <input
            value={value}
            list={listId}
            onChange={(e) => {
              onChange(e.target.value);
              setResult(null);
            }}
            placeholder="Provider default"
            spellCheck={false}
            className="w-44 rounded-md border border-[var(--color-cork-border)] bg-[var(--color-cork-panel-2)] px-2 py-1 font-mono text-[12px] text-[var(--color-cork-ink)] placeholder:font-sans placeholder:text-[var(--color-cork-subtle)]"
          />
          <datalist id={listId}>
            {suggestions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </datalist>
          <button
            onClick={() => void test()}
            disabled={testing}
            className="rounded-md border border-[var(--color-cork-border)] px-2 py-1 text-[11px] text-[var(--color-cork-muted)] hover:text-[var(--color-cork-ink)] disabled:opacity-50"
          >
            {testing ? "Testing…" : "Test"}
          </button>
        </div>
      </div>

      {result && (
        <div
          className={cn(
            "mt-2 flex items-start gap-1.5 rounded-md px-2 py-1.5 text-[11px] leading-snug",
            result.ok
              ? "bg-[var(--color-cork-success-tint)] text-[var(--color-cork-success)]"
              : "bg-[var(--color-cork-danger-tint)] text-[var(--color-cork-danger)]",
          )}
        >
          {result.ok ? (
            <Check size={12} weight="bold" className="mt-0.5 shrink-0" />
          ) : (
            <Warning size={12} weight="bold" className="mt-0.5 shrink-0" />
          )}
          <span className="min-w-0 break-words">
            {result.ok ? `Works — replied “${result.message}”` : result.message}
          </span>
        </div>
      )}
    </div>
  );
}
