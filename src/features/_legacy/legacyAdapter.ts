import { useMemo } from 'react'

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
  const isLoading = useVaultStore((state) => state.isLoading)
  const openVault = useVaultStore((state) => state.openVault)

  return useMemo(() => {
    const notes = noteEntries.map(toLegacyNote)
    return {
      path,
      notes,
      folders: toLegacyFolders(notes),
      tags: placeholderTags.map((tag) => ({ ...tag, count: tag.id === 'untagged' ? notes.length : 0 })),
      recentNotes: [...notes]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 5)
        .map((note) => note.id),
      isLoading,
      openVault,
    }
  }, [isLoading, noteEntries, openVault, path])
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
