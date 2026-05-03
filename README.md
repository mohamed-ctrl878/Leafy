# 📊 Progress Push

> Automatically log your learning activity to GitHub — so every LeetCode solve, Coursera lesson, and Duolingo session shows up on your contribution graph.

---

## How it works

```
External platform  →  Chrome Extension  →  GitHub API  →  Commit  →  Green square ✅
```

The Chrome Extension detects activity on supported platforms and fires a `repository_dispatch` event to a private GitHub repo. A GitHub Action then makes a commit — keeping your contribution graph active.

---

## Setup (10 minutes)

### Step 1 — Create the progress repo

1. Go to [github.com/new](https://github.com/new)
2. Name it `progress-log` (or anything you like)
3. Make it **Private** (or Public — your choice)
4. Initialize with a README
5. Clone it locally

### Step 2 — Add the GitHub Action

Copy the file `github-action/.github/workflows/log-progress.yml` into your `progress-log` repo at:

```
progress-log/
└── .github/
    └── workflows/
        └── log-progress.yml
```

Push to main. The Action is now ready and waiting for events.

### Step 3 — Create a Fine-grained Token

1. Go to → **GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens**
2. Click **Generate new token**
3. Set:
   - **Resource owner**: your account
   - **Repository access**: Only `progress-log`
   - **Permissions → Repository → Contents**: `Read and Write`
   - **Permissions → Repository → Actions**: `Read and Write`
4. Copy the token — you'll only see it once!

### Step 4 — Install the Chrome Extension

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `chrome-extension/` folder from this project
5. The 📊 icon appears in your toolbar

### Step 5 — Configure the Extension

1. Click the 📊 icon in your toolbar
2. Go to the **Settings** tab
3. Enter:
   - **GitHub Token**: the fine-grained token from Step 3
   - **GitHub Owner**: your GitHub username
   - **Repository Name**: `progress-log`
4. Click **Save Settings**
5. Click **Test Connection** — should show "Connected! ✓"

---

## Supported Platforms

| Platform | What triggers a commit |
|----------|----------------------|
| **LeetCode** | Problem accepted (auto-detected) |
| **Coursera** | Video/lecture completed |
| **Duolingo** | Lesson completed |
| **Any platform** | Manual push via extension popup |

---

## Manual Push

Click the extension icon → **Manual** tab → select platform → write a message → **Push to GitHub →**

Use this for:
- Books you're reading
- YouTube tutorials watched  
- Personal projects worked on
- Gym sessions, reading goals, etc.

---

## Adding More Platforms

Create a new file in `chrome-extension/content/` modeled after `leetcode.js`.

Then add it to `manifest.json` under `content_scripts`:

```json
{
  "matches": ["https://www.udemy.com/*"],
  "js": ["content/udemy.js"],
  "run_at": "document_idle"
}
```

---

## Commit Messages

Each commit looks like:

```
📊 LeetCode: Solved: Two Sum (Easy)
📊 Coursera: Watched: "Introduction to ML" — Machine Learning Specialization  
📊 Duolingo: Completed Arabic lesson (+10 XP)
📊 manual: Read: Clean Code ch.4-5
```

---

## Privacy

- Your GitHub token is stored in Chrome's encrypted `sync` storage
- The `progress-log` repo can be **private** — contributions still show on your profile
- No data is sent anywhere except directly to `api.github.com`

---

## Troubleshooting

**"Repo not found"** → Check owner/repo name spelling (case-sensitive)

**"HTTP 422"** → The Action may not be set up yet, or token lacks `Actions: Write` permission

**No auto-detection on LeetCode** → LeetCode updates their DOM — use Manual push as fallback

**Action not running** → Check Actions tab in your `progress-log` repo for errors
