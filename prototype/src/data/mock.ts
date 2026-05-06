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

export const folders = [
  { id: 'inbox', name: 'Inbox', count: 4 },
  { id: 'projects', name: 'Projects', count: 7 },
  { id: 'projects/noxe', name: 'Projects / Noxe', count: 5 },
  { id: 'reading', name: 'Reading', count: 12 },
  { id: 'daily', name: 'Daily Notes', count: 31 },
  { id: 'archive', name: 'Archive', count: 84 },
]

export const tags = [
  { id: 'dev/rust', name: 'dev/rust', count: 8 },
  { id: 'dev/typescript', name: 'dev/typescript', count: 14 },
  { id: 'design', name: 'design', count: 9 },
  { id: 'product', name: 'product', count: 6 },
  { id: 'ideas', name: 'ideas', count: 17 },
]

export const notes: Note[] = [
  {
    id: 'n1',
    title: 'Noxe — Visão e princípios',
    path: 'projects/noxe/visao.md',
    folder: 'projects/noxe',
    tags: ['product', 'ideas'],
    updatedAt: '2026-05-06 13:42',
    excerpt:
      'Notas locais como fonte da verdade. Editor first-class para devs. Conhecimento conectado via [[wikilinks]].',
    body: `# Noxe — Visão e princípios

Notas locais como fonte da verdade. **Editor first-class para devs**. Conhecimento conectado via [[wikilinks]] e backlinks.

## Pilares

1. Você é dono dos dados — \`.md\` no disco
2. Feito para devs — Shiki, Mermaid, KaTeX
3. Conhecimento conectado — wikilinks, backlinks, graph
4. Sync opcional E2E, self-hostable

## Inspirações

Mistura de [[Obsidian — vault e plugins]] com [[Inkdrop — UX para devs]], seguindo a stack do [[Tolaria — referência técnica]].

\`\`\`ts
type Note = { title: string; tags: string[] }
\`\`\`

> "Suas notas, conectadas." — \`notes\` + \`nexus\`
`,
    backlinks: ['Roadmap v1', 'Stack — decisões'],
  },
  {
    id: 'n2',
    title: 'Roadmap v1',
    path: 'projects/noxe/roadmap.md',
    folder: 'projects/noxe',
    tags: ['product'],
    updatedAt: '2026-05-06 11:08',
    excerpt:
      'M0 fundação · M1 vault & editor · M2 wikilinks & backlinks · M3 polish · M4 release.',
    body: `# Roadmap v1

- M0 — Fundação (Tauri + React + Vite)
- M1 — Vault & editor MVP
- M2 — Wikilinks & backlinks
- M3 — UX polish (command palette, daily notes)
- M4 — Release prep
`,
    backlinks: ['Noxe — Visão e princípios'],
  },
  {
    id: 'n3',
    title: 'Stack — decisões',
    path: 'projects/noxe/stack.md',
    folder: 'projects/noxe',
    tags: ['dev/rust', 'dev/typescript'],
    updatedAt: '2026-05-06 10:55',
    excerpt: 'Tauri 2 + React 19 + Vite + Tailwind v4 + CodeMirror 6 + SQLite.',
    body: `# Stack — decisões

Seguindo a stack do [[Tolaria — referência técnica]]:

- **Tauri 2** — runtime desktop
- **React 19 + Vite** — frontend
- **Tailwind v4** — estilos
- **CodeMirror 6** — editor
- **SQLite** — índice/metadata
- **Shiki** — highlighting
`,
    backlinks: ['Noxe — Visão e princípios'],
  },
  {
    id: 'n4',
    title: 'Tolaria — referência técnica',
    path: 'reading/tolaria.md',
    folder: 'reading',
    tags: ['dev/typescript', 'product'],
    updatedAt: '2026-05-05 18:30',
    excerpt:
      'Files-first, git-first, offline-first, AI-first mas não AI-only. Keyboard-first.',
    body: `# Tolaria — referência técnica

Princípios:
- Files-first
- Git-first (vault = repo git)
- Offline-first, zero lock-in
- AI-first mas não AI-only
- Keyboard-first

Stack: Tauri 2, React 19, Vite, Tailwind v4, Mantine, Radix, BlockNote, CodeMirror, Phosphor.
`,
    backlinks: ['Stack — decisões', 'Noxe — Visão e princípios'],
  },
  {
    id: 'n5',
    title: 'Daily — 2026-05-06',
    path: 'daily/2026-05-06.md',
    folder: 'daily',
    tags: ['ideas'],
    updatedAt: '2026-05-06 09:00',
    excerpt: 'Pensei em três layouts para o app. Decisão antes de codar features.',
    body: `# Daily — 2026-05-06

## Foco
- [ ] Definir layout do Noxe
- [x] Inicializar projeto (.specs)
- [ ] Validar stack alinhada com [[Tolaria — referência técnica]]

## Ideias soltas
Talvez separar inbox de notas regulares como o Tolaria faz.
`,
    backlinks: [],
  },
  {
    id: 'n6',
    title: 'Wikilinks — design',
    path: 'projects/noxe/wikilinks.md',
    folder: 'projects/noxe',
    tags: ['dev/typescript', 'design'],
    updatedAt: '2026-05-04 22:15',
    excerpt: 'Sintaxe [[título]]. Resolução por título normalizado, fallback para path.',
    body: `# Wikilinks — design

Sintaxe: \`[[título da nota]]\`. Autocomplete dentro do editor.

Resolução:
1. match exato pelo título
2. fuzzy no índice SQLite
3. criar nova nota no clique se não existir
`,
    backlinks: ['Noxe — Visão e princípios'],
  },
  {
    id: 'n7',
    title: 'Inkdrop — UX para devs',
    path: 'reading/inkdrop.md',
    folder: 'reading',
    tags: ['design'],
    updatedAt: '2026-05-03 14:10',
    excerpt: 'Three-pane clássico. Code blocks polidos. Sync nativo. Markdown puro.',
    body: `# Inkdrop — UX para devs

Layout three-pane (sidebar / lista / editor) é o que faz parecer "feito para devs".
Code blocks com tema próprio + highlights consistentes.
`,
    backlinks: ['Noxe — Visão e princípios'],
  },
  {
    id: 'n8',
    title: 'Obsidian — vault e plugins',
    path: 'reading/obsidian.md',
    folder: 'reading',
    tags: ['design'],
    updatedAt: '2026-05-02 19:40',
    excerpt: 'Vault local, graph view, comunidade enorme de plugins.',
    body: `# Obsidian — vault e plugins

Pontos fortes: vault \`.md\` local, graph view, plugins.
Pontos fracos: UX inconsistente entre plugins, performance em vaults grandes.
`,
    backlinks: ['Noxe — Visão e princípios'],
  },
]

export const recentNotes = ['n1', 'n5', 'n2', 'n6', 'n3'] as const
