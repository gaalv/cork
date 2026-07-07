use std::path::{Path, PathBuf};

use sha1::{Digest, Sha1};

pub fn vault_hash(vault_path: &Path) -> String {
    let normalized = vault_path.to_string_lossy();
    let mut hasher = Sha1::new();
    hasher.update(normalized.as_bytes());
    hasher
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

pub fn index_db_path(app_data_dir: &Path, vault_path: &Path) -> PathBuf {
    app_data_dir
        .join("vaults")
        .join(vault_hash(vault_path))
        .join("index.sqlite")
}
