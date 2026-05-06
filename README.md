# Noxe

Um app de notas Markdown que combina o melhor do **Obsidian** (vault local, wikilinks, plugins) e do **Inkdrop** (UX polida para devs, code blocks ricos, sync nativo).

> **Noxe** — `notes` + `nexus`. Suas notas, conectadas.

## Visão

- **Você é dono dos dados**: arquivos `.md` locais como fonte da verdade.
- **Feito para devs**: editor com syntax highlighting top-tier, snippets, Mermaid, KaTeX.
- **Conhecimento conectado**: wikilinks, backlinks, graph view e busca semântica via AI.
- **Sync opcional E2E criptografado**, self-hostable.

## Funcionalidades planejadas

### Núcleo
- [ ] Vault baseado em arquivos `.md` locais
- [ ] Editor Markdown (CodeMirror 6) com preview live
- [ ] Wikilinks `[[nota]]` + autocomplete
- [ ] Backlinks automáticos
- [ ] Graph view interativo
- [ ] Tags hierárquicas (`#dev/rust`)
- [ ] Múltiplos vaults / notebooks
- [ ] Command palette
- [ ] Daily notes + templates

### Para devs
- [ ] Syntax highlighting via Shiki
- [ ] Code blocks executáveis (notebook mode)
- [ ] Mermaid, PlantUML, KaTeX nativos
- [ ] Snippets com variáveis
- [ ] MDX / componentes embutidos

### Sync & colaboração
- [ ] Sync E2E (Yjs/Automerge CRDT)
- [ ] Backend self-hostable
- [ ] Git como backend alternativo
- [ ] Compartilhamento via link público

### AI
- [ ] Busca semântica local (embeddings)
- [ ] Chat com seu vault (RAG)
- [ ] Sugestão automática de links

### Multiplataforma
- [ ] Desktop (Tauri)
- [ ] Mobile (Capacitor ou React Native)
- [ ] Web

### Importação
- [ ] Obsidian
- [ ] Inkdrop
- [ ] Notion
- [ ] Markdown genérico

## Stack proposta

- **Tauri** (Rust + WebView) — runtime desktop leve
- **TypeScript + React** — frontend
- **CodeMirror 6** — editor
- **SQLite** — índice/metadata (arquivos `.md` permanecem no disco)
- **Yjs** — CRDT para sync
- **Shiki** — syntax highlighting

## Status

🚧 Projeto recém-iniciado.
