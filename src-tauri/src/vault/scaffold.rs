use std::fs;
use std::path::{Path, PathBuf};

use chrono::{SecondsFormat, Utc};
use serde::Serialize;

use crate::todos::{load_todos, save_todos, Todo, TodoList};
use crate::vault::VaultState;
use crate::IpcError;

const SCAFFOLD_VERSION: u8 = 1;
const SEED_TODOS: [&str; 3] = [
    "Read the Welcome note",
    "Try the command palette (⌘K)",
    "Pin a note from its menu",
];
const SCAFFOLD_FILES: &[(&str, &str)] = &[
    (
        "Welcome.md",
        r#"# Welcome to Noxe

Noxe is a local-first workspace for fast Markdown notes, daily planning, lightweight todos, and calm project context. Start by exploring [[Projects/Noxe Showcase]], then make this vault yours.

## Try this first

- [ ] Open the command palette with `⌘K`
- [ ] Jump to [[Daily/2026-05-08]] and add one plan
- [ ] Capture a task in the Open Todos card
- [ ] Pin [[Cheatsheet]] from the note menu

## What to notice

- Live [[wikilinks]] connect notes without ceremony.
- Tags like #onboarding and #noxe make resurfacing easy.
- Daily notes give each day a dependable home.
- Todos stay local in `.noxe/todos.json` until you choose to sync.
- Calendar and sync views are designed around plain files, not lock-in.

```ts
const bestNote = "short, linked, and easy to revisit";
```
"#,
    ),
    (
        "Daily/2026-05-08.md",
        r#"# Daily — 2026-05-08

Daily notes are a low-friction inbox: plans, loose thoughts, meeting links, and tiny decisions all get one obvious place to land.

## Focus

- Ship a polished first-run experience for [[Welcome]]
- Review [[Meetings/2026-05-07 Kickoff]] for follow-ups
- Keep today small enough to finish

## Log

- 09:30 — Sketched onboarding flow #daily
- 11:00 — Linked the showcase project and cheatsheet

## Done today

- [x] Created a useful example vault
- [ ] Replace these examples with your real work
"#,
    ),
    (
        "Projects/Noxe Showcase.md",
        r#"# Noxe Showcase

A tiny project note that demonstrates structure, backlinks, media placeholders, and Mermaid diagrams. Mentioning [[Welcome]] here creates a backlink you can inspect from the note view.

## Outcome

Give every new vault enough shape to answer: “what should I do next?”

## System sketch

```mermaid
flowchart LR
  Vault[Local vault] --> Notes[Markdown notes]
  Notes --> Links[Wikilinks + backlinks]
  Notes --> Todos[Open todos]
  Notes --> Calendar[Daily notes]
```

## Evidence

![Dashboard screenshot placeholder](assets/noxe-dashboard.png)

## Decisions

- Keep examples short and delete-friendly.
- Prefer opinionated notes over exhaustive documentation.
- Use plain Markdown so the scaffold is useful outside Noxe too.

## Next steps

- [ ] Turn one section into your first real project note
- [ ] Add a tag like #project to notes you want grouped together
"#,
    ),
    (
        "Meetings/2026-05-07 Kickoff.md",
        r#"# Kickoff — 2026-05-07

#meetings #onboarding

## Attendees

- You
- Future teammates
- Noxe, quietly keeping context

## Agenda

1. Agree what this vault is for
2. Pick the first project note to keep current
3. Decide where daily notes fit your routine

## Notes

- [[Welcome]] should be the front door, not a manual.
- [[Projects/Noxe Showcase]] can be copied for future project briefs.
- Daily notes are best for motion; project notes are best for memory.

## Action items

- [ ] Rename the showcase project
- [ ] Add one real meeting note
- [ ] Archive or delete any scaffold note you do not need
"#,
    ),
    (
        "Cheatsheet.md",
        r#"# Noxe Cheatsheet

A compact reference for the Markdown patterns Noxe understands.

## Links and tags

- `[[Welcome]]` links to a note by title.
- `[[Projects/Noxe Showcase]]` links across folders.
- `#tags` make notes easier to group and rediscover.

## Tasks

- [ ] Open task
- [x] Completed task

## Code

```bash
pnpm typecheck
pnpm exec vitest run
```

## Diagrams

```mermaid
sequenceDiagram
  participant You
  participant Noxe
  You->>Noxe: Write a note
  Noxe-->>You: Links, todos, and context stay connected
```

## Daily habit

Create or open today’s note, capture what changed, and link the longer-lived context when it matters.
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
        return Ok(ScaffoldResult {
            created: false,
            files: Vec::new(),
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

    seed_todos_if_empty(vault_root, created_at)?;
    write_marker(&marker, created_at)?;

    Ok(ScaffoldResult {
        created: true,
        files: created_files,
    })
}

fn marker_path(vault_root: &Path) -> PathBuf {
    vault_root.join(".noxe").join("scaffold.json")
}

fn todos_path(vault_root: &Path) -> PathBuf {
    vault_root.join(".noxe").join("todos.json")
}

fn seed_todos_if_empty(vault_root: &Path, created_at: &str) -> Result<(), IpcError> {
    let path = todos_path(vault_root);
    let should_seed = if !path.exists() {
        true
    } else {
        let text = fs::read_to_string(&path)?;
        text.trim().is_empty() || load_todos(vault_root)?.todos.is_empty()
    };

    if !should_seed {
        return Ok(());
    }

    let list = TodoList {
        todos: SEED_TODOS
            .iter()
            .enumerate()
            .map(|(index, text)| Todo {
                id: format!("onboarding-{}", index + 1),
                text: (*text).to_string(),
                done: false,
                created_at: created_at.to_string(),
                completed_at: None,
            })
            .collect(),
    };
    save_todos(vault_root, &list)
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scaffold_is_idempotent_after_marker_exists() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        let created_at = "2026-05-08T12:00:00Z";

        let first = scaffold_if_needed_at(root, created_at).unwrap();
        assert!(first.created);
        assert_eq!(first.files.len(), SCAFFOLD_FILES.len());
        assert!(root.join("Welcome.md").exists());
        assert!(root.join("Daily/2026-05-08.md").exists());
        assert!(root.join(".noxe/scaffold.json").exists());
        assert_eq!(load_todos(root).unwrap().todos.len(), 3);

        fs::write(root.join("Welcome.md"), "keep me").unwrap();
        let second = scaffold_if_needed_at(root, created_at).unwrap();

        assert!(!second.created);
        assert!(second.files.is_empty());
        assert_eq!(fs::read_to_string(root.join("Welcome.md")).unwrap(), "keep me");
        assert_eq!(load_todos(root).unwrap().todos.len(), 3);
    }
}
