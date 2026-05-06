use serde::{Serialize, Serializer};
use thiserror::Error;

/// Canonical error type returned across all IPC boundaries.
/// Serializes as `{"kind": "<Variant>", "message"?: "..."}` so the TS side
/// can pattern-match on `kind`.
#[derive(Debug, Error)]
pub enum IpcError {
    #[error("io error: {0}")]
    Io(String),

    #[error("parse error: {0}")]
    Parse(String),

    #[error("not found")]
    NotFound,

    #[error("conflict at mtime {current_mtime}")]
    Conflict { current_mtime: i64 },

    #[error("{0}")]
    Other(String),
}

impl Serialize for IpcError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        use serde::ser::SerializeMap;
        let mut map = serializer.serialize_map(None)?;
        match self {
            IpcError::Io(m) => {
                map.serialize_entry("kind", "Io")?;
                map.serialize_entry("message", m)?;
            }
            IpcError::Parse(m) => {
                map.serialize_entry("kind", "Parse")?;
                map.serialize_entry("message", m)?;
            }
            IpcError::NotFound => {
                map.serialize_entry("kind", "NotFound")?;
            }
            IpcError::Conflict { current_mtime } => {
                map.serialize_entry("kind", "Conflict")?;
                map.serialize_entry("currentMtime", current_mtime)?;
            }
            IpcError::Other(m) => {
                map.serialize_entry("kind", "Other")?;
                map.serialize_entry("message", m)?;
            }
        }
        map.end()
    }
}

impl From<std::io::Error> for IpcError {
    fn from(value: std::io::Error) -> Self {
        IpcError::Io(value.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn not_found_serializes_to_kind_only() {
        let err = IpcError::NotFound;
        let json = serde_json::to_string(&err).unwrap();
        assert_eq!(json, r#"{"kind":"NotFound"}"#);
    }

    #[test]
    fn io_serializes_with_message() {
        let err = IpcError::Io("file missing".to_string());
        let json = serde_json::to_string(&err).unwrap();
        assert_eq!(json, r#"{"kind":"Io","message":"file missing"}"#);
    }

    #[test]
    fn conflict_serializes_with_current_mtime() {
        let err = IpcError::Conflict { current_mtime: 123 };
        let json = serde_json::to_string(&err).unwrap();
        assert_eq!(json, r#"{"kind":"Conflict","currentMtime":123}"#);
    }
}
