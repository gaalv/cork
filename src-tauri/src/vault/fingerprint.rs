use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant, SystemTime};

const TTL: Duration = Duration::from_secs(2);

#[derive(Debug)]
struct Fingerprint {
    size: u64,
    mtime: SystemTime,
    recorded_at: Instant,
}

#[derive(Debug, Default)]
pub struct FingerprintCache {
    entries: Mutex<HashMap<PathBuf, Fingerprint>>,
}

impl FingerprintCache {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn record(&self, path: impl Into<PathBuf>, size: u64, mtime: SystemTime) {
        let mut entries = self.entries.lock().expect("fingerprint mutex poisoned");
        prune_expired(&mut entries);
        entries.insert(
            path.into(),
            Fingerprint {
                size,
                mtime,
                recorded_at: Instant::now(),
            },
        );
    }

    pub fn pop_recent(&self, path: &Path, size: u64, mtime: SystemTime) -> bool {
        let mut entries = self.entries.lock().expect("fingerprint mutex poisoned");
        prune_expired(&mut entries);
        let Some(fingerprint) = entries.get(path) else {
            return false;
        };

        if fingerprint.size == size && fingerprint.mtime == mtime {
            entries.remove(path);
            return true;
        }

        false
    }
}

fn prune_expired(entries: &mut HashMap<PathBuf, Fingerprint>) {
    let now = Instant::now();
    entries.retain(|_, fingerprint| now.duration_since(fingerprint.recorded_at) < TTL);
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;
    use std::thread;

    use super::*;

    #[test]
    fn pop_recent_hits_for_matching_fingerprint() {
        let cache = FingerprintCache::new();
        let path = PathBuf::from("note.md");
        let mtime = SystemTime::now();

        cache.record(path.clone(), 42, mtime);

        assert!(cache.pop_recent(&path, 42, mtime));
        assert!(!cache.pop_recent(&path, 42, mtime));
    }

    #[test]
    fn pop_recent_misses_when_size_or_mtime_differs() {
        let cache = FingerprintCache::new();
        let path = PathBuf::from("note.md");
        let mtime = SystemTime::now();

        cache.record(path.clone(), 42, mtime);

        assert!(!cache.pop_recent(&path, 43, mtime));
        assert!(!cache.pop_recent(&path, 42, mtime + Duration::from_millis(1)));
    }

    #[test]
    fn expired_entries_are_not_matches() {
        let cache = FingerprintCache::new();
        let path = PathBuf::from("note.md");
        let mtime = SystemTime::now();
        {
            let mut entries = cache.entries.lock().unwrap();
            entries.insert(
                path.clone(),
                Fingerprint {
                    size: 42,
                    mtime,
                    recorded_at: Instant::now() - TTL - Duration::from_millis(1),
                },
            );
        }

        assert!(!cache.pop_recent(&path, 42, mtime));
    }

    #[test]
    fn concurrent_records_and_pops_are_safe() {
        let cache = Arc::new(FingerprintCache::new());
        let mut handles = Vec::new();

        for index in 0..16_u64 {
            let cache = Arc::clone(&cache);
            handles.push(thread::spawn(move || {
                let path = PathBuf::from(format!("note-{index}.md"));
                let mtime = SystemTime::now() + Duration::from_millis(index);
                cache.record(path.clone(), index, mtime);
                cache.pop_recent(&path, index, mtime)
            }));
        }

        assert!(handles.into_iter().all(|handle| handle.join().unwrap()));
    }
}
