# F38 — Relay Auth & Identity: Design

**Spec**: `.specs/features/F38-relay-auth/spec.md`
**Status**: Draft

---

## Architecture Overview

F38 adds an identity layer that sits between the Cork client and the relay server. Two auth paths coexist: **JWT (hosted relay)** and **shared-secret HMAC (self-hosted relay, unchanged from F37)**. The relay decides which to enforce based on its configuration.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Cork Client (Tauri)                         │
│                                                                     │
│  ┌──────────────┐   ┌──────────────────┐   ┌─────────────────────┐ │
│  │ Settings UI  │   │  AuthService     │   │  RelayProvider      │ │
│  │ SyncSection  │──►│  (OAuth flow +   │──►│  (y-websocket)      │ │
│  │              │   │   token mgmt)    │   │                     │ │
│  └──────────────┘   └───────┬──────────┘   └──────┬──────────────┘ │
│                             │                      │                │
│                    ┌────────▼────────┐              │                │
│                    │  Keychain       │              │                │
│                    │  (OS secure     │              │                │
│                    │   storage)      │              │                │
│                    └─────────────────┘              │                │
└────────────────────────────────────────────────────┼────────────────┘
                                                     │
                         WebSocket + JWT token        │
                                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        cork-relay (server)                           │
│                                                                     │
│  ┌──────────────┐   ┌──────────────────┐   ┌─────────────────────┐ │
│  │ /auth/github │   │  AuthMiddleware   │   │  y-websocket        │ │
│  │ (OAuth code  │──►│  (JWT verify OR  │──►│  (broadcast rooms)  │ │
│  │  → JWT)      │   │   HMAC verify)   │   │                     │ │
│  ├──────────────┤   └──────────────────┘   └─────────────────────┘ │
│  │ /vaults      │                                                   │
│  │ /devices     │           ┌──────────────────┐                    │
│  │ (REST API)   │──────────►│  SQLite (users,  │                    │
│  └──────────────┘           │  vaults, devices)│                    │
│                             └──────────────────┘                    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ OAuth code exchange
                                    ▼
                           ┌─────────────────┐
                           │  GitHub API      │
                           │  (identity only) │
                           └─────────────────┘
```

### Auth flow sequence

```
Client                          Relay                        GitHub
  │                               │                            │
  │  1. User clicks "Sign in"     │                            │
  │  ─── open system browser ───────────────────────────────►  │
  │                               │                            │
  │  2. User authorizes           │                            │
  │  ◄── redirect to localhost ─────────────────────────────── │
  │      with ?code=XXXX          │                            │
  │                               │                            │
  │  3. POST /auth/github { code }│                            │
  │  ────────────────────────────►│                            │
  │                               │  4. POST /login/oauth/     │
  │                               │     access_token           │
  │                               │  ────────────────────────► │
  │                               │                            │
  │                               │  5. GET /user              │
  │                               │  ────────────────────────► │
  │                               │  ◄── { id, login, avatar } │
  │                               │                            │
  │                               │  6. Upsert user +          │
  │                               │     generate JWT pair      │
  │                               │                            │
  │  7. { accessToken,            │                            │
  │       refreshToken,           │                            │
  │       expiresIn, user }       │                            │
  │  ◄────────────────────────────│                            │
  │                               │                            │
  │  8. Store tokens in keychain  │                            │
  │                               │                            │
  │  9. WebSocket connect         │                            │
  │     ?token=<accessToken>      │                            │
  │  ────────────────────────────►│                            │
  │                               │  10. Verify JWT + check    │
  │                               │      vault ownership       │
  │  ◄── connection accepted ─────│                            │
```

---

## Code Reuse Analysis

### Existing Components to Leverage

| Component | Location | How to Use |
|-----------|----------|------------|
| Settings section pattern | `src/features/settings/ui/settings/AiSection.tsx` | Mirror structure for `SyncAuthSection` — async status on mount, SettingRow layout |
| SettingRow component | `src/features/settings/ui/settings/SettingRow.tsx` | Reuse directly for relay URL, device list, profile display |
| IPC contract pattern | `src/shared/ipc/IpcContract.ts` | Add `keychain.*` commands following existing convention |
| Zustand store pattern | `src/features/shell/state/appSettingsStore.ts` | Follow merge + optimistic update pattern for `relayAuthStore` |
| VCS remote state | `src-tauri/src/vcs/remote.rs` | Reference for Rust-side state management with IPC commands |
| Vault settings persistence | `src-tauri/src/settings.rs` | Relay URL and non-secret config persists via existing `settings.vaultSave()` |
| F37 RelayProvider | F37 design — `RelayProvider` class | Extend `connect()` to accept JWT token in addition to HMAC |

### Integration Points

| System | Integration Method |
|--------|-------------------|
| F37 RelayProvider | `connect()` gains a `token?: string` param; provider checks auth mode |
| F37 cork-relay server | Server gains REST endpoints + JWT verification middleware alongside existing HMAC |
| Settings panel | New "Sync" section registered in `SettingsPanel.tsx` section list |
| OS keychain | New `keychain` Rust module wrapping the `keyring` crate |

---

## Components

### AuthService (frontend)

- **Purpose**: Orchestrates the OAuth flow, manages token lifecycle (store/refresh/clear), and exposes auth state to the rest of the app
- **Location**: `src/features/sync/services/AuthService.ts`
- **Interfaces**:
  - `signInWithGitHub(relayUrl: string): Promise<AuthSession>` — opens system browser, handles callback, exchanges code via relay, stores tokens
  - `signOut(relayUrl: string): Promise<void>` — clears local tokens, calls `POST /auth/logout` on relay
  - `getAccessToken(): Promise<string | null>` — returns current token, refreshing if expired
  - `refreshAccessToken(relayUrl: string): Promise<AuthSession>` — uses refresh token to get new access token
  - `getSession(): AuthSession | null` — synchronous read of current session state
- **Dependencies**: `keychain` IPC commands, `relayAuthStore`
- **Reuses**: IPC client pattern from `src/shared/ipc/client.ts`

### relayAuthStore (frontend)

- **Purpose**: Zustand store holding the current auth session state, reactive for UI
- **Location**: `src/features/sync/state/relayAuthStore.ts`
- **Interfaces**:
  - `session: AuthSession | null` — current signed-in session
  - `devices: DeviceInfo[]` — cached device list
  - `isSigningIn: boolean` — loading state during OAuth flow
  - `setSession(session: AuthSession | null): void`
  - `loadDevices(relayUrl: string): Promise<void>`
  - `revokeDevice(relayUrl: string, deviceId: string): Promise<void>`
- **Dependencies**: `AuthService`
- **Reuses**: Zustand patterns from `appSettingsStore`

### SyncAuthSection (frontend)

- **Purpose**: Settings UI section for relay auth — sign in/out, profile display, device list
- **Location**: `src/features/settings/ui/settings/SyncAuthSection.tsx`
- **Interfaces**: React component receiving `(settings, update)` props
- **Dependencies**: `relayAuthStore`, `AuthService`, `SettingRow`
- **Reuses**: Section layout pattern from `AiSection.tsx`

### Keychain module (Rust)

- **Purpose**: Secure token storage using the OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service)
- **Location**: `src-tauri/src/keychain.rs`
- **Interfaces**:
  - `keychain.store { service: string, key: string, value: string } → ()` — store a secret
  - `keychain.retrieve { service: string, key: string } → string | null` — retrieve a secret
  - `keychain.delete { service: string, key: string } → ()` — delete a secret
- **Dependencies**: `keyring` crate (v3)
- **Reuses**: IPC error pattern from `src-tauri/src/error.rs`

### Relay auth middleware (server)

- **Purpose**: Verifies incoming connections — JWT for hosted mode, HMAC for self-hosted mode
- **Location**: `packages/cork-relay/src/auth.ts`
- **Interfaces**:
  - `verifyConnection(req: IncomingMessage): { userId: string, deviceId: string } | null` — extracts and validates auth from WebSocket upgrade request
  - `verifyVaultAccess(userId: string, vaultId: string): boolean` — checks vault ownership in DB
- **Dependencies**: `jose` (JWT library), relay SQLite DB
- **Reuses**: F37 HMAC validation logic (kept as fallback path)

### Relay REST API (server)

- **Purpose**: HTTP endpoints for auth, vault registration, and device management
- **Location**: `packages/cork-relay/src/api.ts`
- **Interfaces**:
  - `POST /auth/github { code } → { accessToken, refreshToken, expiresIn, user }`
  - `POST /auth/refresh { refreshToken } → { accessToken, refreshToken, expiresIn }`
  - `POST /auth/logout` (authenticated) — invalidate refresh token
  - `GET /vaults` (authenticated) → `VaultInfo[]`
  - `POST /vaults { vaultId, name }` (authenticated) → `VaultInfo`
  - `DELETE /vaults/:vaultId` (authenticated)
  - `GET /devices` (authenticated) → `DeviceInfo[]`
  - `DELETE /devices/:deviceId` (authenticated)
- **Dependencies**: `jose`, `better-sqlite3`, relay config
- **Reuses**: HTTP server from F37's `createServer()`

### Relay SQLite schema (server)

- **Purpose**: Persistent storage for users, vaults, devices, and refresh tokens
- **Location**: `packages/cork-relay/src/db.ts`
- **Dependencies**: `better-sqlite3`

---

## Data Models

### AuthSession (client-side, in memory + keychain)

```typescript
type AuthSession = {
  userId: string;          // relay-issued user ID (UUID)
  githubUsername: string;   // display only
  githubAvatarUrl: string;  // display only
  accessToken: string;      // JWT, short-lived (15 min)
  refreshToken: string;     // opaque, long-lived (30 days)
  expiresAt: number;        // Unix timestamp (ms)
  deviceId: string;         // stable per-device UUID, generated on first sign-in
  relayUrl: string;         // which relay this session is for
};
```

**Storage split**:
- `accessToken`, `refreshToken` → OS keychain via `keychain.store` (keyed by `cork:relay:<relayUrl>`)
- `userId`, `githubUsername`, `githubAvatarUrl`, `deviceId`, `expiresAt`, `relayUrl` → `relayAuthStore` (persisted to vault config as non-secret metadata)

### JWT claims (relay-issued)

```typescript
type JwtPayload = {
  sub: string;      // relay user ID (UUID) — NOT github_id
  did: string;      // device ID (UUID)
  iat: number;      // issued at
  exp: number;      // expires at (15 min from iat)
};
```

Provider-agnostic by design (RAUTH-22). No GitHub-specific fields.

### Relay SQLite schema (server-side)

```sql
CREATE TABLE users (
  id          TEXT PRIMARY KEY,  -- UUID
  github_id   INTEGER UNIQUE NOT NULL,
  username    TEXT NOT NULL,
  avatar_url  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE vaults (
  vault_id    TEXT NOT NULL,
  owner_id    TEXT NOT NULL REFERENCES users(id),
  name        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (vault_id, owner_id)
);

CREATE TABLE devices (
  id          TEXT PRIMARY KEY,  -- UUID (= deviceId in JWT)
  user_id     TEXT NOT NULL REFERENCES users(id),
  name        TEXT NOT NULL,     -- OS hostname or user-chosen
  platform    TEXT NOT NULL,     -- 'macos' | 'windows' | 'linux'
  last_seen   TEXT NOT NULL DEFAULT (datetime('now')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE refresh_tokens (
  token_hash  TEXT PRIMARY KEY,  -- SHA-256 of the opaque refresh token
  user_id     TEXT NOT NULL REFERENCES users(id),
  device_id   TEXT NOT NULL REFERENCES devices(id),
  expires_at  TEXT NOT NULL,
  revoked     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### DeviceInfo (API response)

```typescript
type DeviceInfo = {
  deviceId: string;
  name: string;
  platform: 'macos' | 'windows' | 'linux';
  lastSeen: string;    // ISO 8601
  isCurrent: boolean;  // true if deviceId matches the requester's JWT
};
```

### VaultInfo (API response)

```typescript
type VaultInfo = {
  vaultId: string;
  name: string;
  createdAt: string;  // ISO 8601
};
```

---

## Error Handling Strategy

| Error Scenario | Handling | User Impact |
|---------------|----------|-------------|
| OAuth cancelled / browser closed | `AuthService` rejects promise, `isSigningIn` → false | Toast: "Sign-in cancelled" |
| Relay unreachable during sign-in | `AuthService` rejects with network error | Toast: "Could not reach relay — check your connection" |
| GitHub returns error during OAuth | Relay returns 401 to client | Toast: "GitHub sign-in failed — try again" |
| Access token expired | `getAccessToken()` auto-refreshes via `refreshAccessToken()` | Invisible to user |
| Refresh token expired / revoked | `refreshAccessToken()` fails → clear session, set `session: null` | Toast: "Session expired — please sign in again" |
| Vault already registered by another user | Relay returns 409 Conflict | Toast: "This vault is registered to another account" |
| Keychain unavailable (Linux without Secret Service) | `keychain.store` returns error | Fallback: store tokens in an encrypted file at `<app-data>/relay-tokens.json` using a machine-derived key |
| WebSocket rejected (4001/4003) | RelayProvider triggers reconnect with token refresh; if still fails, disconnect | Toast: "Relay connection lost — sign in again" |

---

## Tech Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| OAuth flow location | Code exchange happens on the **relay server**, not the client | Client never holds a GitHub OAuth client_secret. The relay is the OAuth "backend". The client only sends the authorization `code`. |
| JWT library (server) | `jose` | Zero-dependency, Web Crypto API compatible, works in Node/Bun/Cloudflare Workers. Not `jsonwebtoken` (Node-only, deprecated `crypto`). |
| JWT signing algorithm | `EdDSA` (Ed25519) | Faster than RSA, smaller tokens. The relay generates a keypair on first run and persists it. |
| Access token lifetime | 15 minutes | Short enough to limit damage if leaked; long enough that refresh isn't constant. |
| Refresh token lifetime | 30 days | Matches typical "stay signed in" expectations. Revocable via device management. |
| Refresh token storage | Hashed in DB (SHA-256) | Relay never stores the raw refresh token — only the hash. Client holds the raw value in the OS keychain. If the DB leaks, tokens are unusable. |
| Relay DB | SQLite via `better-sqlite3` | Consistent with Cork's SQLite-everywhere approach. Simple, embedded, no external DB dependency. Hosted relay scales fine with WAL mode for the expected user count. |
| Keychain crate | `keyring` v3 | Cross-platform (macOS Keychain, Windows Credential Manager, Linux Secret Service). Actively maintained. |
| OAuth redirect | Localhost HTTP server (ephemeral port) | Standard desktop OAuth pattern. The client spins up a temporary HTTP server on `127.0.0.1:<random-port>`, passes that as the `redirect_uri`. After receiving the callback, the server shuts down. |
| Device ID generation | UUID v4, generated on first sign-in, persisted in app-data | Stable across sign-in/sign-out cycles. Stored in app-level config (not vault config) since it identifies the machine, not the vault. |
| Relay auth mode detection | Client checks `GET /` on relay → response includes `{ authMode: "jwt" | "hmac" }` | Simple discovery. Self-hosted relays return `hmac`, hosted returns `jwt`. Client adapts UI and connection logic accordingly. |

---

## F37 Integration: RelayProvider changes

The existing F37 `RelayProvider` connects with HMAC params. F38 extends it to support JWT:

```typescript
// Before (F37):
new WebsocketProvider(relayUrl, room, doc, {
  params: { auth: hmac(secret, vaultId) },
});

// After (F38):
const authParams = authMode === 'jwt'
  ? { token: await authService.getAccessToken() }
  : { auth: hmac(secret, vaultId) };

new WebsocketProvider(relayUrl, room, doc, {
  params: authParams,
});
```

The relay server's `wss.on('connection')` handler checks for `token` param first (JWT path), falls back to `auth` param (HMAC path). This is the only F37 code change — everything else is additive.

---

## Settings UI Layout

The existing Settings panel gains auth-related content in the Files & Sync section:

```
Settings > Sync > Real-time Relay
┌─────────────────────────────────────────────────┐
│  Relay URL         [wss://relay.cork.app      ] │
│                                                 │
│  ┌─ Hosted relay detected ────────────────────┐ │
│  │                                             │ │
│  │  ┌────┐  Signed in as @gaalv               │ │
│  │  │ av │  gabriel@email.com                  │ │
│  │  └────┘  [Sign out]                         │ │
│  │                                             │ │
│  │  Devices (2)                                │ │
│  │  ● MacBook Pro (this device)    [current]   │ │
│  │  ○ Desktop Linux   last seen 2h  [Revoke]   │ │
│  │                                             │ │
│  └─────────────────────────────────────────────┘ │
│                                                 │
│  ┌─ Self-hosted relay ────────────────────────┐ │
│  │  (shown instead when authMode = "hmac")     │ │
│  │  Shared secret    [••••••••••••••••••••••]  │ │
│  └─────────────────────────────────────────────┘ │
│                                                 │
│  LAN sync (WebRTC)   [toggle off]               │
│  Flush interval       [5] seconds               │
│  Display name         [MacBook Pro]             │
└─────────────────────────────────────────────────┘
```

The UI adapts based on the relay's `authMode` response — JWT shows the OAuth + devices panel, HMAC shows the shared secret field.

---

## Security Considerations

1. **Client never holds GitHub OAuth client_secret** — only the relay server does. The client sends the authorization `code` to the relay, which exchanges it server-side.
2. **GitHub token is ephemeral** — used only during the `/auth/github` endpoint to fetch user identity, then discarded. Never stored on client or relay.
3. **Refresh tokens are hashed** — the relay DB stores `SHA-256(refreshToken)`, never the raw value.
4. **Access tokens are short-lived** — 15-minute expiry limits exposure if leaked.
5. **Vault authorization is server-enforced** — the relay checks vault ownership on every WebSocket connection, not just at registration time.
6. **Keychain storage** — tokens stored in OS-level secure storage, not in plaintext config files.
7. **Device revocation is immediate** — revoking a device invalidates its refresh token; the device loses access on next token refresh (at most 15 minutes).
