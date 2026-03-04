---
name: browser-testing-automation
description: Automate browser-based QA testing on PancakeSwap using Chrome DevTools MCP and MetaMask wallet extension. Use when the user asks to test a page, connect wallet, interact with MetaMask, automate browser actions, run E2E tests, verify UI behavior, or mentions Chrome DevTools, MetaMask, or browser automation.
---

# Browser Testing Automation

Automate QA testing for PancakeSwap using Chrome DevTools MCP and MetaMask.

## Prerequisites

- Find CHROME_USER_DATA_DIR in .env.local

- Launch terminal with command /Applications/Google\ Chrome\ Dev.app/Contents/MacOS/Google\ Chrome\ Dev --remote-debugging-port=9222 --user-data-dir="CHROME_USER_DATA_DIR"
- Chrome DevTools MCP server enabled in Cursor
- MetaMask extension installed and unlocked. Ask user to provider the existing notification popup of metamask extension. For example, chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn/notification.html#/

## Quick Start Workflow

```
1. Discover Chrome debug targets via curl
2. List/select pages with MCP tools
3. Navigate, snapshot, interact
4. For MetaMask: open notification popup, approve via evaluate_script
```

## Chrome DevTools MCP Tools Reference

https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md

### MetaMask Interaction: Opening the Notification Popup

After triggering a MetaMask action (connect, sign, approve), open:

```
chrome-extension://<ExtensionId>/notification.html
```

Use `new_page` MCP tool:

```json
{
  "url": "chrome-extension://<ExtensionId>/notification.html"
}
```

Keep this tab open for reuse across interactions. For subsequent MetaMask
interactions, `select_page` to the existing notification tab and `navigate_page`
with reload rather than creating new tabs.

### LavaMoat Workaround (Critical)

MetaMask uses LavaMoat security which blocks the MCP `click` tool on MetaMask
pages. **Always use `evaluate_script` for MetaMask button clicks:**

```json
{
  "function": "() => { const buttons = document.querySelectorAll('button'); const target = Array.from(buttons).find(b => b.textContent.trim() === 'Connect'); if (target) { target.click(); return 'Clicked'; } return 'Not found'; }"
}
```

Common button texts to target:

| Action              | Button Text                       |
| ------------------- | --------------------------------- |
| Connect wallet      | `"Connect"`                       |
| Sign message        | `"Sign"`                          |
| Confirm transaction | `"Confirm"`                       |
| Reject              | `"Reject"`                        |
| Approve spending    | `"Approve"`                       |
| Switch network      | `"Switch network"` or `"Approve"` |
| Cancel              | `"Cancel"`                        |
| Next (multi-step)   | `"Next"`                          |

### Verifying MetaMask State

After clicking a MetaMask button, wait 2 seconds then verify:

```bash
# Check if notification popup closed (action completed)
curl -s http://127.0.0.1:9222/json | python3 -c "
import json,sys
data = json.load(sys.stdin)
notifications = [d for d in data if 'notification' in d.get('url','')]
print(f'Open notifications: {len(notifications)}')
"
```

## PancakeSwap Wallet Connection Flow

### Step-by-Step

1. Navigate to target page (e.g., `https://pancakeswap.finance`)
2. Take snapshot, find "Connect Wallet" button, click it
3. In the wallet modal, click "Metamask"
4. When chain selection appears, click "Connect" next to "EVM"
5. Wait ~2 seconds for MetaMask notification popup
6. Open/select the MetaMask notification page
7. Use `evaluate_script` to click "Connect" (LavaMoat workaround)
8. Switch back to PancakeSwap page
9. Verify wallet address appears in the navigation bar (replaces "Connect Wallet")

### Verifying Connection

After connecting, the nav bar snapshot should contain a truncated address like
`0x...25A4` instead of the "Connect Wallet" button. The URL may also update to
include `?chain=bsc`.

### Transaction Approval in MetaMask

When PancakeSwap triggers a transaction:

1. Wait 2-3 seconds after the action
2. Check for notification popup via `curl`
3. Select the MetaMask notification page
4. Take snapshot to verify transaction details
5. Use `evaluate_script` to click "Confirm"
6. Switch back to PancakeSwap page
7. Verify success state

## Tips

- **Always snapshot before clicking** — UIDs change between snapshots
- **Prefer `take_snapshot` over `take_screenshot`** — snapshots provide UIDs for interaction
- **Use `take_screenshot` for visual verification** — when you need to see exact layout
- **Close the wallet modal** with `press_key` Escape if it stays open after connection
- **Wait between MetaMask actions** — `sleep 2` between trigger and popup check
- **MetaMask notification page can be reused** — don't create new tabs each time
