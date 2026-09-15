# Eezi Delivery Gate

These instructions are mandatory for every build, fix, sprint, regression and UAT task in this repository.

## Before changing anything

Write down the observed failure and identify its reusable source of truth: shared code, schema, workflow rule, configuration, catalogue or template.

Do not modify a test application's data or generated output to make a test pass. Test records are evidence. A manual data correction is allowed only when the user explicitly requests operational data repair, and it never counts as a product fix.

Reject a proposed change before implementation if any answer below is no:

1. Does it fix the reusable system rather than the test case?
2. Does the app perform every mandatory internal step automatically?
3. Does it preserve or simplify the normal user journey?
4. Does it ask the user only for facts, files, consent or decisions that only the user can provide?
5. Does it preserve the agreed scope, pricing and commercial gates?

Do not add a button, retry step, confirmation, manual capture field or technical instruction merely to let users manage an internal failure. Fix the automation. Show a recovery action only when automatic recovery has genuinely failed and user input is indispensable.

Keep implementation details such as Edge Functions, MIME types, processing jobs, database states, OCR and transparency validation out of customer-facing copy.

## Required verification

Exercise the ordinary end-to-end user journey with a fresh or unmodified UAT case. Do not use database edits, backfills, manually replaced outputs or hidden admin actions to complete that journey.

Verify the change at both levels:

- the reported UAT case now passes through the normal workflow; and
- the reusable rule also applies to new cases.

For generated documents, open and inspect the actual output. A success message, row status, file count or completed job is not proof. Check the relevant content, signatories, dates, placement, pagination and visual quality page by page.

For evidence-derived data, prove the value came from the source document. Do not compensate for extraction failure with manual capture.

After a failure, keep the test failed until corrected code produces a new passing result through the normal path. Never relabel or manually repair the failed artifact.

Do not proceed to payment, submission, filing, release or another irreversible commercial gate until every prerequisite has genuinely passed.

## Completion report

State:

- the reusable root cause;
- the shared component changed;
- the normal-path test performed;
- the concrete evidence inspected;
- remaining failures or blockers.

Never claim fixed, passed, signed, verified, ready or complete without that evidence.

## New Eezi applications

Any new Eezi repository must include this file before feature development or UAT begins.
