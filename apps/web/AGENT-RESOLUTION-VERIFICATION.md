# Agent proposal resolution verification

Local source verified on 2026-10-30. No running VM services or Android device actions were changed.

## Behavior

- Applied/dismissed decisions persist on the server task with the exact Agent draft revision. Conflicting or stale decisions are rejected; repeated identical decisions are idempotent.
- Resolution clears the pending question. Stopping a waiting task also clears its question.
- Restoring resolved tasks does not recreate a proposal or question. The editor is never reset to the old task base source.
- Tasks from different saved versions or unrelated source content cannot overwrite the editor.
- Legacy tasks whose proposed source exactly matches the current editor are acknowledged as applied during restore; cancelled legacy tasks cannot be inferred automatically and need one explicit cancellation.
- A request after resolution starts from the editor source rather than reusing a rejected Agent draft.
- Failed server acknowledgment leaves the proposal available for retry. Apply still requires the existing Save Case action to persist case code.

## Verification

- Control API TypeScript check: passed.
- apps/web production build: passed; existing bundle-size advisory remains.
- Agent resolution, task and correction tests: 21 passed, 0 failed.
- scripts/verify-agent-resolution-ui.mjs: PASS. Browser verified failed acknowledgment/retry, cancel/reopen, apply/save/reopen, and newer editor source surviving an old task restore.
- scripts/verify-agent-feedback-ui.mjs: PASS. Existing live correction and stop behavior remains functional.
- Browser gates against the real ScriptWorkspace harness .local/agent-resolution-ui/index.html: verify_states, axe_audit, verify_responsive --scale=1.25, verify_keyboard, verify_target_size, verify_mobile_first, lint_intent and slop_tells --strict passed. Axe reported 0 violations.
- Keyboard's initial run observed controls during asynchronous restore and failed on controls that became disabled when the proposal arrived. Rerun waited for the real proposal region before inspection and passed with 15 controls. No controls or gate assertions were removed.
- apps/web/src source gates: lint_hardcodes scanned 100 files with no hardcoded values; check_no_emoji scanned 100 files with no emoji; lint_native_select scanned 61 files with no native select.
- git diff --check: passed.
- Visually inspected the cancelled/reopened workspace with the original editor source retained and no pending question or proposal. No screenshot was saved.

These checks cover local code with mocked server/model responses. The VM Control API must load the updated source, and the frontend must refresh, before this behavior is active in the user's running installation. Theme values were not changed.
