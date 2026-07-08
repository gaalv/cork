use std::fs;
use std::path::{Path, PathBuf};

use chrono::{SecondsFormat, Utc};
use serde::Serialize;

use crate::vault::VaultState;
use crate::IpcError;

const SCAFFOLD_VERSION: u8 = 3;
const MARKER_IGNORE_ENTRY: &str = ".cork/scaffold.json";
const SCAFFOLD_FILES: &[(&str, &str)] = &[
    (
        "Welcome.md",
        r#"---
tags: [onboarding, cork]
pinned: true
---

# Welcome to Cork

A fast, local-first workspace for engineers who write a lot of Markdown — notes, plans, designs, daily logs — and want them to stay yours.

> [!tip]
> Open the command palette with `⌘K`. Try `Go to`, `Generate note from topic`, or `Toggle layout`.

## Where to start

- [[README — This Vault]] — what's in here and why
- [[References/Cheatsheet]] — every shortcut and Markdown trick
- [[Engineering/Patterns]] — code-flavored examples
- [[Daily/Today]] — your dependable inbox for each day

## What's wired up

- **Wikilinks + backlinks** — connect notes without ceremony
- **Tags** — `#engineering`, `#zen`, `#project` resurface things
- **Slash menu** — type `/` in the editor for code blocks, callouts, AI
- **Local versioning** — every save is a git commit you can roll back
- **AI insights** — summary, related notes, suggested tags (Settings → AI)
- **Sync** — push your vault to a private GitHub repo when you're ready

```ts
// Cork is just Markdown + SQLite + git.
// Open the vault in any other editor and nothing breaks.
const value = "your notes, your files, forever";
```
"#,
    ),
    (
        "README — This Vault.md",
        r#"---
tags: [onboarding, meta]
---

# README — This Vault

This vault was scaffolded by Cork to show off every feature with realistic, dev-flavored content. Treat it like a playground:

- Edit, rename, or delete anything.
- Empty a folder to start fresh in that area.
- Hit `⌘K` → `Settings` → `Files & Vaults` → `Reveal vault` to see the actual files on disk.

## Folder map

| Folder | What lives there |
| --- | --- |
| `Daily/` | One note per working day |
| `Projects/` | Active project briefs and roadmaps |
| `Engineering/` | Patterns, playbooks, post-mortems |
| `Reading/` | Books, papers, blog posts |
| `Meetings/` | Standups, 1:1s, kickoffs |
| `References/` | Cheatsheets and quick lookups |
| `Zen/` | Less code, more focus |
| `Inbox/` | Anything you don't know where to put yet |

## Conventions used

- Frontmatter: `tags`, `pinned`, `created`, `updated`
- Tasks: `- [ ]` open, `- [x]` done
- Callouts: `> [!note]`, `> [!tip]`, `> [!warning]`
- Wikilinks: `[[Engineering/Patterns]]`
"#,
    ),
    (
        "Daily/Today.md",
        r#"---
tags: [daily]
---

# Daily — Today

Your dependable home for plans, log, and loose thoughts. Replace this template with today's date when you make it your own.

## Focus

- [ ] One thing that, if shipped, makes today worth it
- [ ] Review [[Projects/Cork Roadmap]] follow-ups
- [ ] Close at least one open todo

## Log

- 09:30 — Coffee + inbox triage #daily
- 11:00 — Pairing on [[Engineering/Debugging Playbook]]
- 15:00 — 1:1 — see [[Meetings/1on1 Template]]

## Done

- [x] Opened Cork and didn't immediately get lost
- [ ] Wrote one note worth re-reading next week
"#,
    ),
    (
        "Daily/Yesterday.md",
        r#"---
tags: [daily]
---

# Daily — Yesterday

A second daily note so the calendar view has something to render. Keep, archive, or delete.

## Wins

- Shipped the new triage layout to staging
- Closed two flaky tests in CI

## Friction

- Long debugging detour on a websocket race — see [[Engineering/Debugging Playbook]]

## Tomorrow

- [ ] Land the cache fix
- [ ] Write up the post-mortem in [[Projects/Cork Roadmap]]
"#,
    ),
    (
        "Projects/Cork Roadmap.md",
        r#"---
tags: [project, cork, planning]
pinned: true
---

# Cork Roadmap

A living brief for the Cork project itself. Use it as a template for your own active work.

> [!note]
> One project note per active initiative. Archive when done. Link daily notes to it, not the other way around.

## North star

> A local-first markdown workspace that engineers actually want to live in.

## Now

- Triage layout polish ([[Engineering/Patterns#layouts]])
- AI insights stability
- GitHub sync onboarding

## Next

- Plugin API sketch
- Mobile companion (read-only)

## Architecture

```mermaid
flowchart LR
  UI[React + Tauri shell] --> IPC
  IPC --> Rust[Rust core]
  Rust --> SQLite[(index.sqlite)]
  Rust --> Git[(.git)]
  Rust --> FS[(vault files)]
```

## Decisions log

- 2026-05-01 — Pick git over a custom log for versioning. Cheaper and trusted.
- 2026-05-04 — Triage layout becomes the default for new vaults.

## Open questions

- [ ] Per-vault AI provider override?
- [ ] Should sync support multiple remotes?
"#,
    ),
    (
        "Projects/API Redesign.md",
        r#"---
tags: [project, api, design]
---

# API Redesign

Sketch for the next-gen IPC contract. Keep this in sync with [[Engineering/Patterns]].

## Goals

1. Smaller surface area (kill 30% of methods)
2. Stable across renderer reloads
3. Typed end-to-end

## Method shape

```ts
interface IpcContract {
  notes: {
    list(): Promise<NoteEntry[]>;
    create(input: { folder: string; title: string }): Promise<NoteEntry>;
    trash(path: string): Promise<void>;
  };
}
```

## Migration

- [ ] Generate types from a single source of truth
- [ ] Add per-method timing in dev only
- [ ] Sunset the legacy `ai_send_prompt` command (see [[Projects/Cork Roadmap]])
"#,
    ),
    (
        "Engineering/Patterns.md",
        r#"---
tags: [engineering, patterns, reference]
pinned: true
---

# Engineering Patterns

Small, reusable shapes I keep reaching for. Steal, adapt, and link to them from project notes.

## Result type

```rust
pub enum AppError {
    NotFound,
    Conflict,
    Io(std::io::Error),
}

pub type Result<T> = std::result::Result<T, AppError>;
```

## Debounced effect

```ts
useEffect(() => {
  const id = setTimeout(() => save(buffer), 500);
  return () => clearTimeout(id);
}, [buffer]);
```

## Layouts

Two-pane vs three-pane vs focus mode. The triage layout uses a `Splitter` with grid columns and `flex h-full min-h-0` cells so editors inherit height correctly.

## Boring tech checklist

- [x] SQLite over a custom index
- [x] Git over a custom history format
- [x] Markdown over a custom doc format
- [ ] One queue, not three
"#,
    ),
    (
        "Engineering/Debugging Playbook.md",
        r#"---
tags: [engineering, debugging]
---

# Debugging Playbook

A short loop I trust when something is on fire.

> [!warning]
> Resist the urge to "just try things." Form a hypothesis first.

## The loop

1. Reproduce on demand
2. Bisect the change set
3. Form a hypothesis (write it down)
4. Test the cheapest prediction first
5. Fix, then add a regression test

## Useful prompts

- What changed in the last 24h?
- What's the smallest input that still fails?
- What does the system *think* is happening (logs, metrics)?
- What would I tell a colleague to try?

## Common traps

- Caching, especially silent ones
- Time zones at the boundary
- Async ordering in tests
- Stale build artifacts
"#,
    ),
    (
        "Engineering/Observability.md",
        r#"---
tags: [engineering, observability]
---

# Observability

Notes for keeping production legible without drowning in dashboards.

## Three signals

| Signal | What it answers | Tool |
| --- | --- | --- |
| Logs | What happened? | structured JSON |
| Metrics | How much / how often? | Prometheus |
| Traces | Where did time go? | OpenTelemetry |

## Golden signals

- Latency
- Traffic
- Errors
- Saturation

## Alert hygiene

- Every alert must be actionable.
- If it pages twice without action, delete or fix it.
- Runbooks live next to the alert, not in a wiki nobody opens.
"#,
    ),
    (
        "Reading/Books.md",
        r#"---
tags: [reading, books]
---

# Reading — Books

A short, opinionated list. Add yours.

| Title | Author | Status |
| --- | --- | --- |
| A Philosophy of Software Design | John Ousterhout | reading |
| The Pragmatic Programmer | Hunt & Thomas | re-read |
| Designing Data-Intensive Applications | Martin Kleppmann | done |
| Working in Public | Nadia Eghbal | queued |
| The Manager's Path | Camille Fournier | done |
"#,
    ),
    (
        "Reading/Papers.md",
        r#"---
tags: [reading, papers]
---

# Reading — Papers

Pick one a week. Take notes.

- **Out of the Tar Pit** — Moseley & Marks. Complexity is the enemy.
- **A Note on Distributed Computing** — Waldo et al. Locality matters.
- **Dynamo: Amazon's Highly Available Key-value Store** — DeCandia et al.
- **CRDTs: Consistency without Consensus** — Shapiro et al.

> [!tip]
> Capture one quote and one open question per paper. That's it.
"#,
    ),
    (
        "References/Cheatsheet.md",
        r#"---
tags: [reference, cheatsheet]
pinned: true
---

# Cheatsheet

Everything I forget twice a week.

## Shortcuts

| Action | Shortcut |
| --- | --- |
| Command palette | ⌘K |
| New note | ⌘N |
| Toggle inspector | ⌘. |
| Toggle layout | (palette) |
| Save (manual) | ⌘S |

## Markdown extras

- Callouts: `> [!note]`, `> [!tip]`, `> [!warning]`
- Footnotes: `Here's a claim[^1]` then `[^1]: source`
- Math: `$E = mc^2$` or block `$$ ... $$`
- Mermaid:

```mermaid
graph TD
  A[Idea] --> B[Note]
  B --> C[Project]
  C --> D[Ship]
```

## Git inside the vault

```bash
git -C "$VAULT" log --oneline -n 10
git -C "$VAULT" diff HEAD~1 -- README\ —\ This\ Vault.md
```
"#,
    ),
    (
        "References/Markdown Syntax.md",
        r#"---
tags: [reference, markdown]
---

# Markdown Syntax

A round-trip example that exercises most of what Cork renders.

## Inline

**bold**, *italic*, ~~strike~~, `inline code`, [link](https://example.com), [[Welcome]].

## Blocks

> A blockquote with a [[Reading/Books|wikilink alias]].

```python
def fizzbuzz(n: int) -> str:
    if n % 15 == 0: return "FizzBuzz"
    if n % 3 == 0: return "Fizz"
    if n % 5 == 0: return "Buzz"
    return str(n)
```

## Lists

- Unordered
  - Nested
- With **inline** formatting

1. Ordered
2. Items
   1. Nested

## Tasks

- [ ] Open
- [x] Done
- [ ] With a [[link]]

## Tables

| Left | Center | Right |
| :--- | :---: | ---: |
| a | b | c |
"#,
    ),
    (
        "References/Git Aliases.md",
        r#"---
tags: [reference, git]
---

# Git Aliases

Drop these into `~/.gitconfig`.

```ini
[alias]
  st = status -sb
  co = checkout
  br = branch
  lg = log --oneline --graph --decorate -n 20
  amend = commit --amend --no-edit
  undo = reset --soft HEAD~1
```

## Useful one-liners

```bash
# Show branches sorted by last commit
git for-each-ref --sort=-committerdate refs/heads/ \
  --format='%(refname:short) %(committerdate:relative)'

# Wipe everything Git is ignoring (careful!)
git clean -fdx
```
"#,
    ),
    (
        "Meetings/Kickoff 2026-05-07.md",
        r#"---
tags: [meeting, kickoff]
---

# Kickoff — 2026-05-07

## Attendees

- You
- Future teammates
- Cork, quietly keeping context

## Agenda

1. Agree on what this vault is for
2. Pick the first project to keep current
3. Decide where daily notes fit your routine

## Notes

- [[Welcome]] should be the front door, not a manual.
- [[Projects/Cork Roadmap]] becomes the running brief.
- Daily notes are best for motion; project notes are best for memory.

## Action items

- [ ] Rename the first project
- [ ] Add one real meeting note
- [ ] Archive scaffold notes you don't need
"#,
    ),
    (
        "Meetings/1on1 Template.md",
        r#"---
tags: [meeting, 1on1, template]
---

# 1:1 Template

Reusable structure. Copy this note, rename to the date, and fill in.

## Wins since last time

- 

## Blockers

- 

## Career / growth

- 

## Feedback (both directions)

- 

## Action items

- [ ] 
- [ ] 
"#,
    ),
    (
        "Inbox/Quick Capture.md",
        r#"---
tags: [inbox]
---

# Quick Capture

Anything you don't know where to put yet. Triage weekly:

- Promote to a project note → `Projects/`
- Promote to a reference → `References/`
- Turn it into a task checkbox (`- [ ]`)
- Delete if it's already stale
"#,
    ),
    (
        "Zen/On Focus.md",
        r#"---
tags: [zen, focus]
---

# On Focus

> The shortest path to better work is fewer open browser tabs.

A small reminder that ships in every Cork vault. Edit it, delete it, replace it with your own.

## A practice

1. Pick one note as today's anchor.
2. Toggle focus mode (`⌘.` hides the inspector).
3. Set a 25 minute timer.
4. When the timer ends, log what changed in [[Daily/Today]].

## A reading list

- Deep Work — Cal Newport
- A Philosophy of Software Design — John Ousterhout
- Anything that doesn't have notifications
"#,
    ),
];

/// Default note templates (F39). Kept OUT of `SCAFFOLD_FILES` on purpose:
/// the version-refresh path overwrites scaffold files, but templates are
/// user-owned after first seed — they are only ever created if missing,
/// never overwritten or resurrected with different content.
const TEMPLATE_FILES: &[(&str, &str)] = &[
    (
        "Templates/Meeting.md",
        r#"---
tags: [meeting]
---

# Meeting — {{date}}

## Attendees

-

## Agenda

1.

## Notes

{{cursor}}

## Action items

- [ ]
- [ ] Log follow-ups in [[Daily/Today]]
"#,
    ),
    (
        "Templates/Project.md",
        r#"---
tags: [project]
status: active
---

# {{title}}

## Goal

> One sentence describing what shipped looks like.

## Context

Why now? Link the notes that led here, e.g. [[Projects/Cork Roadmap]].

## Milestones

- [ ] Spike / prototype
- [ ] First end-to-end slice
- [ ] Polish + ship

## Links

- [[Daily/Today]]
-
"#,
    ),
    (
        "Templates/Bug Report.md",
        r#"---
tags: [bug]
---

# {{title}}

## Environment

- App version:
- OS:
- Reproduces on: main? release?

## Steps to reproduce

1.

## Expected

-

## Actual

-

## Hypothesis

{{cursor}}

> [!tip]
> Resist "just trying things" — see [[Engineering/Debugging Playbook]].
"#,
    ),
    (
        "Templates/Decision.md",
        r#"---
tags: [decision]
---

# {{title}}

- Date: {{date}}
- Status: proposed

## Context

What forces are at play? Link the relevant notes, e.g. [[Engineering/Patterns]].

## Options considered

1. **Option A** —
2. **Option B** —

## Decision

{{cursor}}

## Consequences

-
"#,
    ),
];

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScaffoldResult {
    pub created: bool,
    pub files: Vec<String>,
}

#[derive(Serialize)]
struct ScaffoldMarker<'a> {
    version: u8,
    created_at: &'a str,
}

#[tauri::command]
pub fn vault_scaffold_if_needed(
    state: tauri::State<'_, VaultState>,
) -> Result<ScaffoldResult, IpcError> {
    let root = state.current_path().ok_or(IpcError::NotFound)?;
    let created_at = Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true);
    scaffold_if_needed_at(&root, &created_at)
}

pub(crate) fn scaffold_if_needed_at(
    vault_root: &Path,
    created_at: &str,
) -> Result<ScaffoldResult, IpcError> {
    let marker = marker_path(vault_root);
    if marker.exists() {
        let existing_version = read_marker_version(&marker).unwrap_or(0);
        if existing_version >= SCAFFOLD_VERSION {
            return Ok(ScaffoldResult {
                created: false,
                files: Vec::new(),
            });
        }
        // Older scaffold version — refresh files in place. We overwrite scaffold
        // paths so users get the new corpus, but we never touch user-created
        // files outside SCAFFOLD_FILES.
        let mut refreshed_files = Vec::new();
        for (relative_path, content) in SCAFFOLD_FILES {
            let target = vault_root.join(relative_path);
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::write(&target, content)?;
            refreshed_files.push((*relative_path).to_string());
        }
        seed_templates(vault_root, &mut refreshed_files)?;
        ensure_marker_gitignored(vault_root)?;
        write_marker(&marker, created_at)?;
        return Ok(ScaffoldResult {
            created: true,
            files: refreshed_files,
        });
    }

    let mut created_files = Vec::new();
    for (relative_path, content) in SCAFFOLD_FILES {
        let target = vault_root.join(relative_path);
        if target.exists() {
            continue;
        }
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(&target, content)?;
        created_files.push((*relative_path).to_string());
    }

    seed_templates(vault_root, &mut created_files)?;
    ensure_marker_gitignored(vault_root)?;
    write_marker(&marker, created_at)?;

    Ok(ScaffoldResult {
        created: true,
        files: created_files,
    })
}

/// Seed default templates create-if-missing. Runs on BOTH the fresh scaffold
/// and the version-refresh path — an existing template file (edited or not)
/// must never be overwritten, and a deleted one is only recreated by a
/// version bump, matching the "user owns Templates/" rule from F39.
fn seed_templates(vault_root: &Path, created_files: &mut Vec<String>) -> Result<(), IpcError> {
    for (relative_path, content) in TEMPLATE_FILES {
        let target = vault_root.join(relative_path);
        if target.exists() {
            continue;
        }
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(&target, content)?;
        created_files.push((*relative_path).to_string());
    }
    Ok(())
}

fn read_marker_version(marker: &Path) -> Option<u8> {
    let raw = fs::read_to_string(marker).ok()?;
    let parsed: serde_json::Value = serde_json::from_str(&raw).ok()?;
    parsed.get("version").and_then(|v| v.as_u64()).map(|v| v as u8)
}

fn marker_path(vault_root: &Path) -> PathBuf {
    vault_root.join(".cork").join("scaffold.json")
}

fn ensure_marker_gitignored(vault_root: &Path) -> Result<(), IpcError> {
    let path = vault_root.join(".gitignore");
    let existing = if path.exists() {
        fs::read_to_string(&path)?
    } else {
        String::new()
    };
    if existing
        .lines()
        .any(|line| line.trim() == MARKER_IGNORE_ENTRY)
    {
        return Ok(());
    }

    let mut next = existing;
    if !next.is_empty() && !next.ends_with('\n') {
        next.push('\n');
    }
    next.push_str(MARKER_IGNORE_ENTRY);
    next.push('\n');
    fs::write(path, next)?;
    Ok(())
}

fn write_marker(marker: &Path, created_at: &str) -> Result<(), IpcError> {
    if let Some(parent) = marker.parent() {
        fs::create_dir_all(parent)?;
    }
    let payload = serde_json::to_string_pretty(&ScaffoldMarker {
        version: SCAFFOLD_VERSION,
        created_at,
    })
    .map_err(|err| IpcError::Parse(err.to_string()))?;
    fs::write(marker, payload)?;
    Ok(())
}
