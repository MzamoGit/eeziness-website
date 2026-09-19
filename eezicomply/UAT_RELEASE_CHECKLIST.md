# EeziComply UBO Release Candidate — UAT & Release Checklist

Release candidate branch: `sprint/eezicomply-20260903-1`  
Current price: **R159 per pack**  
Production cut-over: **not yet approved**

## Automated release gate

These checks must pass on every RC change:

- [x] Inline JavaScript parses.
- [x] Public sample pack exists.
- [x] R159 price is present.
- [x] No legacy R99 / R129 / R149 / R169 pack price remains.
- [x] No localhost / 127.0.0.1 / :3000 references remain.
- [x] No unintended Vercel preview URLs are hard-coded.
- [x] Signup callback uses the stable EeziComply URL.
- [x] Password-recovery callback uses the stable EeziComply URL.
- [x] Password recovery completion flow is present.
- [x] Step 7 readiness gate is present.
- [x] Step 9 signing gate is present.
- [x] Completed-case read-only lock is present.
- [x] Duplicate open-filing protection is present.
- [x] Payment-return query state is consumed once.
- [x] Saved CIPC confirmation retrieval is present.

## Live UAT — release blockers

A release candidate may not be promoted to production until each item below is evidenced as PASS.

### 1. Existing-user sign-in and case persistence
- [ ] Sign in with a real pilot account.
- [ ] Confirm the correct most-recent filing opens.
- [ ] Switch between two saved filings.
- [ ] Refresh on the selected filing and confirm the case remains usable.
- Evidence:
- Result:

### 2. New account creation
- [ ] Create a new test account.
- [ ] Receive the confirmation email.
- [ ] Follow the confirmation link.
- [ ] Sign in successfully.
- [ ] Confirm no localhost or protected-preview redirect occurs.
- Evidence:
- Result:

### 3. Forgotten password
- [ ] Click **Forgot password?**
- [ ] Receive recovery email.
- [ ] Open recovery link.
- [ ] Set a new password of at least 8 characters.
- [ ] Return to the original account and confirm saved filings remain.
- Evidence:
- Result:

### 4. Company creation and duplicate-open-filing protection
- [ ] Upload a company registration/disclosure document.
- [ ] Confirm extracted company information.
- [ ] Save the company and create the filing.
- [ ] Attempt to start another assessment using the same company.
- [ ] Confirm EeziComply opens the existing unfinished filing rather than creating a duplicate.
- Evidence:
- Result:

### 5. Document upload and AI reading
- [ ] Upload company registration record.
- [ ] Upload share/securities register if applicable.
- [ ] Upload certified filer ID.
- [ ] Upload BO ID / trust / underlying-entity evidence where applicable.
- [ ] Confirm unread-document status is visible.
- [ ] Run **Read all unread documents**.
- [ ] Confirm failed document reading exposes a retry path rather than a dead end.
- Evidence:
- Result:

### 6. Vault reuse
- [ ] Reuse a personal ID from the Vault.
- [ ] Reuse a company document from the Vault.
- [ ] Confirm the selected current master copy is re-read before attachment.
- [ ] Remove a reused document from the filing and confirm the Vault master remains.
- [ ] Confirm a stale/non-current Vault item is not silently reused.
- Evidence:
- Result:

### 7. Ownership and reconciliation
- [ ] Test a simple direct natural-person shareholding.
- [ ] Test an intermediate company or trust ownership layer.
- [ ] Confirm ownership percentages and dates reconcile.
- [ ] Confirm a discrepancy blocks readiness until resolved.
- Evidence:
- Result:

### 8. Step 7 free readiness
- [ ] Confirm readiness runs from a fresh backend check.
- [ ] Confirm missing facts are clearly listed.
- [ ] Confirm missing evidence is clearly listed.
- [ ] Confirm Step 8 remains locked while blockers exist.
- [ ] Resolve blockers and confirm **Continue to unlock R159 pack** appears.
- Evidence:
- Result:

### 9. Live R159 payment
- [ ] Initiate payment from a ready case.
- [ ] Confirm Paystack opens once.
- [ ] Complete a real/test-approved R159 payment.
- [ ] Return to EeziComply successfully.
- [ ] Refresh and confirm the payment-return state does not replay indefinitely.
- [ ] Confirm an already-paid case does not request payment again when generating the same purchased pack.
- Evidence:
- Result:

### 10. Generated documents
Inspect every generated PDF, not only filenames:
- [ ] Mandate.
- [ ] Securities/share register.
- [ ] BO / beneficial-interest / control schedule.
- [ ] Share certificate where applicable.
- [ ] Sole-director / signatory resolution where applicable.
- [ ] Ownership structure/disclosure.
- [ ] CIPC answer sheet.
- [ ] Filing guide.
- [ ] Complete filing pack.
- [ ] Names, IDs, capacities, percentages and dates are correct.
- [ ] Pagination and layout are acceptable.
- [ ] No placeholder/sample data appears.
- Evidence:
- Result:

### 11. Signature Vault and signed documents
- [ ] Save an authorised signature.
- [ ] Confirm only expected case signatories can be selected where names are known.
- [ ] Confirm the newest active saved signature is selected for duplicate signer names.
- [ ] Sign the mandate.
- [ ] Confirm signed and unsigned versions are clearly distinguishable.
- Evidence:
- Result:

### 12. Two-signatory share certificate
- [ ] Apply signatory 1.
- [ ] Confirm status remains **1 of 2** and filing gate stays blocked.
- [ ] Apply a distinct signatory 2.
- [ ] Confirm status becomes **2 of 2**.
- [ ] Confirm the signed PDF visibly contains both signatures in the correct locations.
- [ ] Confirm filing gate clears only after both signatures are complete.
- Evidence:
- Result:

### 13. Complete signed pack
- [ ] Confirm individual signed documents remain downloadable.
- [ ] Confirm complete signed pack rebuild succeeds after signatures.
- [ ] Confirm the complete pack contains the latest signed versions.
- Evidence:
- Result:

### 14. Ask EeziComply
- [ ] Ask what to do next.
- [ ] Ask why a person was identified.
- [ ] Ask what documents are still needed.
- [ ] Test isiZulu or another supported language.
- [ ] Confirm temporary Ask failure does not affect the saved filing.
- Evidence:
- Result:

### 15. CIPC completion
- [ ] Enter CIPC tracking/reference number.
- [ ] Upload CIPC confirmation/certificate.
- [ ] Mark filing complete.
- [ ] Confirm completed case becomes read-only.
- [ ] Reopen saved completion evidence.
- [ ] Confirm reminder is described as an EeziComply review prompt, not a definitive filing deadline.
- Evidence:
- Result:

### 16. Next compliance cycle
- [ ] Start next filing from a completed filing.
- [ ] Confirm same company record is reused.
- [ ] Confirm reusable Vault evidence is available.
- [ ] Confirm a new filing record is created without changing the completed historical case.
- [ ] If another open filing exists, confirm it is opened instead of duplicated.
- Evidence:
- Result:

### 17. Mobile UAT
Test on an actual mobile viewport/device:
- [ ] Account screens.
- [ ] Step navigation.
- [ ] Error banner visibility.
- [ ] Document uploads.
- [ ] Vault reuse.
- [ ] Ownership forms.
- [ ] Step 7 readiness.
- [ ] Payment return.
- [ ] Signature controls.
- [ ] PDF downloads.
- [ ] Completed-case navigation.
- Evidence:
- Result:

## Production cut-over gate

Production promotion requires:

- [ ] Automated RC gate PASS.
- [ ] All live blocker UAT above PASS.
- [ ] Supabase Auth redirect allowlist confirmed for the chosen production URL.
- [ ] Paystack callback/return URL confirmed for the chosen production URL.
- [ ] Production URL decision documented.
- [ ] PR reviewed and changed from Draft to Ready.
- [ ] PR merged.
- [ ] Production deployment READY.
- [ ] Production smoke test: public page, signup/sign-in, sample pack, readiness, payment return.
- [ ] Old EeziComply deployment either redirects to the authoritative URL or is formally retained for a documented reason.

## Release decision

- Candidate: **HOLD — live end-to-end UAT outstanding**
- Automated/source controls: **PASS**
- Production change: **NONE**
