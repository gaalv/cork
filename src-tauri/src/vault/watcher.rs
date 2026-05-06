use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, UNIX_EPOCH};

use notify_debouncer_mini::notify::RecursiveMode;
use notify_debouncer_mini::{new_debouncer, DebounceEventResult, DebouncedEventKind, Debouncer};
use serde::{Deserialize, Serialize};

use crate::vault::fingerprint::FingerprintCache;
use crate::IpcError;

const DEBOUNCE: Duration = Duration::from_millis(200);

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultFileChangedEvent {
    pub path: PathBuf,
    pub kind: FileChangeKind,
    pub source: FileChangeSource,
    pub mtime: i64,
    pub size: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FileChangeKind {
    Created,
    Modified,
    Removed,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FileChangeSource {
    Internal,
    External,
}

type Watcher = Debouncer<notify_debouncer_mini::notify::RecommendedWatcher>;
pub type VaultEventSink = Arc<dyn Fn(VaultFileChangedEvent) + Send + Sync + 'static>;

pub struct WatcherHandle {
    debouncer: Watcher,
}

impl WatcherHandle {
    fn new(debouncer: Watcher) -> Self {
        Self { debouncer }
    }

    pub fn keepalive(&self) {
        let _ = &self.debouncer;
    }
}

#[derive(Default)]
pub struct WatcherController {
    handle: Mutex<Option<WatcherHandle>>,
}

impl WatcherController {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn start(
        &self,
        root: PathBuf,
        cache: Arc<FingerprintCache>,
        sink: VaultEventSink,
    ) -> Result<(), IpcError> {
        let mut handle = self.handle.lock().expect("watcher mutex poisoned");
        if handle.is_some() {
            return Ok(());
        }

        let root = root.canonicalize()?;
        let root_for_handler = root.clone();
        let mut debouncer = new_debouncer(DEBOUNCE, move |result: DebounceEventResult| {
            if let Ok(events) = result {
                for event in events {
                    if event.kind == DebouncedEventKind::AnyContinuous {
                        continue;
                    }
                    if let Some(change) = event_to_change(&root_for_handler, &event.path, &cache) {
                        sink(change);
                    }
                }
            }
        })
        .map_err(|err| IpcError::Io(err.to_string()))?;

        notify_debouncer_mini::notify::Watcher::watch(
            debouncer.watcher(),
            &root,
            RecursiveMode::Recursive,
        )
        .map_err(|err| IpcError::Io(err.to_string()))?;
        *handle = Some(WatcherHandle::new(debouncer));
        Ok(())
    }

    pub fn stop(&self) {
        let mut handle = self.handle.lock().expect("watcher mutex poisoned");
        *handle = None;
    }

    pub fn is_running(&self) -> bool {
        self.handle.lock().expect("watcher mutex poisoned").is_some()
    }
}

fn event_to_change(
    root: &Path,
    path: &Path,
    cache: &FingerprintCache,
) -> Option<VaultFileChangedEvent> {
    if !is_markdown(path) || is_hidden(path, root) {
        return None;
    }

    match fs::metadata(path) {
        Ok(metadata) => {
            let canonical_path = path.canonicalize().ok()?;
            let mtime = metadata.modified().ok()?;
            if cache.pop_recent(&canonical_path, metadata.len(), mtime) {
                return None;
            }
            Some(VaultFileChangedEvent {
                path: canonical_path,
                kind: FileChangeKind::Modified,
                source: FileChangeSource::External,
                mtime: system_time_ms(mtime)?,
                size: metadata.len(),
            })
        }
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Some(VaultFileChangedEvent {
            path: path.to_path_buf(),
            kind: FileChangeKind::Removed,
            source: FileChangeSource::External,
            mtime: 0,
            size: 0,
        }),
        Err(_) => None,
    }
}

fn is_hidden(path: &Path, root: &Path) -> bool {
    let relative = path.strip_prefix(root).unwrap_or(path);
    relative.components().any(|component| match component {
        Component::Normal(name) => name.to_str().is_some_and(|name| name.starts_with('.')),
        _ => false,
    })
}

fn is_markdown(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("md"))
}

fn system_time_ms(time: std::time::SystemTime) -> Option<i64> {
    Some(time.duration_since(UNIX_EPOCH).ok()?.as_millis() as i64)
}

#[cfg(test)]
mod tests {
    use std::sync::mpsc;
    use std::thread;

    use tempfile::tempdir;

    use crate::vault::io::{save_atomic, metadata_mtime_ms};
    use crate::vault::SaveInput;

    use super::*;

    #[test]
    fn start_and_stop_are_idempotent() {
        let dir = tempdir().unwrap();
        let controller = WatcherController::new();
        let cache = Arc::new(FingerprintCache::new());
        let sink: VaultEventSink = Arc::new(|_| {});

        controller
            .start(dir.path().to_path_buf(), Arc::clone(&cache), Arc::clone(&sink))
            .unwrap();
        controller.start(dir.path().to_path_buf(), cache, sink).unwrap();
        assert!(controller.is_running());
        controller.stop();
        controller.stop();
        assert!(!controller.is_running());
    }

    #[test]
    fn touching_files_in_burst_emits_at_most_one_event_per_file() {
        let dir = tempdir().unwrap();
        let controller = WatcherController::new();
        let cache = Arc::new(FingerprintCache::new());
        let (tx, rx) = mpsc::channel();
        let sink: VaultEventSink = Arc::new(move |event| {
            tx.send(event).unwrap();
        });
        controller
            .start(dir.path().to_path_buf(), cache, sink)
            .unwrap();

        for index in 0..50 {
            fs::write(dir.path().join(format!("note-{index}.md")), format!("# {index}")).unwrap();
        }

        thread::sleep(Duration::from_millis(700));
        let events = rx.try_iter().collect::<Vec<_>>();
        assert!(!events.is_empty());
        assert!(events.len() <= 50);
        assert!(events.iter().all(|event| event.source == FileChangeSource::External));
    }

    #[test]
    fn internal_save_events_are_suppressed() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("note.md");
        fs::write(&path, "seed").unwrap();
        let current_mtime = metadata_mtime_ms(&fs::metadata(&path).unwrap()).unwrap();
        let controller = WatcherController::new();
        let cache = Arc::new(FingerprintCache::new());
        let (tx, rx) = mpsc::channel();
        let sink: VaultEventSink = Arc::new(move |event| {
            tx.send(event).unwrap();
        });
        controller
            .start(dir.path().to_path_buf(), Arc::clone(&cache), sink)
            .unwrap();

        save_atomic(
            &SaveInput {
                path: path.clone(),
                frontmatter: serde_json::Value::Object(serde_json::Map::new()),
                body: "internal".to_string(),
                expected_mtime: Some(current_mtime),
            },
            &cache,
        )
        .unwrap();

        thread::sleep(Duration::from_millis(700));
        let events = rx.try_iter().collect::<Vec<_>>();
        assert_eq!(events.len(), 0);
    }
}
