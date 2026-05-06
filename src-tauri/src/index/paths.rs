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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn vault_hash_is_stable_sha1_hex() {
        let hash = vault_hash(Path::new("/vault/path"));
        assert_eq!(hash.len(), 40);
        assert_eq!(hash, vault_hash(Path::new("/vault/path")));
    }

    #[test]
    fn index_db_path_is_scoped_by_vault_hash() {
        let path = index_db_path(Path::new("/app"), Path::new("/vault"));
        assert!(path.ends_with("index.sqlite"));
        assert!(path.to_string_lossy().contains("/app/vaults/"));
    }
}
