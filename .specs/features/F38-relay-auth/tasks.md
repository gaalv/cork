# F38 — Relay Auth & Identity: Tasks

**Design**: `.specs/features/F38-relay-auth/design.md`
**Status**: Draft

---

## Execution Plan

### Phase 1: Foundation (Sequential)

Keychain module and auth types — everything else depends on these.

```
T1 → T2
```

### Phase 2: Relay Server Auth (Parallel OK)

Server-side: DB schema, REST API, JWT middleware. Independent of client work.

```
     ┌→ T3 ─┐
T2 ──┤      ├──→ T5 → T6
     └→ T4 ─┘
```

### Phase 3: Client Auth (Parallel OK after T2)

Client-side: OAuth flow, token management, store, provider integration.

```
     ┌→ T7 ─┐
T2 ──┤      ├──→ T9
     └→ T8 ─┘
```

### Phase 4: Settings UI (Sequential, after T7 + T8)

UI surfaces for auth, devices, profile.

```
T9 → T10 → T11
```

### Phase 5: Integration & Wiring (Sequential)

End-to-end connection between client and relay.

```
T11 → T12 → T13
```

---

## Task Breakdown

### T1: Keychain Rust module

**What**: Add the `keyring` crate and create a `keychain.rs` module with `keychain.store`, `keychain.retrieve`, `keychain.delete` IPC commands for secure OS-level secret storage.
**Where**: `src-tauri/src/keychain.rs`, `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`
**Depends on**: None
**Reuses**: Error pattern from `src-tauri/src/error.rs`, IPC handler registration pattern from `src-tauri/src/lib.rs`
**Requirement**: RAUTH-04

**Done when**:
- [ ] `keyring = "3"` added to `Cargo.toml`
- [ ] `keychain.rs` exposes three `#[tauri::command]` handlers: `keychain_store`, `keychain_retrieve`, `keychain_delete`
- [ ] Commands registered in `lib.rs` `invoke_handler`
- [ ] `cargo test --lib` passes — round-trip store/retrieve/delete test
- [ ] Errors return `IpcError`, never panic

**Verify**: `cargo test keychain`

**Commit**: `feat(keychain): add OS keychain IPC commands via keyring crate`

---

### T2: Auth types and IPC contract

**What**: Define all F38 TypeScript types (`AuthSession`, `DeviceInfo`, `VaultInfo`, `JwtPayload`) and add keychain IPC commands to `IpcContract.ts`.
**Where**: `src/shared/ipc/types.ts`, `src/shared/ipc/IpcContract.ts`
**Depends on**: T1
**Reuses**: Existing IPC contract patterns, VCS types as reference
**Requirement**: RAUTH-21, RAUTH-22

**Done when**:
- [ ] `AuthSession`, `DeviceInfo`, `VaultInfo` types exported from `types.ts`
- [ ] `keychain.store`, `keychain.retrieve`, `keychain.delete` commands added to `IpcContract.ts` with correct arg/result types
- [ ] `pnpm typecheck` passes

**Verify**: `pnpm typecheck`

**Commit**: `feat(sync): add F38 relay auth types and keychain IPC contract`

---

### T3: Relay SQLite schema and DB module

**What**: Create the relay server's SQLite database module with `users`, `vaults`, `devices`, `refresh_tokens` tables and CRUD helper functions.
**Where**: `packages/cork-relay/src/db.ts`
**Depends on**: T2 (types reference)
**Reuses**: None (new package, but follows Cork's SQLite conventions)
**Requirement**: RAUTH-13, RAUTH-17, RAUTH-19

**Done when**:
- [ ] `better-sqlite3` added to `packages/cork-relay/package.json`
- [ ] Schema creates all four tables with correct columns, constraints, and indexes
- [ ] Helper functions: `upsertUser`, `getUser`, `createVault`, `listVaults`, `deleteVault`, `createDevice`, `listDevices`, `deleteDevice`, `storeRefreshToken`, `getRefreshToken`, `revokeRefreshToken`, `revokeAllDeviceTokens`
- [ ] Unit tests for each helper function pass

**Verify**: `cd packages/cork-relay && pnpm test`

**Commit**: `feat(relay): add SQLite schema and DB helpers for auth`

---

### T4: Relay JWT utilities [P]

**What**: Create JWT sign/verify helpers using `jose` with Ed25519 keypair. Generate keypair on first run and persist to disk. Includes refresh token generation (opaque + SHA-256 hash).
**Where**: `packages/cork-relay/src/jwt.ts`
**Depends on**: T2 (types reference)
**Reuses**: None (new module)
**Requirement**: RAUTH-03, RAUTH-08, RAUTH-22

**Done when**:
- [ ] `jose` added to `packages/cork-relay/package.json`
- [ ] `signAccessToken(sub, did): Promise<string>` — returns JWT with 15-min expiry
- [ ] `verifyAccessToken(token): Promise<JwtPayload>` — returns decoded payload or throws
- [ ] `generateRefreshToken(): { raw: string, hash: string }` — returns opaque token + SHA-256 hash
- [ ] `loadOrCreateKeypair(dir): Promise<KeyPair>` — generates Ed25519 keypair on first run, loads from `<dir>/relay.key` on subsequent runs
- [ ] Unit tests: sign → verify round-trip, expired token rejection, tampered token rejection, keypair persistence

**Verify**: `cd packages/cork-relay && pnpm test`

**Commit**: `feat(relay): add JWT sign/verify and keypair management`

---

### T5: Relay REST API endpoints

**What**: Create HTTP router with auth endpoints (`POST /auth/github`, `POST /auth/refresh`, `POST /auth/logout`), vault endpoints (`GET/POST/DELETE /vaults`), and device endpoints (`GET/DELETE /devices`). Includes GitHub OAuth code-for-token exchange.
**Where**: `packages/cork-relay/src/api.ts`
**Depends on**: T3, T4
**Reuses**: DB helpers from T3, JWT helpers from T4
**Requirement**: RAUTH-01, RAUTH-02, RAUTH-03, RAUTH-05, RAUTH-06, RAUTH-12, RAUTH-13, RAUTH-14, RAUTH-15, RAUTH-16, RAUTH-17, RAUTH-18, RAUTH-19, RAUTH-20

**Done when**:
- [ ] `POST /auth/github { code }` — exchanges code with GitHub API, upserts user, issues JWT pair, returns `{ accessToken, refreshToken, expiresIn, user }`
- [ ] `POST /auth/refresh { refreshToken }` — validates hash against DB, issues new JWT pair, rotates refresh token
- [ ] `POST /auth/logout` (authed) — revokes the device's refresh token
- [ ] `GET /vaults` (authed) — returns user's registered vaults
- [ ] `POST /vaults { vaultId, name }` (authed) — registers vault, returns 409 if owned by another user
- [ ] `DELETE /vaults/:vaultId` (authed) — unregisters vault
- [ ] `GET /devices` (authed) — returns user's devices with `isCurrent` flag
- [ ] `DELETE /devices/:deviceId` (authed) — revokes device + its refresh tokens
- [ ] `GET /` — returns `{ authMode: "jwt" | "hmac", version }` for client discovery
- [ ] Auth middleware extracts JWT from `Authorization: Bearer <token>` header
- [ ] Integration tests with in-memory SQLite

**Verify**: `cd packages/cork-relay && pnpm test`

**Commit**: `feat(relay): add REST API for auth, vaults, and devices`

---

### T6: Relay WebSocket auth middleware update

**What**: Update the relay's WebSocket connection handler to support JWT auth alongside existing HMAC. Check `token` query param first (JWT path), fall back to `auth` param (HMAC path). For JWT connections, verify vault ownership before allowing room join.
**Where**: `packages/cork-relay/src/server.ts`, `packages/cork-relay/src/auth.ts`
**Depends on**: T5
**Reuses**: F37's existing HMAC validation, JWT verify from T4, vault ownership check from T3
**Requirement**: RAUTH-07, RAUTH-08, RAUTH-09, RAUTH-11, RAUTH-16

**Done when**:
- [ ] `auth.ts` exports `verifyConnection(req)` that returns `{ userId, deviceId, authMode }` or rejects
- [ ] JWT path: extract `token` param → verify JWT → extract `sub`/`did` → check vault ownership for the room's vault prefix → accept or reject 4003
- [ ] HMAC path: extract `auth` param → validate HMAC → accept or reject 4001
- [ ] `server.ts` calls `verifyConnection()` before `setupWSConnection()`
- [ ] Relay config flag `AUTH_MODE=jwt|hmac|both` controls which paths are active (default: `both`)
- [ ] Tests: JWT connection accepted, JWT with wrong vault rejected, HMAC still works, invalid token rejected

**Verify**: `cd packages/cork-relay && pnpm test`

**Commit**: `feat(relay): add JWT auth to WebSocket connections alongside HMAC`

---

### T7: AuthService (client OAuth + token management) [P]

**What**: Create the client-side `AuthService` that handles the full GitHub OAuth flow (open system browser → localhost callback → exchange code via relay → store tokens) and token lifecycle (refresh, clear).
**Where**: `src/features/sync/services/AuthService.ts`
**Depends on**: T2
**Reuses**: IPC client for keychain commands, `tauri-plugin-opener` for system browser
**Requirement**: RAUTH-01, RAUTH-02, RAUTH-03, RAUTH-04, RAUTH-05, RAUTH-06

**Done when**:
- [ ] `signInWithGitHub(relayUrl)` — spins up ephemeral localhost HTTP server, opens system browser with GitHub OAuth URL, receives callback with code, sends `POST /auth/github` to relay, stores tokens in keychain, returns `AuthSession`
- [ ] `signOut(relayUrl)` — calls `POST /auth/logout` on relay, clears tokens from keychain, clears session
- [ ] `getAccessToken()` — returns current token if valid, auto-refreshes if expired, returns null if no session
- [ ] `refreshAccessToken(relayUrl)` — calls `POST /auth/refresh` with stored refresh token, updates keychain
- [ ] `getSession()` — synchronous read from in-memory state
- [ ] Tokens stored in keychain as `cork:relay:access:<relayUrl>` and `cork:relay:refresh:<relayUrl>`
- [ ] Unit tests with mocked IPC and fetch

**Verify**: `pnpm test -- AuthService`

**Commit**: `feat(sync): add AuthService with GitHub OAuth flow and token management`

---

### T8: relayAuthStore (Zustand) [P]

**What**: Create the Zustand store for relay auth state — current session, device list, loading states. Provides reactive state for the Settings UI.
**Where**: `src/features/sync/state/relayAuthStore.ts`
**Depends on**: T2
**Reuses**: Zustand patterns from `appSettingsStore.ts`
**Requirement**: RAUTH-17, RAUTH-18, RAUTH-20, RAUTH-24, RAUTH-25

**Done when**:
- [ ] Store exports `useRelayAuthStore` with state: `session`, `devices`, `isSigningIn`, `authMode`
- [ ] `signIn(relayUrl)` — sets `isSigningIn`, delegates to `AuthService.signInWithGitHub()`, updates `session`
- [ ] `signOut(relayUrl)` — delegates to `AuthService.signOut()`, clears `session` and `devices`
- [ ] `loadDevices(relayUrl)` — fetches `GET /devices`, updates `devices` array
- [ ] `revokeDevice(relayUrl, deviceId)` — calls `DELETE /devices/:deviceId`, refreshes device list
- [ ] `detectAuthMode(relayUrl)` — fetches `GET /` on relay, sets `authMode` to `"jwt"` or `"hmac"`
- [ ] `restoreSession(relayUrl)` — loads tokens from keychain, validates, sets `session` if valid
- [ ] Unit tests for all state transitions

**Verify**: `pnpm test -- relayAuthStore`

**Commit**: `feat(sync): add relayAuthStore Zustand store`

---

### T9: RelayProvider JWT integration

**What**: Update the F37 `RelayProvider` (or its future scaffold) to support JWT-authenticated WebSocket connections. When `authMode` is `jwt`, use `token` param with the access token from `AuthService`; when `hmac`, use existing `auth` param.
**Where**: `src/features/sync/services/RelayProvider.ts` (or F37 equivalent when it exists)
**Depends on**: T7, T8
**Reuses**: F37 `RelayProvider` design, `AuthService.getAccessToken()`
**Requirement**: RAUTH-07, RAUTH-09, RAUTH-10, RAUTH-11

**Done when**:
- [ ] `connect()` checks `authMode` from `relayAuthStore` and builds params accordingly
- [ ] JWT path: `{ token: await authService.getAccessToken() }`
- [ ] HMAC path: `{ auth: hmac(secret, vaultId) }` (unchanged)
- [ ] On WebSocket close with code 4001/4003: attempt token refresh + reconnect once, then disconnect with error
- [ ] On token expiry during active session: transparent reconnect with refreshed token (RAUTH-10)
- [ ] Unit tests for both auth paths and reconnect-on-expire logic

**Verify**: `pnpm test -- RelayProvider`

**Commit**: `feat(sync): add JWT auth support to RelayProvider`

---

### T10: SyncAuthSection — OAuth UI (sign in/out + profile)

**What**: Create the Settings UI section for relay auth — sign-in button, signed-in profile display (avatar + username), sign-out link. Adapts based on `authMode`.
**Where**: `src/features/settings/ui/settings/SyncAuthSection.tsx`
**Depends on**: T8, T9
**Reuses**: `SettingRow`, section patterns from `AiSection.tsx`
**Requirement**: RAUTH-01, RAUTH-24, RAUTH-25, RAUTH-26

**Done when**:
- [ ] When `authMode === "jwt"` and not signed in: shows "Sign in with GitHub" button
- [ ] When `authMode === "jwt"` and signed in: shows avatar, username, "Sign out" link
- [ ] When `authMode === "hmac"`: shows shared secret input field (existing F37 UI)
- [ ] When relay URL is empty: shows only the URL input, no auth section
- [ ] Sign-in button triggers `relayAuthStore.signIn()` with loading spinner
- [ ] Sign-out triggers `relayAuthStore.signOut()` with confirmation
- [ ] `authMode` detected automatically when relay URL changes via `detectAuthMode()`
- [ ] Component test: renders correct state for each authMode/session combination

**Verify**: `pnpm test -- SyncAuthSection`

**Commit**: `feat(settings): add relay auth UI with GitHub OAuth sign-in`

---

### T11: SyncAuthSection — Device management UI

**What**: Add the device list and revoke UI to the SyncAuthSection. Shows connected devices with platform, last seen, and revoke button.
**Where**: `src/features/settings/ui/settings/SyncAuthSection.tsx` (extend)
**Depends on**: T10
**Reuses**: `SettingRow`, device list from `relayAuthStore.devices`
**Requirement**: RAUTH-17, RAUTH-18, RAUTH-19, RAUTH-20

**Done when**:
- [ ] Device list section appears below profile when signed in
- [ ] Each device shows: name, platform icon, last seen (relative time), "current" badge or "Revoke" button
- [ ] Revoke button shows confirmation, then calls `relayAuthStore.revokeDevice()`
- [ ] Current device cannot be revoked (button disabled or hidden)
- [ ] Device list loads on section mount and refreshes after revoke
- [ ] Empty state: "No other devices connected"
- [ ] Component test: renders device list, revoke flow

**Verify**: `pnpm test -- SyncAuthSection`

**Commit**: `feat(settings): add device management UI to relay sync section`

---

### T12: Vault registration wiring

**What**: Wire vault registration into the sync enable/disable flow. When real-time sync is enabled on a vault and user is signed in (JWT mode), auto-register the vault with the relay. On disable, unregister.
**Where**: `src/features/sync/services/VaultRegistration.ts`
**Depends on**: T9, T10
**Reuses**: `relayAuthStore.session`, `AuthService.getAccessToken()`
**Requirement**: RAUTH-12, RAUTH-13, RAUTH-14, RAUTH-15, RAUTH-16

**Done when**:
- [ ] `registerVault(relayUrl, vaultId, name)` — calls `POST /vaults` with JWT, handles 409 conflict with user-facing error
- [ ] `unregisterVault(relayUrl, vaultId)` — calls `DELETE /vaults/:vaultId` with JWT
- [ ] `listVaults(relayUrl)` — calls `GET /vaults` with JWT, returns `VaultInfo[]`
- [ ] Auto-register called when CRDT sync is enabled + user is signed in
- [ ] Auto-unregister called when CRDT sync is disabled
- [ ] Skip registration silently when `authMode === "hmac"` (self-hosted, no vault registry)
- [ ] Unit tests for register/unregister/conflict handling

**Verify**: `pnpm test -- VaultRegistration`

**Commit**: `feat(sync): add vault registration service for relay auth`

---

### T13: Session restore on app launch

**What**: On app launch, if a relay URL is configured, attempt to restore the auth session from keychain tokens. Verify the access token (refresh if needed) and set the session in the store. If restore fails, remain signed out silently.
**Where**: `src/features/sync/services/SessionRestore.ts`, app initialization
**Depends on**: T12
**Reuses**: `relayAuthStore.restoreSession()`, `AuthService.getAccessToken()`
**Requirement**: RAUTH-04, RAUTH-05, RAUTH-10

**Done when**:
- [ ] On app init, if vault has `sync.crdt.relayUrl` configured, call `relayAuthStore.restoreSession(relayUrl)`
- [ ] Restore loads tokens from keychain, verifies access token, refreshes if expired
- [ ] If refresh succeeds: session is set, relay provider can connect immediately
- [ ] If refresh fails (token revoked/expired): tokens cleared, user remains signed out, toast "Session expired — please sign in again"
- [ ] If no tokens in keychain: no-op, user stays signed out
- [ ] Does not block app launch — runs async after vault open
- [ ] Unit test: successful restore, expired-but-refreshable, fully-expired, no-tokens

**Verify**: `pnpm test -- SessionRestore`

**Commit**: `feat(sync): add session restore on app launch`

---

## Parallel Execution Map

```
Phase 1 (Sequential):
  T1 ──→ T2

Phase 2 (Parallel — relay server):
  T2 complete, then:
    ├── T3 (DB schema) ─┐
    │                    ├──→ T5 (REST API) ──→ T6 (WS auth)
    └── T4 (JWT utils) ─┘

Phase 3 (Parallel — client, runs alongside Phase 2):
  T2 complete, then:
    ├── T7 (AuthService)     ─┐
    │                         ├──→ T9 (RelayProvider JWT)
    └── T8 (relayAuthStore)  ─┘

Phase 4 (Sequential — UI, after T8 + T9):
  T9 ──→ T10 (OAuth UI) ──→ T11 (Devices UI)

Phase 5 (Sequential — wiring, after T10 + T6):
  T11 ──→ T12 (Vault registration) ──→ T13 (Session restore)
```

**Total: 13 tasks, 4 parallelizable groups, ~5 sequential phases.**

Phases 2 and 3 can run fully in parallel (server vs client).

---

## Task Granularity Check

| Task | Scope | Status |
|------|-------|--------|
| T1: Keychain Rust module | 1 module + 3 commands | OK |
| T2: Auth types + IPC contract | 2 files (types + contract) | OK |
| T3: Relay DB schema + helpers | 1 module (schema + CRUD) | OK |
| T4: Relay JWT utilities | 1 module (sign/verify/keypair) | OK |
| T5: Relay REST API | 1 module (9 endpoints) | Larger but cohesive — all endpoints share auth middleware |
| T6: Relay WS auth update | 1 module (auth.ts) + 1 modification (server.ts) | OK |
| T7: AuthService | 1 service class | OK |
| T8: relayAuthStore | 1 Zustand store | OK |
| T9: RelayProvider JWT | 1 modification to existing provider | OK |
| T10: OAuth UI | 1 component (section) | OK |
| T11: Devices UI | 1 component extension | OK |
| T12: Vault registration | 1 service | OK |
| T13: Session restore | 1 service + init wiring | OK |
