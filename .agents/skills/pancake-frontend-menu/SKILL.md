---
name: pancake-frontend-menu
description: Guardrails for Pancake frontend menu changes. Use when modifying apps/web/src/components/Menu/config/config.ts or related menu navigation logic.
---

# Pancake Frontend Menu

## Required Verification

- After any change to `apps/web/src/components/Menu/config/config.ts` (including menu labels, order, links, or types), run:
  `pnpm -C apps/web exec vitest run src/__tests__/utils/utils.test.ts`
- Do not treat the change as complete until this test command is executed and results are reported.

## Test Maintenance Rule

- If menu order changes cause index-based assertions to fail in `src/__tests__/utils/utils.test.ts`, prefer behavior-based assertions (for example `toBeUndefined()`) and rerun the same test.
