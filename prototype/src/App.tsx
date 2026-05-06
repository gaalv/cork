import { useEffect, useState } from 'react'
import { LayoutThreePane } from './layouts/LayoutThreePane'
import { LayoutSidebarTabs } from './layouts/LayoutSidebarTabs'
import { LayoutMinimalCommand } from './layouts/LayoutMinimalCommand'

type LayoutKey = 'three-pane' | 'sidebar-tabs' | 'minimal-command'

const layouts: { id: LayoutKey; label: string; subtitle: string }[] = [
  { id: 'three-pane', label: 'A · Three-Pane', subtitle: 'Inkdrop-style' },
  { id: 'sidebar-tabs', label: 'B · Sidebar + Tabs', subtitle: 'Obsidian / VSCode-style' },
  { id: 'minimal-command', label: 'C · Minimal + Command', subtitle: 'Tolaria-inspired' },
]

export default function App() {
  const [active, setActive] = useState<LayoutKey>(() => {
    return (localStorage.getItem('noxe.layout') as LayoutKey) || 'three-pane'
  })

  useEffect(() => {
    localStorage.setItem('noxe.layout', active)
  }, [active])

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] px-4">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold tracking-tight">
          <span className="rounded bg-[var(--color-noxe-ink)] px-1.5 py-0.5 text-[10px] uppercase text-white">
            Proto
          </span>
          <span>Noxe — layout playground</span>
        </div>
        <nav className="ml-4 flex items-center gap-1 rounded-lg bg-[var(--color-noxe-panel-2)] p-1 text-[12px]">
          {layouts.map((l) => (
            <button
              key={l.id}
              onClick={() => setActive(l.id)}
              className={`rounded-md px-3 py-1 transition ${
                active === l.id
                  ? 'bg-white text-[var(--color-noxe-ink)] shadow-sm'
                  : 'text-[var(--color-noxe-muted)] hover:text-[var(--color-noxe-ink)]'
              }`}
            >
              <span className="font-medium">{l.label}</span>
              <span className="ml-1.5 text-[var(--color-noxe-subtle)]">· {l.subtitle}</span>
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 text-[11px] text-[var(--color-noxe-muted)]">
          <span>Tema claro · Mock data</span>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        {active === 'three-pane' && <LayoutThreePane />}
        {active === 'sidebar-tabs' && <LayoutSidebarTabs />}
        {active === 'minimal-command' && <LayoutMinimalCommand />}
      </div>
    </div>
  )
}
