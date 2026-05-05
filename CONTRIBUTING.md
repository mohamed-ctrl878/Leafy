# Contributing to Progress Push

Thank you for your interest in contributing to Progress Push. This guide will help you get started.

---

## Development Setup

### Prerequisites

- Google Chrome, Microsoft Edge, or any Chromium-based browser
- A GitHub account with a test repository
- A fine-grained personal access token (see [README](README.md) for details)

### Local Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/progress-push.git
   cd progress-push
   ```

2. **Load the extension:**
   - Open `chrome://extensions`
   - Enable **Developer mode**
   - Click **Load unpacked** and select the `chrome-extension/` directory

3. **Configure:**
   - Click the extension icon
   - Go to Settings and enter your GitHub credentials
   - Use a test repository to avoid polluting your main logs

4. **Make changes:**
   - Edit files in `chrome-extension/`
   - Click the **Reload** button on `chrome://extensions` to apply changes
   - For content script changes, also refresh the target website

---

## Project Structure

```
progress-push/
  .github/workflows/       # GitHub Action workflow
  chrome-extension/
    manifest.json           # Extension manifest (V3)
    background.js           # Service worker
    popup.html              # Extension popup UI
    popup.js                # Popup logic
    content/
      leetcode.js           # LeetCode detection
      coursera.js           # Coursera detection
      duolingo.js           # Duolingo detection
  README.md                 # Project documentation
  ARCHITECTURE.md           # Technical design
  CONTRIBUTING.md           # This file
  CHANGELOG.md              # Version history
```

---

## Adding a New Platform

This is the most common type of contribution. Follow these steps:

### 1. Create the Content Script

Create a new file in `chrome-extension/content/` (e.g., `udemy.js`):

```javascript
(function () {
  'use strict';

  let lastPushedId = null;
  let isProcessing = false;

  async function pushEvent(detail) {
    if (lastPushedId === detail || isProcessing) return;
    isProcessing = true;

    const storageKey = `pushed_udemy_${detail.replace(/[^a-z0-9]/gi, '_')}`;
    const data = await new Promise(r => chrome.storage.local.get([storageKey], r));

    if (data[storageKey] && (Date.now() - data[storageKey] < 24 * 60 * 60 * 1000)) {
      lastPushedId = detail;
      isProcessing = false;
      return;
    }

    const message = `Completed: ${detail}`;

    chrome.runtime.sendMessage({
      type: 'PUSH_PROGRESS',
      payload: { platform: 'Udemy', message, eventType: 'custom_progress' }
    }, (res) => {
      isProcessing = false;
      if (res && res.ok) {
        lastPushedId = detail;
        chrome.storage.local.set({ [storageKey]: Date.now() });
      }
    });
  }

  // Add your detection logic here using MutationObserver
  const observer = new MutationObserver(() => {
    // Detect completion events specific to this platform
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
```

### 2. Register in manifest.json

Add a new entry to the `content_scripts` array:

```json
{
  "matches": ["https://www.udemy.com/*"],
  "js": ["content/udemy.js"],
  "run_at": "document_idle"
}
```

### 3. Add Host Permission

Add the platform URL to `host_permissions`:

```json
"host_permissions": [
  "https://www.udemy.com/*"
]
```

### 4. Test

- Load the extension
- Visit the platform
- Complete an activity
- Verify the commit appears in your test repository

---

## Code Guidelines

### General

- Use `'use strict'` in all content scripts
- Wrap content scripts in an IIFE to avoid global scope pollution
- Use `async/await` for storage operations
- Never use emojis or decorative icons in code, messages, or documentation

### Debouncing

Every content script must implement debouncing to prevent duplicate commits:

1. **Session lock**: In-memory variable to prevent re-triggers within the same page session
2. **Persistent lock**: `chrome.storage.local` with a time-based expiration (minimum 5 minutes, recommended 24 hours)
3. **Processing flag**: Boolean `isProcessing` to prevent concurrent pushes

### Error Handling

- Content scripts must handle `Extension context invalidated` errors gracefully
- Wrap `chrome.storage` calls in try/catch blocks
- Use safety timeouts to release processing locks if messages fail

### Naming Conventions

| Item | Convention | Example |
|---|---|---|
| Content script files | `platformname.js` (lowercase) | `leetcode.js` |
| Storage keys | `pushed_{platform}_{detail}` | `pushed_leetcode_Two_Sum` |
| Event types | `platform_action` (snake_case) | `leetcode_solved` |
| Messages | Descriptive, no emojis | `Solved: Two Sum (Easy)` |

---

## Submitting Changes

1. **Fork** the repository
2. **Create a branch**: `git checkout -b feature/add-udemy-support`
3. **Make your changes** following the guidelines above
4. **Test thoroughly**: Ensure no duplicate commits and debouncing works correctly
5. **Submit a Pull Request** with a clear description of what you changed and why

---

## Reporting Issues

When reporting a bug, please include:

- Browser name and version
- Extension version (from `manifest.json`)
- Console output (F12 -> Console on the affected page)
- Steps to reproduce
- Expected vs. actual behavior

---

## Questions?

Open a [Discussion](../../discussions) or file an [Issue](../../issues). We respond quickly.
