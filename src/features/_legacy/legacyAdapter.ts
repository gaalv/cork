import { useMemo } from 'react'

import { useIndexStore } from '@/features/index/state/indexStore'
import { useVaultStore } from '@/features/vault/state/vaultStore'

import type { NoteEntry } from '@/shared/ipc/types'

export type Note = {
  id: string
  title: string
  path: string
  folder: string
  tags: string[]
  updatedAt: string
  excerpt: string
  body: string
  backlinks: string[]
}

export type LegacyFolder = {
  id: string
  name: string
  count: number
}

export type LegacyTag = {
  id: string
  name: string
  count: number
}

export type LegacyVaultData = {
  path: string | null
  notes: Note[]
  folders: LegacyFolder[]
  tags: LegacyTag[]
  recentNotes: string[]
  isLoading: boolean
  openVault: () => Promise<void>
}

const placeholderTags: LegacyTag[] = [
  { id: 'untagged', name: 'untagged', count: 0 },
  { id: 'dev', name: 'dev', count: 0 },
  { id: 'ideas', name: 'ideas', count: 0 },
]

export function useLegacyVaultData(): LegacyVaultData {
  const path = useVaultStore((state) => state.path)
  const noteEntries = useVaultStore((state) => state.notes)
  const vaultLoading = useVaultStore((state) => state.isLoading)
  const openVault = useVaultStore((state) => state.openVault)
  const indexReady = useIndexStore((state) => state.ready)
  const indexedRecent = useIndexStore((state) => state.recentNotes)
  const indexedTags = useIndexStore((state) => state.tags)

  return useMemo(() => {
    const notes = noteEntries.map(toLegacyNote)
    const recentEntries = indexedRecent.length > 0 ? indexedRecent : noteEntries
    const recentNotes = recentEntries
      .map((entry) => entry.id)
      .filter((id, index, values) => values.indexOf(id) === index)
      .slice(0, 5)
    return {
      path,
      notes,
      folders: toLegacyFolders(notes),
      tags: toLegacyTags(indexedTags, notes.length),
      recentNotes,
      isLoading: vaultLoading || (path !== null && !indexReady),
      openVault,
    }
  }, [indexReady, indexedRecent, indexedTags, noteEntries, openVault, path, vaultLoading])
}

function toLegacyTags(tags: Array<{ tag: string; count: number }>, noteCount: number): LegacyTag[] {
  if (tags.length > 0) {
    return tags.map((tag) => ({ id: tag.tag, name: tag.tag, count: tag.count }))
  }
  return placeholderTags.map((tag) => ({ ...tag, count: tag.id === 'untagged' ? noteCount : 0 }))
}

function toLegacyNote(entry: NoteEntry): Note {
  return {
    id: entry.id,
    title: entry.title,
    path: entry.path,
    folder: entry.folder || 'Vault',
    tags: [],
    updatedAt: formatMtime(entry.mtime),
    excerpt: `${entry.size} bytes · ${entry.folder || 'Vault'}`,
    body: `# ${entry.title}\n\nOpen this note in the editor flow to load its full Markdown body.`,
    backlinks: [],
  }
}

function toLegacyFolders(notes: Note[]): LegacyFolder[] {
  const counts = new Map<string, number>()
  for (const note of notes) {
    counts.set(note.folder, (counts.get(note.folder) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, count]) => ({ id, name: id, count }))
}

function formatMtime(mtime: number): string {
  const date = new Date(mtime)
  if (Number.isNaN(date.getTime())) {
    return 'Unknown'
  }
  return date.toISOString().slice(0, 16).replace('T', ' ')
}
