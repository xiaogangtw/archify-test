# Android conversation authoring verification

Date: 2026-10-30. Local implementation; deployment remains blocked by Ubuntu SSH authentication.

## Entry and behavior

Android Appium → 模擬器 → select 測試帳號 → select Flow Case → edit the case. Use the left conversation beside the phone. Under 操作設定, keep 讓 AI 操作手機、產生腳本並重跑驗證 checked (default in the Android editor).

The conversation sends `autoVerify:true`. The Agent observes and operates using the existing device tools, records a draft and must verify the current exact source before completing a draft task. Failed verification events retain their failure status. Repair is limited to three verification attempts per request; the failure and draft remain available. The model is instructed to restore the observed start state before replay and to ask when replay effects are uncertain. This does not guarantee that arbitrary applications or goals can be automated.

After a failed replay, structural guards preserve assertions, expected values and branch placement across repair patches. Locator/name/timeout changes remain possible; semantic equivalence of different locators is not mechanically proven. Apply/save and conversation restoration retain the existing behavior.

`scrollUntilVisible` now shares one timeout across the search rather than restarting it for every swipe. Worker timing output includes step names, paths, actions, statuses and durations, excluding locators and entered values.

## Checks actually run

- Agent task, automatic verification and resolution tests: 22 passed, 0 failed.
- Android regression suite, after the final worker diagnostic change: 81 passed, 0 failed. Restricted execution initially failed a temporary-file rename; normal local execution passed.
- Control API TypeScript check: passed.
- apps/web production build: passed; Vite retains its bundle-size advisory.
- Full Control API suite: 189 passed, 1 failed. The remaining failure is `source Query and Variables supersede accidentally saved defaults; manual definitions and saved case payloads remain independent` in `services/control-api/test/api-scan-preview.test.ts`; it concerns GraphQL request defaults outside the Android changes. The complete suite is not green.
- `scripts/verify-agent-autoverify-ui.mjs`: PASS. Real browser with mocked server/model verified mode toggle, phone and autoVerify submission, result display, proposal application and case save.
- Render gates against `.local/agent-autoverify-ui/index.html`, with `DS_REQUIRE_BROWSER=1`: states passed (36 element states); axe passed (0 violations); responsive at 1.25x passed; keyboard passed (11 controls); target size passed (22 targets); mobile-first passed; intent passed; overflow passed; reduced motion passed.
- Strict slop heuristic exited 0 with a medium advisory about one shadow level; no aesthetic quality score is claimed. Existing restrained surfaces were preserved.
- Source gates against apps/web/src: hardcodes passed (100 files), emoji passed (100 files), native select passed (61 files). UTF-8 Python mode was required on this Windows host.
- Existing theme snapshot `.local/agent-feedback-tokens.json`: valid (11 tokens), required light contrast pairs passed. No theme values changed; fixed light theme means dark mode is outside this change.
- Visually inspected the rendered conversation and expanded operation setting directly from an in-memory browser image. No preview screenshot was saved.

## Deployment and real-device limits

The local API health endpoint and Android inventory responded successfully. The test emulator was online and idle. No messaging business flow was executed during these checks.

Read-only SSH with BatchMode to `<vm-user>@127.0.0.1:2222` failed with `Permission denied (publickey,password)`. The VM has not been updated by this work. To deploy, run `npm run android:pair` from the repository and enter the Ubuntu password in the terminal. After success, restart the existing `npm run dev` session to load the updated Windows worker and refresh the frontend. `-DownloadOnly` does not deploy these changes. Do not run the new frontend against an old API that rejects the new request field.

After deployment, validate the actual flow goal and intended start state on the test device before treating this case as verified.
