# Progress Push

> Turn your learning into visible GitHub contributions. Every problem solved, every lecture watched, every lesson completed -- automatically committed to your contribution graph.

---

## What is Progress Push?

Progress Push is a cross-browser extension that silently monitors your activity on learning platforms and converts it into real GitHub commits. Your daily grind on LeetCode, Coursera, or Duolingo becomes a permanent part of your developer profile -- no manual effort required.

**How it works:**

```
Learning Platform  -->  Chrome Extension  -->  GitHub API  -->  Commit  -->  Green Square
```

The extension fires a `repository_dispatch` event to a private GitHub repository. A GitHub Action picks it up and writes a structured commit, keeping your contribution graph active and your progress documented.

---

## Features

| Feature | Description |
|---|---|
| **Auto-Detection** | Detects completed problems, lectures, and lessons without user intervention |
| **Manual Push** | Log progress from any platform via the extension popup |
| **Custom Platforms** | Add your own platforms (Udemy, YouTube, etc.) for manual tracking |
| **Smart Debouncing** | Prevents duplicate commits using persistent storage with 24-hour expiration |
| **Auto-Setup** | One-click repository initialization with the required GitHub Action workflow |
| **Cross-Browser** | Works on Chrome, Edge, Brave, Opera, Vivaldi, and Firefox |
| **Privacy-First** | Token stored in encrypted browser storage. Data goes directly to GitHub API only |

---

## Supported Platforms

| Platform | Detection Method | Type |
|---|---|---|
| **LeetCode** | Monitors submission results for "Accepted" verdict | Automated |
| **Coursera** | Tracks video completion checkmarks and quiz pass notifications | Automated |
| **Duolingo** | Detects lesson completion screens and XP earned | Automated |
| **Custom** | User-defined platforms added via Settings | Manual |

---

## Quick Start (5 minutes)

### 1. Create a Progress Repository

1. Go to [github.com/new](https://github.com/new)
2. Name it `progress-log` (or any name you prefer)
3. Set visibility to **Private** (contributions still count on your profile)
4. Initialize with a README
5. Push to main

### 2. Generate a GitHub Token

1. Go to [GitHub Token Settings](https://github.com/settings/personal-access-tokens/new)
2. Create a **Fine-grained token** with these permissions:
   - **Repository access**: Select your `progress-log` repo only
   - **Contents**: Read and Write
   - **Actions**: Read and Write
   - **Workflows**: Read and Write
3. Copy the token immediately -- you will not see it again

### 3. Install the Extension

**Chrome / Edge / Brave:**
1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `chrome-extension/` folder from this project

**Firefox:**
1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select the `manifest.json` file inside `chrome-extension/`

### 4. Configure

1. Click the extension icon in your toolbar
2. Go to the **Settings** tab
3. Enter your **GitHub Token**, **Username**, and **Repository Name**
4. Click **Save Configuration**
5. Click **Init Repository (Auto-Setup)** to deploy the GitHub Action workflow
6. Click **Test Connection** to verify everything works

---

## Usage

### Automatic Tracking

Once configured, the extension works silently in the background:

- **LeetCode**: Solve a problem and get "Accepted" -- a commit is created automatically
- **Coursera**: Complete a video lecture or pass a quiz -- logged instantly
- **Duolingo**: Finish a lesson -- your XP and language are recorded

### Manual Push

For platforms without automated detection:

1. Click the extension icon
2. Go to the **Manual** tab
3. Select a platform (or add a custom one from Settings)
4. Describe your activity
5. Click **Push to GitHub**

### Custom Platforms

You can add any platform you use for learning:

1. Go to **Settings**
2. Scroll to **Managed Platforms**
3. Click **+ Add Custom Platform**
4. Enter the platform name (e.g., "Udemy", "YouTube", "Books")
5. The platform appears in your Manual push dropdown

---

## Commit History

Each commit creates a structured log entry in your repository:

```
LeetCode: Solved: Two Sum (Easy)
Coursera: Watched: "Introduction to ML" -- Machine Learning Specialization
Duolingo: Completed Arabic lesson (+10 XP)
YouTube: Watched: System Design Interview patterns
```

Daily logs are organized by date in the `logs/` directory:

```
progress-log/
  README.md           # Auto-updated with latest activity
  logs/
    2026-05-01.md
    2026-05-02.md
    2026-05-03.md
```

---

## Project Structure

```
progress-push/
  .github/
    workflows/
      log-progress.yml      # GitHub Action that creates commits
  chrome-extension/
    manifest.json           # Extension configuration (Manifest V3)
    background.js           # Service worker: GitHub API, dispatch events
    popup.html              # Extension UI: history, manual push, settings
    popup.js                # UI logic: tabs, platform management, push flow
    content/
      leetcode.js           # Auto-detect accepted submissions
      coursera.js           # Auto-detect video/quiz completions
      duolingo.js           # Auto-detect lesson completions
```

---

## Technical Details

### Debouncing Strategy

To prevent duplicate commits, the extension uses a multi-layer debouncing system:

| Layer | Scope | Duration | Storage |
|---|---|---|---|
| Session Lock | Per-tab | Until page refresh | In-memory variable |
| Persistent Debounce | Per-activity | 24 hours | `chrome.storage.local` |
| History Dedup | Global | 10 minutes | Background script check |

### API Flow

```
Content Script (detects activity)
       |
       v
Background Service Worker (validates + deduplicates)
       |
       v
GitHub API: POST /repos/{owner}/{repo}/dispatches
       |
       v
GitHub Action: log-progress.yml (creates commit)
```

### Browser Compatibility

| Browser | Support | Notes |
|---|---|---|
| Google Chrome | Full | Primary development target |
| Microsoft Edge | Full | Chromium-based, identical behavior |
| Brave | Full | Chromium-based |
| Opera / Opera GX | Full | Chromium-based |
| Vivaldi | Full | Chromium-based |
| Firefox | Full | Requires `about:debugging` for local loading |

---

## Troubleshooting

| Problem | Cause | Solution |
|---|---|---|
| "Repo not found" | Incorrect owner or repo name | Check spelling (case-sensitive) |
| "HTTP 422" | Missing workflow file | Click **Init Repository** in Settings |
| "HTTP 403" | Token lacks permissions | Regenerate token with Contents + Actions + Workflows R/W |
| No auto-detection | Platform updated their DOM | Use Manual push as fallback |
| Duplicate commits | Debounce expired | Normal behavior after 24 hours |
| Extension icon missing | Browser cache | Remove and re-load the extension |

---

## Privacy and Security

- **Token storage**: Your GitHub token is stored in Chrome's encrypted `sync` storage, never exposed to web pages
- **Network traffic**: Data is sent exclusively to `api.github.com` via HTTPS
- **No telemetry**: Zero analytics, tracking, or third-party services
- **Minimal permissions**: Only `storage`, `notifications`, and `scripting` are requested
- **Private repos work**: Contributions from private repositories still appear on your GitHub profile

---

## License

MIT License. See [LICENSE](LICENSE) for details.
