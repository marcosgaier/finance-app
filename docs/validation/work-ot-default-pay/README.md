# Default overtime: Cobrar Enhanced Payment

Remote PR #16 head verified via GitHub and git ls-remote: 42cf18db8174eb4ba627139b8885353fd42cfd94.

Product change: only src/modules/work/demo/fixtures.ts. Removed the synthetic bank preference for 2026-09-20; empty preferences inherit DEFAULT_OVERTIME_TREATMENT=pay from unchanged vendored Taura. Explicit preferences are still respected, including synthetic bank inputs tested independently. No production data integration or migration is introduced.

PASS: npm test (including independent executable parity against node_modules/.cache/taura-upstream, pinned bytes and pay/bank), typecheck:work, production build, git diff --check. Logs included.

PASS: Chrome 157, 360/390/1280: initial pay, manual bank/pay, coherent summary/payment amounts, reset cancellation/confirmation, exit/reopen/reload, protected records, editor/batch/calendar, keyboard/focus, no overflow, unchanged Finance and zero Work persistence/network effects. See editor-result.json, ui-results.json and overtime-pay/bank screenshots. Screenshot 360 reviewed visually.

Default synthetic amounts: base 1800, enhanced 300, night 36, weekend 48, gross 2184, PAYE including ACC 564.27, KiwiSaver 65.52, net 1554.21 NZD. Bank retains base and adds only 10 bank hours.

PASS: 20 card-payment UI cases at 360/1280. PASS: planner desktop and mobile, isolated synthetic profiles; planner-result.json contains the final mobile run (same checks passed on desktop).

Reproduce: npm test with TAURA_PARITY_ROOT=node_modules/.cache/taura-upstream; npm run typecheck:work; npm run build; git diff --check; validate-work-editor-ui.mjs; validate-work-demo-ui.mjs; validate-card-payments-ui.mjs; validate-planning-ui.mjs desktop and MOBILE=1. UI scripts use external PLAYWRIGHT_MODULE and local CHROMIUM_PATH, no dependency changes. VALIDATION_OUTPUT_DIR selects this directory; planner PREVIEW_URL points to an isolated local production server.

Limits: local Chrome and emulated viewport evidence; hosted preview session, physical Android/PWA and real screen reader remain unverified. Vercel commit status reported in PR comment after push. No merge; PR #15, original Taura, vendored engine, actual data and future salary audit #33 untouched.
