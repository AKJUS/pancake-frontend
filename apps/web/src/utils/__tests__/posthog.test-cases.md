#### Test Case: App works when PostHog env vars are missing

- Scenario: Local or preview env does not configure PostHog.
- Preconditions: `NEXT_PUBLIC_POSTHOG_KEY` or `NEXT_PUBLIC_POSTHOG_HOST` is unset.
- Steps:
  1. Start `apps/web`.
  2. Open `/swap`.
  3. Connect a wallet and navigate across a few routes.
- Expected Result: The app behaves normally and no PostHog-related crash occurs.

#### Test Case: Wallet connect does not identify the user by default

- Scenario: A user connects a wallet while identity is disabled by default.
- Preconditions: PostHog env vars are configured and `NEXT_PUBLIC_POSTHOG_IDENTIFY_ENABLED` is unset or `false`.
- Steps:
  1. Open the app in a browser.
  2. Connect a wallet.
  3. Inspect PostHog requests and live events.
- Expected Result: No `identify()` call is sent, events remain anonymous, and browsing continuity still uses PostHog's anonymous distinct id.

#### Test Case: Non-core pageviews follow the default 10% sampling policy

- Scenario: The app keeps anonymous pageview analytics with cost control enabled.
- Preconditions: PostHog env vars are configured and `NEXT_PUBLIC_POSTHOG_SAMPLE_RATE` is unset or set to `0.1`.
- Steps:
  1. Open the app and navigate across a few routes.
  2. Inspect PostHog live events or network traffic over multiple navigations.
- Expected Result: Pageviews continue to appear, but at a sampled rate rather than one event per every navigation.

#### Test Case: Core success events remain unsampled

- Scenario: Successful conversion events remain fully observable after the cost optimization.
- Preconditions: PostHog env vars are configured and at least one liquidity route is usable.
- Steps:
  1. Complete one successful swap.
  2. Complete one successful add-liquidity flow.
  3. Inspect PostHog events.
- Expected Result: `swap_succeeded` and `liquidity_add_succeeded` are both visible without sampling loss.

#### Test Case: Noisy lifecycle events are disabled by default

- Scenario: The optimization removes low-value, high-frequency events.
- Preconditions: PostHog env vars are configured with default settings.
- Steps:
  1. Connect and disconnect a wallet.
  2. Trigger an add-liquidity rejection or failure path.
  3. Inspect PostHog live events.
- Expected Result: `wallet_connected`, `wallet_disconnected`, `liquidity_add_started`, and `liquidity_add_failed` are not emitted by default.
