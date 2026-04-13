# Manual Regression Checklist

Use this checklist after hot-path or state-management changes in the extension.

## Page Detection
- Digikala listing page: panel opens, visible products populate, guide numbers stay aligned.
- Digikala detail page: main product appears correctly and detail-mode behavior is preserved.
- Torob listing page: reverse comparison still loads and visible items update while scrolling.
- Torob detail page: main product still resolves and panel data stays in sync.
- One SPA-like navigation on a supported site: page context updates without stale items from the previous route.

## Interaction Modes
- Selection mode on/off: hover and focus still isolate the correct item.
- Sync-with-view on/off: active item follows the visible page item without extra stale focus jumps.
- Guide numbers on/off: page badges and panel numbering stay matched.
- Language toggle: FA/EN updates without requiring a page reload.
- Theme toggle: panel theme still cycles normally.

## Refresh Actions
- Reload all: current page items rescan and repopulate without refreshing the browser tab.
- Reload item: only the targeted item refreshes and remains locatable from the panel.
- Global search button: dedicated search tab still opens normally.

## Logging
- Debug on + auto logs on: logs continue appearing in the panel.
- Export logs: downloaded JSON still contains the current session log buffer.
- Clear logs: panel log count resets and stored logs are cleared.

## Optimization Guardrails
- On a steady supported page, repeated panel updates should not trigger repeated full listing-detection scans unless navigation or accepted DOM mutations occur.
- URL polling fallback should stop when the panel is inactive.
- Log persistence should be batched instead of writing the full log buffer on every single `addLog()` call.
