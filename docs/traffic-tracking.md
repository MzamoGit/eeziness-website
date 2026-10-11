# Website traffic tracking

Observed gap: no page-view collector, product-click measurement or private reporting on eeziness.co.za. The reusable source of truth is the shared tracker, collector and isolated analytics tables. Public visits must never need login, and analytics errors must never prevent navigation.

Uses Eezi Design System v1.0. Reuses the existing EeziFinance authentication project; analytics storage is isolated from finance records. Only the explicitly provisioned website owner can retrieve statistics. No account creation or password changes are performed.

No cookies or browser visitor identifiers. The server creates a keyed hash of network address and browser agent that resets daily in Africa/Johannesburg. Raw addresses and agents are not written to analytics storage. This is pseudonymous measurement, not proof of distinct people: shared networks and browser changes affect estimates. Reports sum daily estimates, rather than claiming unique people across days.

Records fixed public page paths, referral hostnames, slug-only UTM source/medium/campaign, coarse device type and allowlisted product clicks. No form inputs, query strings, fragment identifiers, full referral URLs or customer app data. Recognised automation and Do Not Track/Global Privacy Control are excluded. Admin/test browsers can pause tracking locally; preview hosts are excluded. Untagged WhatsApp shares generally appear as direct/unknown.

Event payloads are bounded, IDs deduplicated and each daily visitor is capped at 120 events per minute. Origin checks reduce accidental cross-site submissions but do not prevent forged HTTP clients. Bot detection is best effort. Raw events retained for 90 days; daily cleanup runs automatically through pg_cron.

Owner opens /admin/traffic and signs in with the existing EeziFinance account. The browser retains the dashboard session only in memory. The reporting endpoint verifies the token with Auth and checks the database allowlist on every request. The public table and RPC permissions deny anon/authenticated reads and writes.

## Verification

`node tests/traffic.collector.cjs` checks owner, non-owner and invalid-token paths with mocked Auth responses. Set `EEZI_TEST_MODULES` to a directory containing TypeScript. Browser QA uses Playwright (`CODEX_PRIMARY_RUNTIME_NODE_MODULES`) and an existing Chromium executable (`EEZI_TEST_CHROMIUM`); deployment requires no npm dependencies. Browser checks cover actual collector page-view requests, emitted product clicks, mobile login, browser exclusion and dashboard rendering/export using an explicit report fixture. Inspect the emitted event IDs in the database to confirm navigation-time click persistence. Real owner password sign-in requires the owner's credentials and is not claimed by fixture tests.
