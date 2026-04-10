#### Test Case: App works when PostHog env vars are missing

- Scenario: Local or preview env does not configure PostHog.
- Preconditions: `NEXT_PUBLIC_POSTHOG_KEY` or `NEXT_PUBLIC_POSTHOG_HOST` is unset.
- Steps:
  1. Start `apps/web`.
  2. Open `/swap`.
  3. Connect a wallet and navigate across a few routes.
- Expected Result: The app behaves normally and no PostHog-related crash occurs.

#### Test Case: Wallet connect and disconnect emit the expected lifecycle events

- Scenario: A user connects and disconnects a wallet.
- Preconditions: PostHog env vars are configured in a non-production project.
- Steps:
  1. Open the app in a browser.
  2. Connect a wallet.
  3. Disconnect the wallet.
- Expected Result: `wallet_connected` and `wallet_disconnected` are both visible in PostHog with host, chain, and wallet properties.

#### Test Case: Swap flow emits submit, success, and failure events

- Scenario: A user interacts with the swap flow.
- Preconditions: PostHog env vars are configured and the swap flow is usable.
- Steps:
  1. Submit a valid swap and wait for tx submission.
  2. Trigger a failing or rejected swap path.
  3. Inspect PostHog events.
- Expected Result: `swap_submitted`, `swap_succeeded`, and failure-path `swap_failed` events include token, wallet, and chain context.

#### Test Case: Add liquidity flow emits submit, success, and failure events

- Scenario: A user interacts with V2, stable, or V3 add-liquidity flows.
- Preconditions: PostHog env vars are configured and at least one liquidity route is usable.
- Steps:
  1. Submit an add-liquidity transaction.
  2. Complete one successful path.
  3. Trigger one failing or rejected path if possible.
- Expected Result: `liquidity_add_started`, `liquidity_add_succeeded`, and failure-path `liquidity_add_failed` events are captured with pool and token context.
