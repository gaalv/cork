import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  MagnifyingGlass,
  Notebook,
  Hash,
  House,
  ClockCounterClockwise,
  Star,
  GearSix,
  Plus,
  CommandIcon,
  Sparkle,
  ArrowUpRight,
  Link as LinkIcon,
  ListBullets,
  Article,
  CaretRight,
  X,
  ArrowLeft,
  CaretDown,
  Tag,
  FolderSimple,
} from '@phosphor-icons/react'
import { folderOps, validateFolderName } from '@/features/folder-ops/services/folderOps'
import { InlineRename } from '@/features/folder-ops/ui/InlineRename'
import { NewFolderDialog } from '@/features/folder-ops/ui/NewFolderDialog'
import { MockMarkdown } from '@/features/editor/ui/MockMarkdown'
import { useIndexStore } from '@/features/index/state/indexStore'
import { useVaultStore } from '@/features/vault/state/vaultStore'
import { useLegacyVaultData } from './legacyAdapter'
import type { LegacyVaultData, Note } from './legacyAdapter'

type View = { kind: 'home' } | { kind: 'note'; id: string }
type Drawer = null | 'search' | 'recent' | 'starred' | 'tags' | 'folders'

const STARRED_IDS = new Set(['n1', 'n4', 'n6'])

const LegacyDataContext = createContext<LegacyVaultData | null>(null)

function useLegacyData() {
  const data = useContext(LegacyDataContext)
  if (!data) {
    throw new Error('Legacy vault data context missing')
  }
  return data
}

export function LayoutMinimalCommand() {
  const [view, setView] = useState<View>({ kind: 'home' })
  const [drawer, setDrawer] = useState<Drawer>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteQuery, setPaletteQuery] = useState('')
  const [drawerQuery, setDrawerQuery] = useState('')
  const legacyData = useLegacyVaultData()
  const loadNotes = useVaultStore((state) => state.loadNotes)
  const startWatcherIntegration = useVaultStore((state) => state.startWatcherIntegration)
  const startIndexIntegration = useIndexStore((state) => state.startIndexIntegration)
  const activeNote = view.kind === 'note' ? legacyData.notes.find((n) => n.id === view.id) : null

  useEffect(() => {
    void loadNotes()
      .then(() => Promise.all([startWatcherIntegration(), startIndexIntegration()]))
      .catch(() => undefined)
  }, [loadNotes, startIndexIntegration, startWatcherIntegration])

  const openNote = (id: string) => {
    setView({ kind: 'note', id })
    setDrawer(null)
    setPaletteOpen(false)
  }

  const goHome = () => {
    setView({ kind: 'home' })
    setDrawer(null)
  }

  const toggleDrawer = (d: Drawer) => {
    setDrawer((cur) => (cur === d ? null : d))
    setDrawerQuery('')
  }

  return (
    <LegacyDataContext.Provider value={legacyData}>
    <div data-testid="shell" className="relative grid h-full grid-cols-[56px_1fr] bg-[var(--color-noxe-bg)]">
      {/* Slim icon rail */}
      <aside data-testid="rail" className="z-10 flex h-full flex-col items-center justify-between border-r border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] py-4">
        <div className="flex flex-col items-center gap-2">
          <div className="mb-2 flex size-8 items-center justify-center rounded-lg bg-[var(--color-noxe-ink)] text-white">
            <Notebook size={16} weight="fill" />
          </div>
          <RailBtn icon={<House size={18} />} label="Home" active={view.kind === 'home' && !drawer} onClick={goHome} />
          <RailBtn icon={<MagnifyingGlass size={18} />} label="Search" active={drawer === 'search'} onClick={() => toggleDrawer('search')} />
          <RailBtn icon={<FolderSimple size={18} />} label="Folders" active={drawer === 'folders'} onClick={() => toggleDrawer('folders')} />
          <RailBtn icon={<ClockCounterClockwise size={18} />} label="Recent" active={drawer === 'recent'} onClick={() => toggleDrawer('recent')} />
          <RailBtn icon={<Star size={18} />} label="Starred" active={drawer === 'starred'} onClick={() => toggleDrawer('starred')} />
          <RailBtn icon={<Hash size={18} />} label="Tags" active={drawer === 'tags'} onClick={() => toggleDrawer('tags')} />
        </div>
        <div className="flex flex-col items-center gap-2">
          <RailBtn icon={<Sparkle size={18} weight="fill" />} label="AI" />
          <RailBtn icon={<GearSix size={18} />} label="Settings" />
        </div>
      </aside>

      <div className="relative flex h-full min-w-0 flex-col">
        {/* Top bar */}
        <header data-testid="topbar" className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)]/80 px-6 backdrop-blur">
          {view.kind === 'note' ? (
            <button
              onClick={goHome}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-[var(--color-noxe-muted)] hover:bg-[var(--color-noxe-panel-2)] hover:text-[var(--color-noxe-ink)]"
            >
              <ArrowLeft size={12} /> Home
            </button>
          ) : (
            <span className="text-[13px] font-semibold tracking-tight">{legacyData.path ? 'Personal Vault' : 'No vault open'}</span>
          )}

          {view.kind === 'note' && activeNote && (
            <Breadcrumb path={activeNote.path} />
          )}

          <button
            onClick={() => setPaletteOpen(true)}
            className="ml-auto flex w-[420px] items-center gap-2 rounded-full border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel-2)] px-3 py-1.5 text-left text-[13px] text-[var(--color-noxe-muted)] hover:border-[var(--color-noxe-border-strong)]"
          >
            <CommandIcon size={14} />
            <span>Vá para nota, comando ou pesquisa…</span>
            <span className="ml-auto flex items-center gap-1">
              <kbd className="rounded border border-[var(--color-noxe-border)] bg-white px-1 text-[10px] font-medium">⌘</kbd>
              <kbd className="rounded border border-[var(--color-noxe-border)] bg-white px-1 text-[10px] font-medium">K</kbd>
            </span>
          </button>

          {!legacyData.path && (
            <button
              onClick={() => void legacyData.openVault()}
              className="flex items-center gap-1.5 rounded-full border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] px-3 py-1.5 text-[12px] font-medium hover:border-[var(--color-noxe-border-strong)]"
            >
              Open Vault
            </button>
          )}

          <button className="flex items-center gap-1.5 rounded-full bg-[var(--color-noxe-ink)] px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90">
            <Plus size={12} weight="bold" /> Nova nota
          </button>
        </header>

        <div className="relative flex min-h-0 flex-1">
          {/* Drawer (slides in from rail) */}
          {drawer && (
            <Drawer
              kind={drawer}
              query={drawerQuery}
              onQueryChange={setDrawerQuery}
              onClose={() => setDrawer(null)}
              onOpenNote={openNote}
            />
          )}

          {/* Main view */}
          <div className="flex min-w-0 flex-1 overflow-hidden">
            {view.kind === 'home' ? (
              <HomeView onOpenNote={openNote} onOpenDrawer={(d) => setDrawer(d)} />
            ) : (
              <NoteView noteId={view.id} onOpenNote={openNote} />
            )}
          </div>
        </div>
      </div>

      {/* Command palette */}
      {paletteOpen && (
        <CommandPalette
          query={paletteQuery}
          onQueryChange={setPaletteQuery}
          onClose={() => setPaletteOpen(false)}
          onOpenNote={openNote}
        />
      )}
    </div>
    </LegacyDataContext.Provider>
  )
}

// ----- Home view -----

function HomeView({
  onOpenNote,
  onOpenDrawer,
}: {
  onOpenNote: (id: string) => void
  onOpenDrawer: (d: Drawer) => void
}) {
  const { notes, recentNotes, tags, path, isLoading, openVault } = useLegacyData()
  const pinned = notes.filter((n) => STARRED_IDS.has(n.id))
  const recent = recentNotes.map((id) => notes.find((n) => n.id === id)!).filter(Boolean)

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[960px] px-10 py-12">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-[12px] uppercase tracking-wider text-[var(--color-noxe-muted)]">
              Quarta-feira, 6 de maio
            </p>
            <h1 className="mt-1 text-[28px] font-semibold tracking-tight">Bem-vindo de volta 👋</h1>
            <p className="mt-1 text-[14px] text-[var(--color-noxe-muted)]">
              {path ? `${notes.length} notas no vault` : 'Abra um vault para listar suas notas Markdown'}
            </p>
          </div>
          <button
            onClick={() => (recent[0] ? onOpenNote(recent[0].id) : void openVault())}
            className="flex items-center gap-1.5 rounded-full border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] px-3 py-1.5 text-[12px] hover:border-[var(--color-noxe-border-strong)]"
          >
            {path ? 'Abrir nota recente' : isLoading ? 'Abrindo…' : 'Open Vault'} <ArrowUpRight size={12} />
          </button>
        </div>

        <Section title="Fixadas" hint={`${pinned.length} notas`}>
          <div className="grid grid-cols-3 gap-3">
            {pinned.map((n) => (
              <NoteCard key={n.id} note={n} onOpen={() => onOpenNote(n.id)} />
            ))}
          </div>
        </Section>

        <Section title="Recentes" hint="ver todas" onHintClick={() => onOpenDrawer('recent')}>
          <ul className="divide-y divide-[var(--color-noxe-border)] overflow-hidden rounded-xl border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)]">
            {isLoading && recent.length === 0 && (
              <li className="px-4 py-3 text-[13px] text-[var(--color-noxe-muted)]">Indexando recentes…</li>
            )}
            {recent.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => onOpenNote(n.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--color-noxe-panel-2)]"
                >
                  <Article size={14} className="text-[var(--color-noxe-muted)]" />
                  <span className="flex-1 truncate text-[14px] font-medium">{n.title}</span>
                  <span className="hidden truncate text-[12px] text-[var(--color-noxe-muted)] md:inline">
                    {n.path}
                  </span>
                  <span className="text-[11px] text-[var(--color-noxe-subtle)]">{n.updatedAt}</span>
                </button>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Por tag" hint="ver todas" onHintClick={() => onOpenDrawer('tags')}>
          <div className="flex flex-wrap gap-2">
            {isLoading && tags.every((tag) => tag.count === 0) && (
              <span className="rounded-full border border-[var(--color-noxe-border)] px-3 py-1.5 text-[12px] text-[var(--color-noxe-muted)]">
                Indexando tags…
              </span>
            )}
            {tags.map((t) => (
              <button
                key={t.id}
                className="flex items-center gap-1.5 rounded-full border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] px-3 py-1.5 text-[12px] hover:border-[var(--color-noxe-border-strong)]"
              >
                <Tag size={12} className="text-[var(--color-noxe-tag)]" />
                <span className="font-medium text-[var(--color-noxe-tag)]">#{t.name}</span>
                <span className="text-[var(--color-noxe-muted)]">{t.count}</span>
              </button>
            ))}
          </div>
        </Section>

        <Section title="Todas as notas" hint={`${notes.length} no vault`}>
          <div className="grid grid-cols-2 gap-3">
            {notes.map((n) => (
              <NoteCard key={n.id} note={n} onOpen={() => onOpenNote(n.id)} compact />
            ))}
          </div>
        </Section>
      </div>
    </main>
  )
}

function Section({
  title,
  hint,
  onHintClick,
  children,
}: {
  title: string
  hint?: string
  onHintClick?: () => void
  children: React.ReactNode
}) {
  return (
    <section className="mb-10">
      <header className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-[var(--color-noxe-muted)]">
          {title}
        </h2>
        {hint &&
          (onHintClick ? (
            <button
              onClick={onHintClick}
              className="text-[12px] text-[var(--color-noxe-muted)] hover:text-[var(--color-noxe-ink)]"
            >
              {hint} →
            </button>
          ) : (
            <span className="text-[12px] text-[var(--color-noxe-subtle)]">{hint}</span>
          ))}
      </header>
      {children}
    </section>
  )
}

function NoteCard({ note, onOpen, compact }: { note: Note; onOpen: () => void; compact?: boolean }) {
  return (
    <button
      onClick={onOpen}
      className="group flex flex-col gap-2 rounded-xl border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] p-4 text-left transition hover:border-[var(--color-noxe-border-strong)] hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="truncate text-[14px] font-semibold">{note.title}</h3>
        {STARRED_IDS.has(note.id) && (
          <Star size={12} weight="fill" className="text-amber-500" />
        )}
      </div>
      <p className={`text-[12px] leading-relaxed text-[var(--color-noxe-muted)] ${compact ? 'line-clamp-2' : 'line-clamp-3'}`}>
        {note.excerpt}
      </p>
      <div className="mt-auto flex items-center gap-1.5 pt-1">
        {note.tags.slice(0, 2).map((t) => (
          <span
            key={t}
            className="rounded-full bg-[var(--color-noxe-tag-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-noxe-tag)]"
          >
            #{t}
          </span>
        ))}
        <span className="ml-auto text-[10px] text-[var(--color-noxe-subtle)]">{note.updatedAt.slice(0, 10)}</span>
      </div>
    </button>
  )
}

// ----- Note view -----

function NoteView({ noteId, onOpenNote }: { noteId: string; onOpenNote: (id: string) => void }) {
  const { notes, recentNotes } = useLegacyData()
  const active = notes.find((n) => n.id === noteId)
  if (!active) {
    return <main className="flex-1 p-10 text-[14px] text-[var(--color-noxe-muted)]">Nota não encontrada.</main>
  }
  const outline = active.body.split('\n').filter((l) => /^#{1,3}\s/.test(l))

  return (
    <>
      <main className="flex-1 overflow-y-auto">
        <article className="mx-auto max-w-[740px] px-10 py-12">
          <div className="mb-6 flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-noxe-muted)]">
            <span className="rounded-full bg-[var(--color-noxe-panel-2)] px-2 py-0.5">
              Atualizado {active.updatedAt}
            </span>
            {active.tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-[var(--color-noxe-tag-soft)] px-2 py-0.5 font-medium text-[var(--color-noxe-tag)]"
              >
                #{t}
              </span>
            ))}
            <button className="ml-auto flex items-center gap-1 rounded-full border border-[var(--color-noxe-border)] px-2 py-0.5 hover:bg-[var(--color-noxe-panel-2)]">
              <Star size={11} /> Favoritar
            </button>
          </div>

          <MockMarkdown source={active.body} />

          <div className="mt-8 flex items-start gap-3 rounded-xl border border-dashed border-[var(--color-noxe-border-strong)] bg-[var(--color-noxe-panel-2)] p-4">
            <div className="mt-0.5 flex size-7 items-center justify-center rounded-full bg-white text-[var(--color-noxe-accent)] shadow-sm">
              <Sparkle size={14} weight="fill" />
            </div>
            <div className="flex-1">
              <div className="text-[13px] font-medium">Sugestão de link</div>
              <p className="mt-0.5 text-[12px] text-[var(--color-noxe-muted)]">
                Esta nota parece relacionada a <em>[[Inkdrop — UX para devs]]</em> e <em>[[Wikilinks — design]]</em>.
              </p>
            </div>
            <button className="rounded-md bg-[var(--color-noxe-ink)] px-2.5 py-1 text-[11px] font-medium text-white">
              Adicionar
            </button>
          </div>
        </article>
      </main>

      <aside className="w-[280px] shrink-0 overflow-y-auto border-l border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] px-5 py-5">
        <Block icon={<ListBullets size={12} />} title="Outline">
          <ul className="space-y-1 text-[12px]">
            {outline.map((line, i) => {
              const level = (line.match(/^#+/) ?? [''])[0].length
              return (
                <li
                  key={i}
                  className="flex items-center gap-1.5 truncate text-[var(--color-noxe-muted)] hover:text-[var(--color-noxe-ink)]"
                  style={{ paddingLeft: (level - 1) * 10 }}
                >
                  <span className="size-1 rounded-full bg-[var(--color-noxe-border-strong)]" />
                  {line.replace(/^#+\s/, '')}
                </li>
              )
            })}
          </ul>
        </Block>

        <Block icon={<LinkIcon size={12} />} title={`Backlinks · ${active.backlinks.length}`}>
          <ul className="space-y-1.5 text-[12px]">
            {active.backlinks.length === 0 && <li className="text-[var(--color-noxe-subtle)]">Sem backlinks.</li>}
            {active.backlinks.map((bl) => {
              const target = notes.find((n) => n.title === bl)
              return (
                <li
                  key={bl}
                  onClick={() => target && onOpenNote(target.id)}
                  className="group flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 hover:bg-[var(--color-noxe-panel-2)]"
                >
                  <span className="truncate">{bl}</span>
                  <ArrowUpRight size={11} className="opacity-0 group-hover:opacity-100" />
                </li>
              )
            })}
          </ul>
        </Block>

        <Block icon={<ClockCounterClockwise size={12} />} title="Recentes">
          <ul className="space-y-1 text-[12px]">
            {recentNotes.map((id) => {
              const n = notes.find((x) => x.id === id)!
              const isActive = n.id === noteId
              return (
                <li key={id}>
                  <button
                    onClick={() => onOpenNote(n.id)}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left ${
                      isActive
                        ? 'bg-[var(--color-noxe-accent-soft)] text-[var(--color-noxe-accent)]'
                        : 'hover:bg-[var(--color-noxe-panel-2)]'
                    }`}
                  >
                    <Article size={12} className="shrink-0" />
                    <span className="truncate">{n.title}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </Block>
      </aside>
    </>
  )
}

// ----- Drawer -----

function Drawer({
  kind,
  query,
  onQueryChange,
  onClose,
  onOpenNote,
}: {
  kind: Exclude<Drawer, null>
  query: string
  onQueryChange: (v: string) => void
  onClose: () => void
  onOpenNote: (id: string) => void
}) {
  const { notes, recentNotes, tags } = useLegacyData()
  const config: Record<Exclude<Drawer, null>, { title: string; placeholder: string }> = {
    search: { title: 'Buscar', placeholder: 'Buscar em todas as notas…' },
    recent: { title: 'Recentes', placeholder: 'Filtrar recentes…' },
    starred: { title: 'Favoritos', placeholder: 'Filtrar favoritos…' },
    tags: { title: 'Tags', placeholder: 'Filtrar tags…' },
    folders: { title: 'Pastas', placeholder: 'Filtrar pastas…' },
  }

  const filtered = useMemo(() => {
    let base: Note[] = notes
    if (kind === 'recent') base = recentNotes.map((id) => notes.find((n) => n.id === id)!).filter(Boolean)
    if (kind === 'starred') base = notes.filter((n) => STARRED_IDS.has(n.id))
    if (!query) return base
    const q = query.toLowerCase()
    return base.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.excerpt.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q)),
    )
  }, [kind, notes, query, recentNotes])

  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-r border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)]">
      <header className="flex h-11 items-center justify-between border-b border-[var(--color-noxe-border)] px-3">
        <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--color-noxe-muted)]">
          {config[kind].title}
        </span>
        <button onClick={onClose} className="rounded p-1 text-[var(--color-noxe-muted)] hover:bg-[var(--color-noxe-panel-2)]">
          <X size={12} />
        </button>
      </header>

      <div className="px-3 pt-3">
        <div className="flex items-center gap-2 rounded-md bg-[var(--color-noxe-panel-2)] px-2.5 py-1.5">
          <MagnifyingGlass size={12} className="text-[var(--color-noxe-muted)]" />
          <input
            autoFocus
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={config[kind].placeholder}
            className="w-full bg-transparent text-[13px] outline-none placeholder:text-[var(--color-noxe-subtle)]"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        {kind === 'tags' ? (
          <ul className="space-y-1">
            {tags
              .filter((t) => !query || t.name.includes(query.toLowerCase()))
              .map((t) => (
                <li key={t.id}>
                  <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-[var(--color-noxe-panel-2)]">
                    <Tag size={12} className="text-[var(--color-noxe-tag)]" />
                    <span className="font-medium text-[var(--color-noxe-tag)]">#{t.name}</span>
                    <span className="ml-auto text-[11px] text-[var(--color-noxe-muted)]">{t.count}</span>
                  </button>
                </li>
              ))}
          </ul>
        ) : kind === 'folders' ? (
          <FolderTree onOpenNote={onOpenNote} query={query} />
        ) : (
          <ul className="space-y-0.5">
            {filtered.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => onOpenNote(n.id)}
                  className="flex w-full flex-col gap-0.5 rounded-md px-2 py-2 text-left hover:bg-[var(--color-noxe-panel-2)]"
                >
                  <span className="flex items-center gap-1.5 text-[13px] font-medium">
                    {STARRED_IDS.has(n.id) && <Star size={10} weight="fill" className="text-amber-500" />}
                    <span className="truncate">{n.title}</span>
                  </span>
                  <span className="line-clamp-1 text-[11px] text-[var(--color-noxe-muted)]">{n.excerpt}</span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-2 py-4 text-center text-[12px] text-[var(--color-noxe-subtle)]">Nada encontrado.</li>
            )}
          </ul>
        )}
      </div>
    </aside>
  )
}

function FolderTree({ onOpenNote, query }: { onOpenNote: (id: string) => void; query: string }) {
  const { notes, folders } = useLegacyData()
  const loadNotes = useVaultStore((state) => state.loadNotes)
  const [open, setOpen] = useState<Record<string, boolean>>({ projects: true, 'projects/noxe': true })
  const [renaming, setRenaming] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ folder: string; x: number; y: number } | null>(null)
  const [newFolderParent, setNewFolderParent] = useState<string | null>(null)
  const filteredNotes = (folder: string) =>
    notes.filter(
      (n) =>
        n.folder === folder &&
        (!query || n.title.toLowerCase().includes(query.toLowerCase())),
    )
  const refreshAfter = async (action: () => Promise<unknown>) => {
    await action()
    await loadNotes()
  }
  const trashFolder = (folder: string) => {
    const affected = notes.filter((note) => note.folder === folder || note.folder.startsWith(folder + '/')).length
    if (!window.confirm(`Move ${folder} and ${affected} note${affected === 1 ? '' : 's'} to trash?`)) {
      return
    }
    void refreshAfter(() => folderOps.trash(folder)).then(() => setMenu(null))
  }
  return (
    <div className="relative text-[13px]" onClick={() => setMenu(null)}>
      <button
        onClick={() => setNewFolderParent('')}
        className="mb-2 flex w-full items-center justify-center rounded-md border border-dashed border-[var(--color-noxe-border)] px-2 py-1.5 text-[12px] text-[var(--color-noxe-muted)] hover:border-[var(--color-noxe-border-strong)] hover:text-[var(--color-noxe-ink)]"
      >
        <Plus size={12} /> New folder
      </button>
      {folders
        .filter((f) => !f.id.includes('/'))
        .map((f) => {
          const isOpen = open[f.id]
          const children = folders.filter((c) => c.id.startsWith(f.id + '/'))
          return (
            <div key={f.id}>
              <FolderRow
                folder={f.id}
                name={f.name}
                count={f.count}
                isOpen={isOpen}
                isRenaming={renaming === f.id}
                onToggle={() => setOpen((o) => ({ ...o, [f.id]: !isOpen }))}
                onRename={(name) => refreshAfter(() => folderOps.rename({ oldPath: f.id, newName: name })).then(() => setRenaming(null))}
                onCancelRename={() => setRenaming(null)}
                onContextMenu={(event) => {
                  event.preventDefault()
                  setMenu({ folder: f.id, x: event.clientX, y: event.clientY })
                }}
              />
              {isOpen && (
                <div className="ml-4 border-l border-[var(--color-noxe-border)] pl-1">
                  {filteredNotes(f.id).map((n) => (
                    <button
                      key={n.id}
                      onClick={() => onOpenNote(n.id)}
                      className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left hover:bg-[var(--color-noxe-panel-2)]"
                    >
                      <Article size={11} className="text-[var(--color-noxe-muted)]" />
                      <span className="truncate">{n.title}</span>
                    </button>
                  ))}
                  {children.map((c) => {
                    const sOpen = open[c.id]
                    return (
                      <div key={c.id}>
                        <FolderRow
                          folder={c.id}
                          name={c.name.split('/').pop() ?? c.name}
                          count={c.count}
                          isOpen={sOpen}
                          isRenaming={renaming === c.id}
                          onToggle={() => setOpen((o) => ({ ...o, [c.id]: !sOpen }))}
                          onRename={(name) => refreshAfter(() => folderOps.rename({ oldPath: c.id, newName: name })).then(() => setRenaming(null))}
                          onCancelRename={() => setRenaming(null)}
                          onContextMenu={(event) => {
                            event.preventDefault()
                            setMenu({ folder: c.id, x: event.clientX, y: event.clientY })
                          }}
                        />
                        {sOpen && (
                          <div className="ml-4 border-l border-[var(--color-noxe-border)] pl-1">
                            {filteredNotes(c.id).map((n) => (
                              <button
                                key={n.id}
                                onClick={() => onOpenNote(n.id)}
                                className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left hover:bg-[var(--color-noxe-panel-2)]"
                              >
                                <Article size={11} className="text-[var(--color-noxe-muted)]" />
                                <span className="truncate">{n.title}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      {menu && (
        <div
          className="fixed z-50 w-40 rounded-xl border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] p-1 text-[12px] shadow-xl"
          style={{ left: menu.x, top: menu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-[var(--color-noxe-panel-2)]" onClick={() => setNewFolderParent(menu.folder)}>
            New folder
          </button>
          <button className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-[var(--color-noxe-panel-2)]" onClick={() => { setRenaming(menu.folder); setMenu(null) }}>
            Rename
          </button>
          <button className="w-full rounded-lg px-2 py-1.5 text-left text-red-600 hover:bg-[var(--color-noxe-panel-2)]" onClick={() => trashFolder(menu.folder)}>
            Move to Trash
          </button>
        </div>
      )}
      <NewFolderDialog
        parent={newFolderParent ?? ''}
        open={newFolderParent !== null}
        onClose={() => setNewFolderParent(null)}
        onCreate={(parent, name) => refreshAfter(() => folderOps.create({ parent, name }))}
      />
    </div>
  )
}

function FolderRow({
  name,
  count,
  isOpen,
  isRenaming,
  onToggle,
  onRename,
  onCancelRename,
  onContextMenu,
}: {
  folder: string
  name: string
  count?: number
  isOpen?: boolean
  isRenaming: boolean
  onToggle: () => void
  onRename: (name: string) => Promise<void>
  onCancelRename: () => void
  onContextMenu: (event: React.MouseEvent<HTMLButtonElement>) => void
}) {
  if (isRenaming) {
    return (
      <InlineRename
        initial={name}
        label={`Rename ${name}`}
        validate={validateFolderName}
        onCommit={onRename}
        onCancel={onCancelRename}
        className="w-full"
      />
    )
  }
  return (
    <button
      onClick={onToggle}
      onContextMenu={onContextMenu}
      className="flex w-full items-center gap-1 rounded px-2 py-1 hover:bg-[var(--color-noxe-panel-2)]"
    >
      {isOpen ? <CaretDown size={11} /> : <CaretRight size={11} />}
      <FolderSimple size={12} className="text-[var(--color-noxe-muted)]" />
      <span className="truncate font-medium">{name}</span>
      {count !== undefined && <span className="ml-auto text-[11px] text-[var(--color-noxe-subtle)]">{count}</span>}
    </button>
  )
}

// ----- Command palette -----

function CommandPalette({
  query,
  onQueryChange,
  onClose,
  onOpenNote,
}: {
  query: string
  onQueryChange: (v: string) => void
  onClose: () => void
  onOpenNote: (id: string) => void
}) {
  const { notes } = useLegacyData()
  const matches = useMemo(() => {
    if (!query) return notes.slice(0, 5)
    const q = query.toLowerCase()
    return notes.filter((n) => n.title.toLowerCase().includes(q) || n.tags.some((t) => t.includes(q))).slice(0, 6)
  }, [notes, query])

  return (
    <div
      className="absolute inset-0 z-30 flex items-start justify-center bg-[var(--color-noxe-ink)]/30 pt-[14vh]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[560px] overflow-hidden rounded-2xl border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-[var(--color-noxe-border)] px-4 py-3">
          <MagnifyingGlass size={16} className="text-[var(--color-noxe-muted)]" />
          <input
            autoFocus
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Vá para nota, rode comando, pesquise…"
            className="w-full bg-transparent text-[14px] outline-none placeholder:text-[var(--color-noxe-subtle)]"
          />
          <kbd className="rounded border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel-2)] px-1.5 py-0.5 text-[10px] text-[var(--color-noxe-muted)]">
            ESC
          </kbd>
        </div>

        <div className="max-h-[360px] overflow-y-auto p-2 text-[13px]">
          <PaletteSection title="Notas">
            {matches.map((n) => (
              <PaletteRow
                key={n.id}
                icon={<Article size={14} />}
                title={n.title}
                hint={n.path}
                onClick={() => onOpenNote(n.id)}
              />
            ))}
            {matches.length === 0 && (
              <div className="px-2.5 py-2 text-[12px] text-[var(--color-noxe-subtle)]">
                Nenhuma nota encontrada.
              </div>
            )}
          </PaletteSection>
          <PaletteSection title="Comandos">
            <PaletteRow icon={<Plus size={14} />} title="Criar nova nota" hint="⌘ N" />
            <PaletteRow icon={<Sparkle size={14} weight="fill" />} title="Perguntar à IA sobre nota atual" hint="⌘ ⇧ A" />
            <PaletteRow icon={<LinkIcon size={14} />} title="Inserir wikilink" hint="[[" />
          </PaletteSection>
        </div>
      </div>
    </div>
  )
}

// ----- Shared bits -----

function Breadcrumb({ path }: { path: string }) {
  const segs = path.split('/')
  return (
    <div className="flex items-center gap-1.5 text-[12px] text-[var(--color-noxe-muted)]">
      {segs.map((seg, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <span className={i === segs.length - 1 ? 'font-medium text-[var(--color-noxe-ink)]' : ''}>{seg}</span>
          {i < segs.length - 1 && <CaretRight size={10} />}
        </span>
      ))}
    </div>
  )
}

function RailBtn({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      title={label}
      onClick={onClick}
      className={`flex size-10 items-center justify-center rounded-lg transition ${
        active
          ? 'bg-[var(--color-noxe-accent-soft)] text-[var(--color-noxe-accent)]'
          : 'text-[var(--color-noxe-muted)] hover:bg-[var(--color-noxe-panel-2)] hover:text-[var(--color-noxe-ink)]'
      }`}
    >
      {icon}
    </button>
  )
}

function Block({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <header className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-noxe-muted)]">
        {icon}
        {title}
      </header>
      {children}
    </section>
  )
}

function PaletteSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <div className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-noxe-subtle)]">
        {title}
      </div>
      <div className="flex flex-col">{children}</div>
    </div>
  )
}

function PaletteRow({
  icon,
  title,
  hint,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  hint?: string
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-[var(--color-noxe-panel-2)]"
    >
      <span className="text-[var(--color-noxe-muted)]">{icon}</span>
      <span className="flex-1 truncate text-[var(--color-noxe-ink)]">{title}</span>
      {hint && <span className="text-[11px] text-[var(--color-noxe-subtle)]">{hint}</span>}
    </button>
  )
}
