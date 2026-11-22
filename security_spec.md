# InternHub Security Specification (Phase 0 — Payload-First TDD)

## 1. Data Invariants
1. **Per-User Database Isolation (`/users/{userId}/...`)**: Every user document and subcollection (`profile`, `applications`, `leaveRequests`, `nocRequests`, `parentConsents`, `studentSchedules`) belongs strictly to one authenticated Firebase `uid` (`ownerUid == request.auth.uid`). No non-admin user can read, list, create, update, or delete another user's private records.
2. **Email Verification Gate**: All authenticated read/write operations require `request.auth != null && request.auth.token.email_verified == true`.
3. **Immutable Ownership & Temporal Integrity**: `ownerUid` / `uid` / `createdByUid` and `createdAt` cannot be modified after creation (`createdAt == request.time` on create; `updatedAt == request.time` on create and update).
4. **Shared Live Opportunity Hub (`/opportunities/{opportunityId}`)**: Contains strictly public non-PII opportunity metadata. Authenticated verified users may read/list verified listings; only the creator (`createdByUid == request.auth.uid`) or verified admin (`isAdmin()`) may update or delete an opportunity.
5. **Strict Key & Size Boundaries**: Every write validates required + allowed keys (`hasAll` + `hasOnly` on create; `affectedKeys().hasOnly` action branches on update), strict string `.size()` bounds, bounded lists (`<= 30`), and safe document ID format (`^[a-zA-Z0-9_\-]+$`, max 128 chars).

## 2. Adversarial "Dirty Dozen" Payloads (Expected: `PERMISSION_DENIED`)
1. **Shadow Role Escalation on Create**: Creating `/users/{uid}` with extra field `isAdmin: true` -> Rejected by `hasOnly(...)`.
2. **Cross-User Read/List**: User A calls `get` or `list` on `/users/{uidB}/nocRequests` -> Rejected by `request.auth.uid == userId` and `resource.data.ownerUid == request.auth.uid`.
3. **UID Spoofing on Create**: User A writes `/users/{uidA}/applications/app-1` with `ownerUid: uidB` -> Rejected by `incoming().ownerUid == request.auth.uid`.
4. **Unverified Email Access**: Call with `request.auth.token.email_verified == false` -> Rejected by `isVerifiedUser()`.
5. **Email Spoof Admin Bypass**: Token claims `email: "tekmalvishal26@ifheindia.org"` with `email_verified: false` -> Rejected by `isAdmin()`.
6. **ID Poisoning**: Creating `/users/{uid}/applications/<1.5KB-junk-id>` or `/opportunities/bad$id` -> Rejected by `isValidId()`.
7. **Oversized String Exhaustion**: Writing `about` with > 1500 chars or `parentSignatureDataUrl` with > 250000 chars -> Rejected by string `.size()` limits.
8. **Unbounded Array Injection**: Writing `skills` array with 100 entries or non-string item `[123]` -> Rejected by `skills.size() <= 30` and `skills[0] is string`.
9. **Client Timestamp Forgery**: Creating a document with backdated `createdAt` instead of `request.time` -> Rejected by `incoming().createdAt == request.time`.
10. **Immutable Field Mutation**: Updating `leaveRequests/{id}` to overwrite `ownerUid` or `createdAt` -> Rejected by `ownerUid == existing().ownerUid && createdAt == existing().createdAt`.
11. **Terminal State Shortcut**: Non-admin attempting to edit a finalized `Approved` or `Rejected` `leaveRequests` / `nocRequests` document -> Rejected by terminal status lock (`existing().status == 'Pending'`).
12. **Unauthorized Opportunity Tampering**: User B attempting to `update` or `delete` User A's `/opportunities/{id}` doc -> Rejected by `existing().createdByUid == request.auth.uid || isAdmin()`.
