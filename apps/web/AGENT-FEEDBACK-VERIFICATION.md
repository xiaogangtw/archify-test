# Agent sliding and correction verification

Verified against the local source on 2026-10-30. No device actions or application data changes were performed by these checks. Preview screenshots were not saved.

## Changes

- Agent swipe accepts bounded percent and screen area. Default percent is 0.25; Appium execution and replay use the same values.
- Redacted XML retains bounds so the model can reason about element positions. Input text remains redacted.
- Two consecutive swipes with unchanged redacted element XML pause the task. This detects unchanged element trees, not visual similarity or semantic progress.
- The existing chat accepts corrections while the Agent runs. Pending model plans are discarded; an action already dispatched is allowed to finish and is recorded. A fresh observation is required before further device actions.
- Failed correction delivery leaves input text intact. Empty input retains the stop control.
- Prompt instructions allow removing unneeded Agent exploration recordings while preserving user-authored steps. Draft completion still does not imply a verified test.

## Results

- Control API TypeScript check: passed.
- apps/web production build: passed; existing large-chunk advisory remains.
- Android Agent task and feedback tests: 17 passed, 0 failed.
- Appium tests: 27 passed, 0 failed.
- Correction browser harness: passed send during execution, delivery failure/retry, stop, and no duplicate task creation.
- Complete Control API suite: 179 passed, 3 failed. Two failures were local socket access restrictions; both passed when rerun with local network access. The remaining failure is api-scan-preview.test.ts, source Query/Variables superseding saved defaults. This change does not edit that API implementation.

UI gates on .local/agent-feedback-ui/index.html: verify_states, axe_audit, verify_responsive (1.25 scale), verify_keyboard, verify_target_size, verify_mobile_first, lint_intent and slop_tells --strict all exited 0 without skipping. Axe reported 0 violations. These results cover the correction harness, not every application screen.

Source gates on apps/web/src: lint_hardcodes reported no hardcoded values in 100 files; check_no_emoji reported no emoji in 100 files; lint_native_select reported no native select in 61 files. Python checks used UTF-8 mode.

Token checks used a temporary DTCG projection of the actual Tailwind light-theme semantic colors in .local/agent-feedback-tokens.json. validate_tokens passed (11 tokens), validate_contrast passed required light pairs with an advisory for the decorative default border. The projection is verification data, not a second theme source or stylesheet. Passing the TypeScript config directly to the JSON-only validators failed to parse; the projection replaced that invalid invocation.

Visual inspection of the executing chat with correction text confirmed an enabled input and send control. No new visual styling was introduced.

## Runtime scope

These checks use mocked model/device responses. They do not prove the real Email field can be found in LINE. The running VM Control API and Windows Android worker have not been updated or restarted by this change. Both must load the updated source before a real-device retest. Correction queues are applied at operation boundaries; they do not cancel a device gesture already in progress.
