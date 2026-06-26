# F37 — CRDT Sync: Design

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Frontend (WebView)                     │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                    NoteView                            │  │
│  │                                                       │  │
│  │  ┌─────────────┐    ┌──────────────────────────────┐  │  │
│  │  │ CodeMirror 6 │◄──►│  y-codemirror.next (yCollab) │  │  │
│  │  └──────────────┘    └──────────┬───────────────────┘  │  │
│  │                                 │                      │  │
│  │                          ┌──────┴──────┐               │  │
│  │                          │   Y.Doc     │               │  │
│  │                          │  ┌────────┐ │               │  │
│  │                          │  │ Y.Text │ │ ← note body  │  │
│  │                          │  │ Y.Map  │ │ ← frontmatter│  │
│  │                          │  └────────┘ │               │  │
│  │                          └──┬───┬───┬──┘               │  │
│  │                             │   │   │                  │  │
│  │              ┌──────────────┘   │   └───────────────┐  │  │
│  │              ▼                  ▼                   ▼  │  │
│  │  ┌──────────────────┐ ┌──────────────┐ ┌────────────┐ │  │
│  │  │  DiskProvider    │ │RelayProvider │ │ P2PProvider│ │  │
│  │  │  (.cork/crdt/)   │ │(y-websocket) │ │ (y-webrtc) │ │  │
│  │  └────────┬─────────┘ └──────┬───────┘ └─────┬──────┘ │  │
│  └───────────┼──────────────────┼────────────────┼────────┘  │
│              │                  │                │            │
│  ┌───────────┼──────────────────┼────────────────┼────────┐  │
│  │           │    FlushService  │                │        │  │
│  │           │    (CRDT → .md)  │                │        │  │
│  │           ▼                  │                │        │  │
│  │  .cork/crdt/*.yjs            │                │        │  │
│  │           │                  │                │        │  │
│  │     flush (5s / on close)    │                │        │  │
│  │           ▼                  │                │        │  │
│  │     notes/*.md               │                │        │  │
│  │           │                  │                │        │  │
│  │     git add + commit (F26)   │                │        │  │
│  └──────────────────────────────┼────────────────┼────────┘  │
└─────────────────────────────────┼────────────────┼────────────┘
                                  │                │
                                  ▼                ▼
                          ┌──────────────┐   P2P (WebRTC)
                          │ cork-relay   │   LAN / STUN+TURN
                          │ (y-websocket │
                          │  server)     │
                          └──────────────┘
```

## Key types

### TypeScript

```typescript
// src/features/crdt/services/CrdtDocManager.ts

import * as Y from 'yjs';

type NoteHash = string; // 16-char hex from SHA-256 of vault-relative path

type CrdtDocEntry = {
  doc: Y.Doc;
  providers: Set<CrdtProvider>;
  flushTimer: ReturnType<typeof setInterval> | null;
  dirty: boolean;
};

type CrdtProvider = {
  readonly kind: 'disk' | 'relay' | 'p2p';
  connect(doc: Y.Doc, room: string): void;
  disconnect(): void;
  destroy(): void;
};

// src/features/crdt/services/FlushService.ts

type FlushOptions = {
  intervalMs: number;   // default 5000
  flushOnClose: boolean; // default true
};

// src/features/crdt/state/crdtStore.ts

type CrdtState = {
  enabled: boolean;
  relayUrl: string | null;
  relayConnected: boolean;
  p2pEnabled: boolean;
  flushIntervalMs: number;
  activeDocs: Map<NoteHash, { noteId: string; providerKinds: string[] }>;
  awareness: Map<number, AwarenessClient>; // clientId → state
};

type AwarenessClient = {
  clientId: number;
  name: string;
  color: string;
  cursor: { anchor: number; head: number } | null;
};
```

### IPC commands

| Command | Rust fn | Input | Output |
|---------|---------|-------|--------|
| `crdt.read_snapshot` | `crdt_read_snapshot` | `{ vault_path, note_hash }` | `Vec<u8>` (Yjs binary) or `null` |
| `crdt.write_snapshot` | `crdt_write_snapshot` | `{ vault_path, note_hash, data: Vec<u8> }` | `()` |
| `crdt.delete_snapshot` | `crdt_delete_snapshot` | `{ vault_path, note_hash }` | `()` |
| `crdt.list_snapshots` | `crdt_list_snapshots` | `{ vault_path }` | `Vec<String>` (hashes) |
| `crdt.recover_corrupt` | `crdt_recover_corrupt` | `{ vault_path, note_hash }` | `()` (moves to corrupt/) |
| `crdt.cleanup` | `crdt_cleanup` | `{ vault_path }` | `{ removed: usize }` |

**Note:** Yjs operations run entirely in the frontend (WebView JS). Rust handles only binary I/O for `.yjs` files. This avoids crossing the IPC boundary on every keystroke.

### Rust types

```rust
// src-tauri/src/crdt/mod.rs

use std::path::PathBuf;

pub struct CrdtPaths {
    pub crdt_dir: PathBuf,      // <vault>/.cork/crdt/
    pub corrupt_dir: PathBuf,   // <vault>/.cork/crdt/corrupt/
}

impl CrdtPaths {
    pub fn snapshot_path(&self, note_hash: &str) -> PathBuf {
        self.crdt_dir.join(format!("{note_hash}.yjs"))
    }
}
```

## CrdtDocManager lifecycle

Per R1.1–R1.6, the manager owns all `Y.Doc` instances:

```
openNote(noteId, vaultPath, mdContent):
  1. hash = sha256(noteId).slice(0, 16)
  2. snapshot = await invoke("crdt.read_snapshot", { vault_path, note_hash: hash })
  3. doc = new Y.Doc()
  4. if snapshot:
       Y.applyUpdate(doc, snapshot)
     else:
       doc.getText("body").insert(0, mdContent)   // bootstrap from .md
  5. providers = []
  6. providers.push(new DiskProvider(doc, hash, vaultPath))
  7. if settings.relayUrl:
       providers.push(new RelayProvider(doc, roomName, relayUrl, secret))
  8. if settings.p2pEnabled:
       providers.push(new P2PProvider(doc, roomName, signalingUrl))
  9. start flush timer
  10. return { doc, text: doc.getText("body"), meta: doc.getMap("meta") }

closeNote(noteId):
  1. flush(noteId)                    // CRDT → .md
  2. snapshot = Y.encodeStateAsUpdate(doc)
  3. await invoke("crdt.write_snapshot", { vault_path, note_hash, data: snapshot })
  4. providers.forEach(p => p.destroy())
  5. doc.destroy()
  6. remove from active docs map
```

## FlushService algorithm

Per R4.1–R4.5:

```
flush(noteId):
  1. entry = activeDocs.get(noteId)
  2. if !entry || !entry.dirty: return
  3. content = entry.doc.getText("body").toString()
  4. meta = entry.doc.getMap("meta").toJSON()
  5. mdWithFrontmatter = serializeFrontmatter(meta) + content
  6. await invoke("notes.save", { path: noteId, content: mdWithFrontmatter })
  7. entry.dirty = false

flushAll():
  // Called before git sync (R9.1) and on app quit
  await Promise.all(activeDocs.keys().map(id => flush(id)))

onExternalChange(noteId, newMdContent):
  // Per R4.3 — file watcher detected .md changed externally
  1. entry = activeDocs.get(noteId)
  2. if !entry: return  // not open, will bootstrap from .md on next open
  3. { frontmatter, body } = parseFrontmatter(newMdContent)
  4. currentBody = entry.doc.getText("body").toString()
  5. if body !== currentBody:
       // Apply external changes as a "remote" update
       entry.doc.transact(() => {
         const text = entry.doc.getText("body")
         text.delete(0, text.length)
         text.insert(0, body)
       }, 'external')
  6. merge meta fields into Y.Map("meta")
```

## DiskProvider

Minimal custom provider (per R3.1–R3.4):

```typescript
class DiskProvider implements CrdtProvider {
  readonly kind = 'disk';
  private writeTimer: ReturnType<typeof setInterval> | null = null;
  private doc: Y.Doc | null = null;

  connect(doc: Y.Doc, room: string) {
    this.doc = doc;
    // Debounced write every 1s when doc changes
    doc.on('update', () => this.schedulePersist());
  }

  private async schedulePersist() {
    if (this.writeTimer) return;
    this.writeTimer = setTimeout(async () => {
      this.writeTimer = null;
      const snapshot = Y.encodeStateAsUpdate(this.doc!);
      await invoke('crdt.write_snapshot', {
        vault_path: this.vaultPath,
        note_hash: this.noteHash,
        data: Array.from(snapshot),
      });
    }, 1000);
  }

  disconnect() { /* cancel timer, final persist */ }
  destroy() { this.disconnect(); this.doc = null; }
}
```

## RelayProvider

Wraps `y-websocket` (per R5.1–R5.6):

```typescript
import { WebsocketProvider } from 'y-websocket';

class RelayProvider implements CrdtProvider {
  readonly kind = 'relay';
  private ws: WebsocketProvider | null = null;

  connect(doc: Y.Doc, room: string) {
    this.ws = new WebsocketProvider(this.relayUrl, room, doc, {
      params: { auth: hmac(this.secret, this.vaultId) },
      awareness: this.awareness,  // shared awareness instance
    });
  }

  disconnect() { this.ws?.disconnect(); }
  destroy() { this.ws?.destroy(); this.ws = null; }
}
```

## Awareness & remote cursors

Per R5.6 and R6.5:

```typescript
import { Awareness } from 'y-protocols/awareness';

// Shared awareness instance per Y.Doc
const awareness = new Awareness(doc);

// Local state
awareness.setLocalStateField('user', {
  name: settings.displayName || os.hostname(),
  color: deterministicColor(awareness.clientID),
});

// CM6 extension renders remote cursors
import { yRemoteSelectionsTheme, yRemoteSelections } from 'y-codemirror.next';

// Added to CM6 extensions array:
// yCollab(ytext, awareness),
// yRemoteSelections(awareness),
// yRemoteSelectionsTheme,
```

## Relay server (`cork-relay`)

Per R7.1–R7.6. A standalone package:

```
packages/
  cork-relay/
    src/
      server.ts          # y-websocket server + HMAC auth
      persistence.ts     # optional LevelDB persistence adapter
    Dockerfile
    package.json
```

Server core (~100 lines):

```typescript
import { setupWSConnection } from 'y-websocket/bin/utils';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

const server = createServer();
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const room = req.url?.slice(1);
  const auth = new URL(req.url!, `http://${req.headers.host}`).searchParams.get('auth');

  if (!validateHmac(auth, room)) {
    ws.close(4001, 'Unauthorized');
    return;
  }

  setupWSConnection(ws, req, { docName: room, gc: true });
});

server.listen(PORT);
```

## Settings integration

Per R8.1–R8.4. New section in Settings → Sync:

| Field | Type | Default | Vault config key |
|-------|------|---------|-----------------|
| Enable CRDT sync | `boolean` | `false` | `sync.crdt.enabled` |
| Relay URL | `string \| null` | `null` | `sync.crdt.relayUrl` |
| Shared secret | `string \| null` | `null` | `sync.crdt.relaySecret` |
| LAN sync (WebRTC) | `boolean` | `false` | `sync.crdt.p2pEnabled` |
| Flush interval (seconds) | `number` | `5` | `sync.crdt.flushIntervalSecs` |
| Display name | `string` | OS hostname | `sync.crdt.displayName` |

## Migration flow (R8.3)

```
Enable CRDT:
  1. For each .md in vault:
       hash = sha256(relativePath).slice(0, 16)
       doc = new Y.Doc()
       doc.getText("body").insert(0, readFileSync(path))
       snapshot = Y.encodeStateAsUpdate(doc)
       writeFileSync(.cork/crdt/{hash}.yjs, snapshot)
       doc.destroy()
  2. Toast: "CRDT sync enabled for N notes"

Disable CRDT:
  1. flushAll()           // ensure .md files are current
  2. rm -rf .cork/crdt/   // remove CRDT state
  3. Toast: "CRDT sync disabled — your notes are unchanged"
```

## Key design decisions

| Decision | Rationale |
|----------|-----------|
| Yjs runs in WebView, not Rust | Avoids IPC-per-keystroke. `y-codemirror.next` requires JS. Rust only handles binary file I/O. |
| One Y.Doc per note (not per vault) | Memory-efficient: only open notes are in memory. Scales to 10k+ note vaults. |
| `.yjs` is optional / recoverable | If deleted, the doc bootstraps from `.md`. This preserves the vault-as-source-of-truth contract. |
| CRDT is opt-in (default off) | Zero behavior change for existing users. No surprise storage overhead. |
| Relay is stateless by default | Simplest deployment (single process, no disk). Persistence is a flag for advanced users. |
| No accounts / no OAuth | Shared secret is simple, zero-infra. Users who want more can run the relay behind their own auth proxy. |
| Git commits `.md` only (default) | Keeps git diffs human-readable. `.yjs` is binary noise in diffs. Advanced users can opt in. |
| Awareness via `y-protocols` | Standard protocol, works across WebSocket and WebRTC identically. Remote cursors are a free win. |

## Test strategy

### Unit tests (Vitest)

- `CrdtDocManager.test.ts` — open/close lifecycle, bootstrap from .md, load from snapshot, corrupt recovery
- `FlushService.test.ts` — flush writes correct .md, flushAll covers all open docs, external change merge
- `DiskProvider.test.ts` — debounced write, persist on disconnect, corrupt file handling
- `crdtStore.test.ts` — state transitions: enable/disable, relay connect/disconnect, awareness updates

### Integration tests

- Editor with Yjs binding: type → verify Y.Text reflects content → flush → verify .md matches
- Two Y.Doc instances simulating two devices: concurrent edits merge without conflict
- Migration: enable CRDT → verify .yjs files created for all notes; disable → verify cleanup

### Rust tests (cargo test)

- `crdt::read_snapshot` / `crdt::write_snapshot` — round-trip binary data
- `crdt::recover_corrupt` — moves file, returns Ok
- `crdt::cleanup` — removes orphaned .yjs files not matching any vault note

### E2E (Playwright)

- Start local `cork-relay`, open vault in two browser tabs connected to relay
- Type in tab A → verify text appears in tab B within 500ms
- Disconnect relay → type in both tabs → reconnect → verify merge is clean

### Manual smoke

- Verify `.cork/crdt/` appears after enabling CRDT
- Verify `.md` updates after flush interval
- Verify git sync works normally with CRDT enabled
- Verify editor fallback when CRDT is disabled
- Verify remote cursor rendering with two relay-connected clients
