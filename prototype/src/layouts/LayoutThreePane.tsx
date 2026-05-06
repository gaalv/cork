import { useState } from 'react'
import {
  MagnifyingGlass,
  Notebook,
  Hash,
  Plus,
  CaretRight,
  CaretDown,
  Star,
  ClockCounterClockwise,
  Tag,
  DotsThreeVertical,
  ArrowsClockwise,
  Pencil,
  Eye,
  Link as LinkIcon,
} from '@phosphor-icons/react'
import { folders, notes, tags } from '../data/mock'
import { MockMarkdown } from '../components/MockMarkdown'

export function LayoutThreePane() {
  const [activeId, setActiveId] = useState(notes[0].id)
  const active = notes.find((n) => n.id === activeId)!
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ projects: true })

  return (
    <div className="grid h-full grid-cols-[260px_340px_1fr] bg-[var(--color-noxe-bg)]">
      {/* Sidebar */}
      <aside className="flex h-full flex-col border-r border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)]">
        <div className="flex h-12 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-md bg-[var(--color-noxe-accent)] text-white">
              <Notebook size={14} weight="fill" />
            </div>
            <span className="text-sm font-semibold tracking-tight">Noxe</span>
            <span className="rounded bg-[var(--color-noxe-panel-2)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-noxe-muted)]">
              vault
            </span>
          </div>
          <button className="rounded p-1 text-[var(--color-noxe-muted)] hover:bg-[var(--color-noxe-panel-2)]">
            <ArrowsClockwise size={14} />
          </button>
        </div>

        <div className="px-3 pb-3">
          <button className="flex w-full items-center gap-2 rounded-md bg-[var(--color-noxe-accent)] px-2.5 py-1.5 text-sm font-medium text-white shadow-sm hover:opacity-95">
            <Plus size={14} weight="bold" />
            Nova nota
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-4 text-sm">
          <SidebarSection title="Atalhos">
            <SidebarRow icon={<Star size={14} />} label="Favoritos" />
            <SidebarRow icon={<ClockCounterClockwise size={14} />} label="Recentes" />
            <SidebarRow icon={<Hash size={14} />} label="Inbox" badge="4" active />
          </SidebarSection>

          <SidebarSection title="Notebooks">
            {folders.map((f) => {
              const isParent = f.id === 'projects'
              const open = expanded[f.id]
              const indent = f.id.includes('/')
              if (indent) {
                if (!expanded.projects) return null
                return (
                  <button
                    key={f.id}
                    className="ml-5 flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[var(--color-noxe-ink)] hover:bg-[var(--color-noxe-panel-2)]"
                  >
                    <span className="size-4" />
                    <span className="truncate">{f.name.split('/').pop()}</span>
                    <span className="ml-auto text-xs text-[var(--color-noxe-subtle)]">{f.count}</span>
                  </button>
                )
              }
              return (
                <button
                  key={f.id}
                  onClick={() => isParent && setExpanded((e) => ({ ...e, [f.id]: !e[f.id] }))}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-[var(--color-noxe-panel-2)]"
                >
                  {isParent ? (
                    open ? (
                      <CaretDown size={12} className="text-[var(--color-noxe-muted)]" />
                    ) : (
                      <CaretRight size={12} className="text-[var(--color-noxe-muted)]" />
                    )
                  ) : (
                    <span className="size-3" />
                  )}
                  <Notebook size={14} className="text-[var(--color-noxe-muted)]" />
                  <span className="truncate">{f.name}</span>
                  <span className="ml-auto text-xs text-[var(--color-noxe-subtle)]">{f.count}</span>
                </button>
              )
            })}
          </SidebarSection>

          <SidebarSection title="Tags">
            {tags.map((t) => (
              <button
                key={t.id}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-[var(--color-noxe-panel-2)]"
              >
                <Tag size={14} className="text-[var(--color-noxe-tag)]" />
                <span className="truncate">{t.name}</span>
                <span className="ml-auto text-xs text-[var(--color-noxe-subtle)]">{t.count}</span>
              </button>
            ))}
          </SidebarSection>
        </nav>

        <div className="border-t border-[var(--color-noxe-border)] px-3 py-2 text-xs text-[var(--color-noxe-muted)]">
          <div className="flex items-center justify-between">
            <span>~/notes/personal</span>
            <span>137 notas</span>
          </div>
        </div>
      </aside>

      {/* Notes list */}
      <section className="flex h-full flex-col border-r border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)]">
        <div className="flex h-12 items-center gap-2 border-b border-[var(--color-noxe-border)] px-3">
          <div className="flex flex-1 items-center gap-2 rounded-md bg-[var(--color-noxe-panel-2)] px-2.5 py-1.5">
            <MagnifyingGlass size={14} className="text-[var(--color-noxe-muted)]" />
            <input
              placeholder="Pesquisar nesta nota e em todo o vault…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--color-noxe-subtle)]"
            />
            <kbd className="rounded border border-[var(--color-noxe-border)] bg-white px-1 text-[10px] font-medium text-[var(--color-noxe-muted)]">⌘K</kbd>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 pb-2 pt-3 text-xs text-[var(--color-noxe-muted)]">
          <span>Inbox · 4 notas</span>
          <button className="hover:text-[var(--color-noxe-ink)]">Atualizado ▾</button>
        </div>

        <ul className="flex-1 overflow-y-auto">
          {notes.map((n) => {
            const isActive = n.id === activeId
            return (
              <li key={n.id}>
                <button
                  onClick={() => setActiveId(n.id)}
                  className={`flex w-full flex-col gap-1 border-l-2 px-4 py-3 text-left transition ${
                    isActive
                      ? 'border-[var(--color-noxe-accent)] bg-[var(--color-noxe-accent-soft)]'
                      : 'border-transparent hover:bg-[var(--color-noxe-panel-2)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate text-sm font-medium text-[var(--color-noxe-ink)]">{n.title}</span>
                    <span className="text-[11px] text-[var(--color-noxe-subtle)]">{n.updatedAt.slice(11)}</span>
                  </div>
                  <p className="line-clamp-2 text-[13px] text-[var(--color-noxe-muted)]">{n.excerpt}</p>
                  <div className="flex items-center gap-1.5">
                    {n.tags.map((t) => (
                      <span key={t} className="rounded bg-[var(--color-noxe-tag-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-noxe-tag)]">
                        #{t}
                      </span>
                    ))}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      {/* Editor */}
      <main className="flex h-full flex-col bg-[var(--color-noxe-panel)]">
        <div className="flex h-12 items-center justify-between border-b border-[var(--color-noxe-border)] px-5 text-sm text-[var(--color-noxe-muted)]">
          <div className="flex items-center gap-2">
            <span>{active.folder}</span>
            <span>/</span>
            <span className="text-[var(--color-noxe-ink)]">{active.path.split('/').pop()}</span>
          </div>
          <div className="flex items-center gap-1">
            <IconBtn icon={<Pencil size={14} />} label="Edit" active />
            <IconBtn icon={<Eye size={14} />} label="Preview" />
            <IconBtn icon={<LinkIcon size={14} />} label="Backlinks" />
            <IconBtn icon={<DotsThreeVertical size={16} />} label="Mais" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <article className="mx-auto max-w-[720px] px-10 py-10">
            <MockMarkdown source={active.body} />

            {active.backlinks.length > 0 && (
              <section className="mt-12 border-t border-[var(--color-noxe-border)] pt-6">
                <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-noxe-muted)]">
                  <LinkIcon size={12} /> Backlinks · {active.backlinks.length}
                </h4>
                <ul className="space-y-2">
                  {active.backlinks.map((bl) => (
                    <li
                      key={bl}
                      className="rounded-md border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel-2)] px-3 py-2 text-sm"
                    >
                      <div className="font-medium">{bl}</div>
                      <div className="text-[12px] text-[var(--color-noxe-muted)]">…menciona [[{active.title}]] como referência…</div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </article>
        </div>

        <footer className="flex h-7 items-center justify-between border-t border-[var(--color-noxe-border)] px-4 text-[11px] text-[var(--color-noxe-muted)]">
          <div className="flex items-center gap-3">
            <span>Markdown</span>
            <span>UTF-8</span>
            <span>Ln 12, Col 8</span>
          </div>
          <div className="flex items-center gap-3">
            <span>312 palavras</span>
            <span>Salvo às {active.updatedAt.slice(11)}</span>
          </div>
        </footer>
      </main>
    </div>
  )
}

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-noxe-subtle)]">
        {title}
      </div>
      <div className="flex flex-col">{children}</div>
    </div>
  )
}

function SidebarRow({
  icon,
  label,
  badge,
  active,
}: {
  icon: React.ReactNode
  label: string
  badge?: string
  active?: boolean
}) {
  return (
    <button
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left ${
        active ? 'bg-[var(--color-noxe-accent-soft)] text-[var(--color-noxe-accent)]' : 'hover:bg-[var(--color-noxe-panel-2)]'
      }`}
    >
      <span className={active ? 'text-[var(--color-noxe-accent)]' : 'text-[var(--color-noxe-muted)]'}>{icon}</span>
      <span className="truncate">{label}</span>
      {badge && (
        <span className="ml-auto rounded bg-[var(--color-noxe-panel-2)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-noxe-muted)]">
          {badge}
        </span>
      )}
    </button>
  )
}

function IconBtn({ icon, label, active }: { icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <button
      title={label}
      className={`rounded-md p-1.5 ${
        active
          ? 'bg-[var(--color-noxe-panel-2)] text-[var(--color-noxe-ink)]'
          : 'text-[var(--color-noxe-muted)] hover:bg-[var(--color-noxe-panel-2)]'
      }`}
    >
      {icon}
    </button>
  )
}
