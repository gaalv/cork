import { useState } from 'react'
import {
  MagnifyingGlass,
  FolderSimple,
  FolderOpen,
  FileText,
  Hash,
  Plus,
  X,
  CaretRight,
  CaretDown,
  ListBullets,
  Graph,
  Compass,
  GearSix,
  Star,
  Link as LinkIcon,
  Article,
} from '@phosphor-icons/react'
import { folders, notes, tags } from '../data/mock'
import { MockMarkdown } from '../components/MockMarkdown'

type Tab = { id: string; pinned?: boolean }

export function LayoutSidebarTabs() {
  const [tabs, setTabs] = useState<Tab[]>([
    { id: 'n1', pinned: true },
    { id: 'n2' },
    { id: 'n4' },
  ])
  const [activeTab, setActiveTab] = useState('n1')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    projects: true,
    'projects/noxe': true,
  })

  const active = notes.find((n) => n.id === activeTab) ?? notes[0]
  const outline = active.body.split('\n').filter((l) => /^#{1,3}\s/.test(l))

  const openTab = (id: string) => {
    setActiveTab(id)
    setTabs((t) => (t.find((x) => x.id === id) ? t : [...t, { id }]))
  }

  return (
    <div className="grid h-full grid-cols-[48px_260px_1fr_280px] bg-[var(--color-noxe-bg)]">
      {/* Activity rail */}
      <aside className="flex h-full flex-col items-center gap-1 border-r border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] py-3">
        <RailBtn icon={<FolderSimple size={18} weight="duotone" />} active />
        <RailBtn icon={<MagnifyingGlass size={18} />} />
        <RailBtn icon={<Hash size={18} />} />
        <RailBtn icon={<Star size={18} />} />
        <RailBtn icon={<Graph size={18} />} />
        <RailBtn icon={<Compass size={18} />} />
        <div className="mt-auto flex flex-col gap-1">
          <RailBtn icon={<Plus size={18} />} />
          <RailBtn icon={<GearSix size={18} />} />
        </div>
      </aside>

      {/* Explorer */}
      <aside className="flex h-full flex-col border-r border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)]">
        <div className="flex h-11 items-center justify-between px-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-noxe-muted)]">
          <span>Explorer</span>
          <div className="flex items-center gap-1 text-[var(--color-noxe-muted)]">
            <button className="rounded p-1 hover:bg-[var(--color-noxe-panel-2)]" title="Nova nota">
              <Plus size={12} />
            </button>
          </div>
        </div>

        <div className="px-2 pb-2">
          <div className="flex items-center gap-2 rounded-md bg-[var(--color-noxe-panel-2)] px-2 py-1.5">
            <MagnifyingGlass size={12} className="text-[var(--color-noxe-muted)]" />
            <input
              placeholder="Filtrar arquivos…"
              className="w-full bg-transparent text-[12px] outline-none placeholder:text-[var(--color-noxe-subtle)]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-1 pb-3 text-[13px]">
          {folders
            .filter((f) => !f.id.includes('/'))
            .map((f) => {
              const open = expanded[f.id]
              const children = folders.filter((c) => c.id.startsWith(f.id + '/'))
              const childNotes = notes.filter((n) => n.folder === f.id || n.folder.startsWith(f.id + '/'))
              return (
                <div key={f.id}>
                  <button
                    onClick={() => setExpanded((e) => ({ ...e, [f.id]: !open }))}
                    className="flex w-full items-center gap-1 rounded px-2 py-1 hover:bg-[var(--color-noxe-panel-2)]"
                  >
                    {open ? (
                      <CaretDown size={11} className="text-[var(--color-noxe-muted)]" />
                    ) : (
                      <CaretRight size={11} className="text-[var(--color-noxe-muted)]" />
                    )}
                    {open ? (
                      <FolderOpen size={14} className="text-[var(--color-noxe-accent)]" weight="fill" />
                    ) : (
                      <FolderSimple size={14} className="text-[var(--color-noxe-muted)]" />
                    )}
                    <span className="truncate font-medium">{f.name}</span>
                  </button>
                  {open && (
                    <div className="ml-4 border-l border-[var(--color-noxe-border)] pl-1">
                      {children.map((c) => {
                        const subOpen = expanded[c.id]
                        const subNotes = notes.filter((n) => n.folder === c.id)
                        return (
                          <div key={c.id}>
                            <button
                              onClick={() => setExpanded((e) => ({ ...e, [c.id]: !subOpen }))}
                              className="flex w-full items-center gap-1 rounded px-2 py-1 hover:bg-[var(--color-noxe-panel-2)]"
                            >
                              {subOpen ? (
                                <CaretDown size={11} className="text-[var(--color-noxe-muted)]" />
                              ) : (
                                <CaretRight size={11} className="text-[var(--color-noxe-muted)]" />
                              )}
                              {subOpen ? (
                                <FolderOpen size={14} className="text-[var(--color-noxe-accent)]" weight="fill" />
                              ) : (
                                <FolderSimple size={14} className="text-[var(--color-noxe-muted)]" />
                              )}
                              <span className="truncate">{c.name.split('/').pop()}</span>
                            </button>
                            {subOpen && (
                              <div className="ml-4 border-l border-[var(--color-noxe-border)] pl-1">
                                {subNotes.map((n) => (
                                  <FileRow key={n.id} note={n} active={activeTab === n.id} onOpen={() => openTab(n.id)} />
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                      {childNotes
                        .filter((n) => n.folder === f.id)
                        .map((n) => (
                          <FileRow key={n.id} note={n} active={activeTab === n.id} onOpen={() => openTab(n.id)} />
                        ))}
                    </div>
                  )}
                </div>
              )
            })}

          <div className="mt-4 px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-noxe-subtle)]">
            Tags
          </div>
          <div className="mt-1 flex flex-wrap gap-1 px-2">
            {tags.map((t) => (
              <button
                key={t.id}
                className="rounded-full bg-[var(--color-noxe-tag-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-noxe-tag)] hover:opacity-80"
              >
                #{t.name}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Main editor with tabs */}
      <main className="flex h-full min-w-0 flex-col bg-[var(--color-noxe-panel)]">
        {/* Tab bar */}
        <div className="flex h-10 items-center gap-0.5 border-b border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel-2)] pl-2 pr-2">
          {tabs.map((t) => {
            const n = notes.find((x) => x.id === t.id)!
            const isActive = t.id === activeTab
            return (
              <div
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`group flex h-8 max-w-[200px] cursor-pointer items-center gap-1.5 rounded-t-md border border-b-0 px-2.5 text-[12px] ${
                  isActive
                    ? 'border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] text-[var(--color-noxe-ink)]'
                    : 'border-transparent text-[var(--color-noxe-muted)] hover:bg-white'
                }`}
              >
                <FileText size={12} className={isActive ? 'text-[var(--color-noxe-accent)]' : ''} />
                <span className="truncate">{n.title}</span>
                {!t.pinned && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setTabs((all) => all.filter((x) => x.id !== t.id))
                    }}
                    className="rounded opacity-0 transition group-hover:opacity-100 hover:bg-[var(--color-noxe-panel-2)]"
                  >
                    <X size={10} />
                  </button>
                )}
              </div>
            )
          })}
          <button className="ml-1 rounded p-1 text-[var(--color-noxe-muted)] hover:bg-white">
            <Plus size={12} />
          </button>
        </div>

        {/* Breadcrumb */}
        <div className="flex h-8 items-center gap-1.5 border-b border-[var(--color-noxe-border)] px-5 text-[12px] text-[var(--color-noxe-muted)]">
          {active.path.split('/').map((seg, i, arr) => (
            <span key={i} className="flex items-center gap-1.5">
              <span className={i === arr.length - 1 ? 'text-[var(--color-noxe-ink)]' : ''}>{seg}</span>
              {i < arr.length - 1 && <CaretRight size={10} />}
            </span>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          <article className="mx-auto max-w-[760px] px-12 py-10">
            <MockMarkdown source={active.body} />
          </article>
        </div>

        <footer className="flex h-7 items-center justify-between border-t border-[var(--color-noxe-border)] px-4 text-[11px] text-[var(--color-noxe-muted)]">
          <div className="flex items-center gap-3">
            <span>Markdown</span>
            <span>UTF-8 · LF</span>
          </div>
          <div className="flex items-center gap-3">
            <span>312 palavras · 1.8k chars</span>
            <span>Salvo às {active.updatedAt.slice(11)}</span>
          </div>
        </footer>
      </main>

      {/* Right panel: outline + backlinks */}
      <aside className="flex h-full flex-col border-l border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)]">
        <Section icon={<ListBullets size={12} />} title="Outline">
          <ul className="space-y-1 px-3 pb-3 text-[12px]">
            {outline.map((line, i) => {
              const level = (line.match(/^#+/) ?? [''])[0].length
              return (
                <li
                  key={i}
                  className="flex items-center gap-1.5 truncate text-[var(--color-noxe-muted)] hover:text-[var(--color-noxe-ink)]"
                  style={{ paddingLeft: (level - 1) * 12 }}
                >
                  <span className="size-1 rounded-full bg-[var(--color-noxe-border-strong)]" />
                  {line.replace(/^#+\s/, '')}
                </li>
              )
            })}
          </ul>
        </Section>

        <Section icon={<LinkIcon size={12} />} title={`Backlinks · ${active.backlinks.length}`}>
          <ul className="space-y-2 px-3 pb-3">
            {active.backlinks.length === 0 && (
              <li className="text-[12px] text-[var(--color-noxe-subtle)]">Sem backlinks ainda.</li>
            )}
            {active.backlinks.map((bl) => (
              <li
                key={bl}
                className="rounded-md border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel-2)] px-2.5 py-2 text-[12px]"
              >
                <div className="font-medium text-[var(--color-noxe-ink)]">{bl}</div>
                <div className="mt-0.5 text-[var(--color-noxe-muted)]">…menciona [[{active.title}]]…</div>
              </li>
            ))}
          </ul>
        </Section>

        <Section icon={<Article size={12} />} title="Tags da nota">
          <div className="flex flex-wrap gap-1 px-3 pb-3">
            {active.tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-[var(--color-noxe-tag-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-noxe-tag)]"
              >
                #{t}
              </span>
            ))}
          </div>
        </Section>
      </aside>
    </div>
  )
}

function FileRow({ note, active, onOpen }: { note: { id: string; title: string }; active: boolean; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className={`flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-[13px] ${
        active ? 'bg-[var(--color-noxe-accent-soft)] text-[var(--color-noxe-accent)]' : 'hover:bg-[var(--color-noxe-panel-2)]'
      }`}
    >
      <FileText size={12} className={active ? 'text-[var(--color-noxe-accent)]' : 'text-[var(--color-noxe-muted)]'} />
      <span className="truncate">{note.title}</span>
    </button>
  )
}

function RailBtn({ icon, active }: { icon: React.ReactNode; active?: boolean }) {
  return (
    <button
      className={`flex size-9 items-center justify-center rounded-md ${
        active
          ? 'bg-[var(--color-noxe-accent-soft)] text-[var(--color-noxe-accent)]'
          : 'text-[var(--color-noxe-muted)] hover:bg-[var(--color-noxe-panel-2)] hover:text-[var(--color-noxe-ink)]'
      }`}
    >
      {icon}
    </button>
  )
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-[var(--color-noxe-border)]">
      <header className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-noxe-muted)]">
        {icon}
        {title}
      </header>
      {children}
    </section>
  )
}
