import { useEffect } from "react";

import { useAiStatsStore } from "@/features/ai/state/aiStatsStore";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTokens(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

export function AiUsageSection() {
  const stats = useAiStatsStore((s) => s.stats);
  const loading = useAiStatsStore((s) => s.loading);
  const error = useAiStatsStore((s) => s.error);
  const refresh = useAiStatsStore((s) => s.refresh);
  const clearTelemetry = useAiStatsStore((s) => s.clearTelemetry);
  const clearCache = useAiStatsStore((s) => s.clearCache);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="rounded-xl border border-[var(--color-noxe-border)] bg-[var(--color-noxe-surface)] p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-medium text-[var(--color-noxe-text)]">Usage</h3>
        <button
          type="button"
          className="text-xs text-[var(--color-noxe-muted)] hover:text-[var(--color-noxe-text)]"
          onClick={() => void refresh()}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error ? (
        <div className="text-xs text-[var(--color-noxe-danger,#dc2626)]" role="alert">
          {error}
        </div>
      ) : null}

      <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <Stat label="Calls" value={stats?.callsTotal ?? 0} />
        <Stat
          label="Cache hit rate"
          value={`${Math.round((stats?.cacheHitRate ?? 0) * 100)}%`}
        />
        <Stat label="Tokens in" value={formatTokens(stats?.tokensIn ?? 0)} />
        <Stat label="Tokens out" value={formatTokens(stats?.tokensOut ?? 0)} />
        <Stat label="Cache rows" value={stats?.cacheRows ?? 0} />
        <Stat label="Cache size" value={formatBytes(stats?.cacheBytes ?? 0)} />
      </dl>

      {stats && stats.bySkill.length > 0 ? (
        <div className="mt-4">
          <div className="mb-1 text-xs font-medium text-[var(--color-noxe-muted)]">By skill</div>
          <table className="w-full text-xs">
            <thead className="text-[var(--color-noxe-muted)]">
              <tr>
                <th className="text-left font-normal">Skill</th>
                <th className="text-right font-normal">Calls</th>
                <th className="text-right font-normal">Tokens</th>
              </tr>
            </thead>
            <tbody>
              {stats.bySkill.map((row) => (
                <tr key={row.skillId} className="border-t border-[var(--color-noxe-border)]">
                  <td className="py-1">{row.skillId}</td>
                  <td className="py-1 text-right tabular-nums">{row.calls}</td>
                  <td className="py-1 text-right tabular-nums">{formatTokens(row.tokens)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md border border-[var(--color-noxe-border)] px-2 py-1 text-xs hover:bg-[var(--color-noxe-hover)]"
          onClick={() => void clearTelemetry()}
        >
          Clear telemetry
        </button>
        <button
          type="button"
          className="rounded-md border border-[var(--color-noxe-border)] px-2 py-1 text-xs hover:bg-[var(--color-noxe-hover)]"
          onClick={() => void clearCache()}
        >
          Clear cache
        </button>
      </div>

      <p className="mt-3 text-[11px] text-[var(--color-noxe-muted)]">
        Token counts are approximations (bytes ÷ 4). Cache is keyed by skill + prompt hash —
        identical inputs never re-spend tokens.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-[var(--color-noxe-muted)]">{label}</dt>
      <dd className="text-sm font-medium tabular-nums text-[var(--color-noxe-text)]">{value}</dd>
    </div>
  );
}
