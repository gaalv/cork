# F38 — Relay Auth & Identity

## Problem Statement

F37's CRDT relay uses a per-vault shared secret (HMAC handshake) for auth. This works for self-hosted relays where the user controls both ends, but fails for a hosted relay scenario: there is no way to know _who_ is connecting, manage devices, revoke access, or offer a frictionless "sign in and sync" experience. For Cork to attract users with a hosted real-time sync service (the open-core revenue path from SD-006), the relay needs an identity layer that is secure, low-friction, and extensible — without compromising the local-first, no-account-required philosophy for users who self-host.

## Goals

- [ ] Users can authenticate with a hosted Cork relay via GitHub OAuth and receive a JWT that authorizes WebSocket connections
- [ ] Vault ownership is established on the relay so only the owner's devices can sync a given vault
- [ ] Users can list and revoke their connected devices from within the app
- [ ] Self-hosted relays retain the existing shared-secret auth (F37) — no account required
- [ ] The auth architecture supports adding passkeys/email providers later without rewriting the relay or client

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Email/password auth | Not needed for dev audience; adds password storage complexity |
| Passkeys / WebAuthn | Future provider — architecture supports it, but not implemented in F38 |
| Multi-user vault sharing | F38 is single-user identity; sharing is a future product decision |
| Hosted relay infrastructure (provisioning, billing, ops) | Product/ops decision, not a code feature |
| E2E encryption of CRDT updates | Separate concern (F37 out-of-scope item); auth != encryption |
| Mobile OAuth flow | Requires a mobile app first; desktop-only in F38 |
| Relay admin dashboard | Monitoring/admin is a future ops concern |

---

## User Stories

### P1: GitHub OAuth login for relay &#11088; MVP

**User Story**: As a Cork user, I want to sign in with my GitHub account so that the hosted relay knows who I am and lets me sync my vaults.

**Why P1**: Without identity, the hosted relay cannot distinguish users or authorize vault access. This is the foundation for everything else.

**Acceptance Criteria**:

1. WHEN user clicks "Sign in with GitHub" in Settings > Sync THEN the system SHALL open the system browser with the GitHub OAuth authorization URL (OAuth App flow, not GitHub App)
2. WHEN user authorizes in the browser THEN GitHub SHALL redirect to a localhost callback; the app SHALL exchange the code for a GitHub access token, request `GET /user` to obtain `github_id` and `username`, then discard the GitHub token
3. WHEN the app has the user's GitHub identity THEN it SHALL send `POST /auth/github` to the relay with `{ code }` and receive back a `{ accessToken, refreshToken, expiresIn }` JWT pair
4. WHEN the JWT is received THEN the system SHALL store it securely (OS keychain via `tauri-plugin-keyring` or fallback encrypted file) and display the signed-in user's GitHub username + avatar in Settings
5. WHEN the access token expires THEN the system SHALL silently refresh using the refresh token; if refresh fails, prompt re-login
6. WHEN user clicks "Sign out" THEN the system SHALL clear local tokens, notify the relay to invalidate the refresh token, and disconnect all relay providers

**Independent Test**: Sign in via GitHub, verify JWT is issued, verify WebSocket connects with the JWT, sign out, verify WebSocket disconnects.

---

### P1: JWT-authenticated WebSocket connection &#11088; MVP

**User Story**: As a signed-in user, I want my relay WebSocket connections to use my JWT so that only my devices can access my vaults on the hosted relay.

**Why P1**: The JWT replaces the shared secret for hosted relays. Without this, auth has no effect on the actual sync connection.

**Acceptance Criteria**:

1. WHEN the relay provider connects to a hosted relay THEN it SHALL include the JWT as a `token` query parameter in the WebSocket URL (e.g., `wss://relay.example.com/<room>?token=<jwt>`)
2. WHEN the relay receives a WebSocket connection with a `token` param THEN it SHALL validate the JWT signature, check expiry, extract `userId`, and verify the user owns the requested vault room — rejecting with `4001 Unauthorized` if any check fails
3. WHEN a WebSocket connection is established with a valid JWT THEN the relay SHALL allow the client to join the room and participate in Yjs sync
4. WHEN the JWT expires during an active WebSocket session THEN the client SHALL transparently reconnect with a refreshed token (no user-visible interruption)
5. WHEN connecting to a self-hosted relay (no JWT configured) THEN the system SHALL fall back to F37's shared-secret HMAC auth — both paths coexist

**Independent Test**: Connect to relay with valid JWT — sync works. Connect with expired/invalid JWT — connection rejected. Connect to self-hosted relay with shared secret — works as before.

---

### P1: Vault registration on relay &#11088; MVP

**User Story**: As a signed-in user, I want to register my vault with the hosted relay so that the relay knows which vaults belong to me and only my devices can sync them.

**Why P1**: Without vault ownership, any JWT holder could join any room. Vault registration is the authorization boundary.

**Acceptance Criteria**:

1. WHEN user enables real-time sync for a vault and is signed in to a hosted relay THEN the system SHALL call `POST /vaults` with `{ vaultId, name }` and the user's JWT to register the vault
2. WHEN a vault is registered THEN the relay SHALL store `{ vaultId, ownerId, name, createdAt }` and only allow WebSocket connections from that owner's JWTs to rooms prefixed with that `vaultId`
3. WHEN user opens a vault on a second device (already signed in) THEN the system SHALL call `GET /vaults` to list the user's registered vaults and auto-link if the local vault's `vaultId` matches a registered one
4. WHEN user disables real-time sync or deletes a vault THEN the system SHALL call `DELETE /vaults/:vaultId` to unregister it from the relay
5. WHEN an unauthenticated or non-owner client attempts to join a vault's relay room THEN the relay SHALL reject with `4003 Forbidden`

**Independent Test**: Register vault, connect from two devices with same account — both sync. Connect from different account — rejected.

---

### P2: Device management

**User Story**: As a user, I want to see which devices are connected to my relay account and revoke any I no longer trust.

**Why P2**: Security hygiene. Not blocking for sync to work, but important for user trust, especially before a public launch.

**Acceptance Criteria**:

1. WHEN user opens Settings > Sync > Devices THEN the system SHALL call `GET /devices` and display a list of `{ deviceId, deviceName, platform, lastSeen }`
2. WHEN user clicks "Revoke" on a device THEN the system SHALL call `DELETE /devices/:deviceId`, invalidating that device's refresh token — the revoked device disconnects on next token refresh
3. WHEN a new device signs in THEN the relay SHALL auto-register it with `{ deviceId, deviceName, platform }` derived from the JWT claims and OS info
4. WHEN the current device is the one being revoked THEN the system SHALL sign out locally and show a "Session revoked" message

**Independent Test**: Sign in on two devices, list shows both, revoke one, verify the revoked device loses sync.

---

### P2: Auth provider extensibility

**User Story**: As a maintainer, I want the auth architecture to support adding new identity providers (passkeys, email) without rewriting the relay or client.

**Why P2**: Strategic investment. GitHub-only is fine for launch, but the architecture must not paint us into a corner.

**Acceptance Criteria**:

1. WHEN a new auth provider is added to the relay THEN it SHALL only require: (a) a new `POST /auth/<provider>` endpoint that returns the same `{ accessToken, refreshToken, expiresIn }` shape, and (b) a new client-side button/flow that calls it — no changes to WebSocket auth, vault registration, or device management
2. WHEN the JWT is issued THEN it SHALL contain only provider-agnostic claims: `{ sub: <relay-user-id>, deviceId, iat, exp }` — no GitHub-specific fields in the token payload
3. WHEN the relay validates a JWT THEN it SHALL check signature + expiry + ownership only — never inspect which provider issued the original identity

**Independent Test**: Add a mock `/auth/test` endpoint that issues the same JWT shape. Verify all relay features (WebSocket, vaults, devices) work identically.

---

### P3: Signed-in user profile in app

**User Story**: As a signed-in user, I want to see my identity (avatar, username) in the app so I know which account is syncing.

**Why P3**: Polish. Sync works without this, but it builds trust and is trivial to implement once auth exists.

**Acceptance Criteria**:

1. WHEN user is signed in THEN the Settings > Sync section SHALL display the user's GitHub avatar and username with a "Sign out" link
2. WHEN user is not signed in THEN the section SHALL show a "Sign in with GitHub" button
3. WHEN the relay is self-hosted (shared-secret mode) THEN the section SHALL show the existing shared-secret fields instead — no sign-in UI

**Independent Test**: Sign in, verify avatar/username appear. Sign out, verify button appears.

---

## Edge Cases

- WHEN the system browser is unavailable or the user cancels the OAuth flow THEN the app SHALL show a toast "Sign-in cancelled" and remain in signed-out state
- WHEN the relay is unreachable during sign-in THEN the app SHALL show a toast "Could not reach relay — check your connection" and not store any tokens
- WHEN the relay returns an error during vault registration (e.g., vault already registered by another user) THEN the app SHALL show a clear error and not enable sync for that vault
- WHEN the user has multiple GitHub accounts and signs in with a different one THEN the relay SHALL treat it as a different user — vault ownership is per `github_id`
- WHEN the refresh token is expired or revoked (device was revoked from another device) THEN the app SHALL clear local tokens, disconnect sync, and prompt re-login with a non-disruptive toast
- WHEN network is lost during an active relay session THEN the existing F37 reconnect-with-backoff logic applies — the JWT is included on reconnect; if it expired during downtime, a silent refresh happens first

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|----------------|-------|-------|--------|
| RAUTH-01 | P1: GitHub OAuth login | Specify | Pending |
| RAUTH-02 | P1: GitHub OAuth login | Specify | Pending |
| RAUTH-03 | P1: GitHub OAuth login | Specify | Pending |
| RAUTH-04 | P1: GitHub OAuth login | Specify | Pending |
| RAUTH-05 | P1: GitHub OAuth login | Specify | Pending |
| RAUTH-06 | P1: GitHub OAuth login | Specify | Pending |
| RAUTH-07 | P1: JWT WebSocket | Specify | Pending |
| RAUTH-08 | P1: JWT WebSocket | Specify | Pending |
| RAUTH-09 | P1: JWT WebSocket | Specify | Pending |
| RAUTH-10 | P1: JWT WebSocket | Specify | Pending |
| RAUTH-11 | P1: JWT WebSocket | Specify | Pending |
| RAUTH-12 | P1: Vault registration | Specify | Pending |
| RAUTH-13 | P1: Vault registration | Specify | Pending |
| RAUTH-14 | P1: Vault registration | Specify | Pending |
| RAUTH-15 | P1: Vault registration | Specify | Pending |
| RAUTH-16 | P1: Vault registration | Specify | Pending |
| RAUTH-17 | P2: Device management | Specify | Pending |
| RAUTH-18 | P2: Device management | Specify | Pending |
| RAUTH-19 | P2: Device management | Specify | Pending |
| RAUTH-20 | P2: Device management | Specify | Pending |
| RAUTH-21 | P2: Auth extensibility | Specify | Pending |
| RAUTH-22 | P2: Auth extensibility | Specify | Pending |
| RAUTH-23 | P2: Auth extensibility | Specify | Pending |
| RAUTH-24 | P3: User profile in app | Specify | Pending |
| RAUTH-25 | P3: User profile in app | Specify | Pending |
| RAUTH-26 | P3: User profile in app | Specify | Pending |

**Coverage:** 26 total, 0 mapped to tasks, 26 unmapped

---

## Success Criteria

- [ ] A user can sign in with GitHub, connect to a hosted relay, and sync a vault between two desktop devices — end to end
- [ ] Self-hosted relay users experience zero changes — shared-secret auth works exactly as before
- [ ] Adding a new auth provider requires only a new `/auth/<provider>` endpoint + client button — no WebSocket/vault/device code changes
- [ ] Token refresh is invisible to the user — no sync interruptions during normal use
- [ ] All tokens are stored securely (OS keychain preferred) and never written to vault files or `.cork/config.json`
