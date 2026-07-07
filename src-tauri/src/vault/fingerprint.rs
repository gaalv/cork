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
