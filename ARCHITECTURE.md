# Architecture

This document describes the internal design and data flow of Progress Push.

---

## System Overview

Progress Push is a browser extension built on **Manifest V3** that bridges learning platforms with GitHub's contribution graph. It consists of three layers:

```
+---------------------+     +------------------------+     +------------------+
|   Content Scripts    | --> | Background Service     | --> | GitHub API       |
|   (Platform Detect)  |     | Worker (Orchestrator)  |     | (Commits)        |
+---------------------+     +------------------------+     +------------------+
        ^                            ^                              |
        |                            |                              v
  DOM Mutations               chrome.storage              GitHub Actions
  URL Changes                 Dedup Logic                 log-progress.yml
  Video Events                Notifications               Daily Logs
```

---

## Component Breakdown

### 1. Content Scripts (`content/`)

Each supported platform has a dedicated content script injected into matching URLs. These scripts are responsible for **detection only** -- they never interact with the GitHub API directly.

#### `leetcode.js`

- **Injection**: `https://leetcode.com/*`
- **Detection**: MutationObserver watching for `[data-e2e-locator="submission-result"]` with "Accepted" text, `.success__3Ai7` elements, and `.status-accepted` on submission detail pages
- **SPA Handling**: Secondary MutationObserver tracks URL changes and rechecks after 1500ms delay
- **Debounce**: Session-level lock via `lastPushedProblemId` + 24-hour persistent lock via `chrome.storage.local`

#### `coursera.js`

- **Injection**: `https://www.coursera.org/*`
- **Detection**:
  - Video completion: Watches for new `.rc-NavItem.completed` and `.check-icon` elements in the sidebar
  - Quiz pass: Looks for `.rc-GradeNotification--passed` and `[data-testid="passing-grade"]`
  - Course completion: Regex match against body text for graduation phrases
  - Video ended: Checks `video.ended` property on `<video>` elements
- **Reload Protection**: `syncInitialState()` snapshots all completed items on page load into a Set, preventing false triggers on refresh
- **Debounce**: 24-hour persistent lock per activity

#### `duolingo.js`

- **Injection**: `https://*.duolingo.com/*`
- **Detection**:
  - Lesson complete: Watches for `[data-test="lesson-complete"]`, `[data-test="xp-summary"]`, and related test attributes
  - Text matching: Scans for "Lesson Complete", "Great job", "XP earned" and Arabic equivalents
  - Session exit: Interval-based URL monitoring detects navigation away from `/session`
- **Debounce**: 30-second session lock + 5-minute persistent lock per language

---

### 2. Background Service Worker (`background.js`)

The central orchestrator. Handles all communication between content scripts and GitHub.

**Responsibilities:**

| Function | Purpose |
|---|---|
| `getConfig()` | Reads GitHub credentials from `chrome.storage.sync` |
| `pushToGitHub()` | Sends `repository_dispatch` event to GitHub API |
| `setupRepo()` | Creates the `.github/workflows/log-progress.yml` file via GitHub Contents API |
| Message Listener | Routes `PUSH_PROGRESS`, `MANUAL_PUSH`, and `SETUP_REPO` messages |

**Duplicate Prevention:**

The background worker performs a final deduplication check before pushing. If the last history entry matches the incoming event (same platform + message within 10 minutes), the push is silently skipped.

**Notification Flow:**

On successful push, a browser notification is displayed:
```
Title: "Progress logged!"
Body:  "LeetCode: Solved: Two Sum (Easy)"
```

---

### 3. Popup UI (`popup.html` + `popup.js`)

The user-facing interface with three tabs:

#### History Tab
- Displays the last 15 activity entries from `chrome.storage.local`
- Shows platform name, activity message, and relative timestamp
- Auto-refreshes on popup open

#### Manual Tab
- Platform selection via interactive cards
- Automated platforms (LeetCode, Coursera, Duolingo) display an "Automated" badge
- Custom platforms appear without the badge
- Activity description textarea with push button

#### Settings Tab
- GitHub token, owner, and repository configuration
- Token field includes a direct link to GitHub token generation page
- Permission requirements clearly listed (Contents R/W, Actions R/W, Workflows R/W)
- Custom platform management with add/remove functionality
- Init Repository button for one-click workflow deployment
- Test Connection button for validation

---

### 4. GitHub Action (`log-progress.yml`)

Triggered by `repository_dispatch` events. Creates structured daily log files.

**Event Types:**

| Event Type | Source |
|---|---|
| `leetcode_solved` | LeetCode content script |
| `coursera_viewed` | Coursera content script |
| `duolingo_lesson` | Duolingo content script |
| `custom_progress` | Manual push or custom platforms |

**Output Structure:**

```
logs/2026-05-05.md:
  ## 2026-05-05 14:30 UTC
  **Platform:** LeetCode
  **Activity:** Solved: Two Sum (Easy)
```

The workflow also auto-updates the repository README with the latest activity and links to recent log files.

---

## Data Flow Diagram

```
User completes activity on platform
            |
            v
Content Script detects via MutationObserver
            |
            v
chrome.runtime.sendMessage({ type: 'PUSH_PROGRESS', payload })
            |
            v
Background Worker receives message
            |
            +-- Check: Is config valid? (token, owner, repo)
            |       No --> return { ok: false, error: 'not_configured' }
            |
            +-- Check: Is this a duplicate? (history dedup)
            |       Yes --> skip silently
            |
            v
POST https://api.github.com/repos/{owner}/{repo}/dispatches
    Headers: Authorization: Bearer {token}
    Body: { event_type, client_payload: { platform, message } }
            |
            v
GitHub receives repository_dispatch event
            |
            v
GitHub Action (log-progress.yml) triggers
            |
            +-- Checkout repository
            +-- Append to logs/{date}.md
            +-- Update README.md
            +-- Commit and push
            |
            v
New commit appears on contribution graph
```

---

## Storage Schema

### `chrome.storage.sync` (Encrypted, synced across devices)

| Key | Type | Purpose |
|---|---|---|
| `github_token` | string | Fine-grained personal access token |
| `github_owner` | string | GitHub username |
| `github_repo` | string | Target repository name |
| `custom_platforms` | string[] | User-defined platform names |

### `chrome.storage.local` (Device-local, not synced)

| Key | Type | Purpose |
|---|---|---|
| `history` | object[] | Last 100 activity entries (platform, message, timestamp) |
| `pushed_leetcode_{name}` | number | Timestamp of last push for a LeetCode problem |
| `pushed_coursera_{type}_{detail}` | number | Timestamp of last push for a Coursera activity |
| `pushed_duolingo_{language}` | number | Timestamp of last push for a Duolingo language |

---

## Security Model

1. **Token Isolation**: The GitHub token is stored in `chrome.storage.sync`, which is encrypted at rest and inaccessible to web pages
2. **Content Script Isolation**: Content scripts cannot access the token. They send messages to the background worker, which handles all API calls
3. **Minimal Permissions**: The extension requests only `storage`, `notifications`, and `scripting`
4. **Host Permissions**: Limited to `leetcode.com`, `coursera.org`, `*.duolingo.com`, and `api.github.com`
5. **No Remote Code**: All logic runs locally. No external scripts are loaded at runtime
