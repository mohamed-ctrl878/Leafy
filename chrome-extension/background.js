// ============================================
// Progress Push - Background Service Worker
// Handles GitHub API commits via repository_dispatch
// ============================================

async function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      ['github_token', 'github_owner', 'github_repo'],
      resolve
    );
  });
}

async function pushToGitHub({ platform, message, eventType }) {
  const config = await getConfig();

  if (!config.github_token || !config.github_owner || !config.github_repo) {
    console.warn('[ProgressPush] GitHub not configured yet');
    return { ok: false, error: 'not_configured' };
  }

  const url = `https://api.github.com/repos/${config.github_owner}/${config.github_repo}/dispatches`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.github_token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: eventType,
        client_payload: { platform, message }
      })
    });

    if (res.status === 204) {
      // Log to local history
      const entry = { platform, message, timestamp: Date.now() };
      chrome.storage.local.get({ history: [] }, ({ history }) => {
        history.unshift(entry);
        chrome.storage.local.set({ history: history.slice(0, 100) });
      });

      // Show notification
      chrome.notifications.create({
        type: 'basic',
        title: '✅ Progress logged!',
        message: `${platform}: ${message}`
      });

      return { ok: true };
    } else {
      const body = await res.text();
      console.error('[ProgressPush] GitHub error:', res.status, body);
      return { ok: false, error: `HTTP ${res.status}` };
    }
  } catch (err) {
    console.error('[ProgressPush] Fetch error:', err);
    return { ok: false, error: err.message };
  }
}

// ---- GitHub Action Template ----
const WORKFLOW_TEMPLATE = `name: Log Progress

on:
  repository_dispatch:
    types:
      - leetcode_solved
      - coursera_viewed
      - duolingo_lesson
      - custom_progress

permissions:
  contents: write

jobs:
  log:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repo
        uses: actions/checkout@v4
        with:
          token: \${{ secrets.GITHUB_TOKEN }}

      - name: Write progress log
        run: |
          PLATFORM="\${{ github.event.client_payload.platform }}"
          MESSAGE="\${{ github.event.client_payload.message }}"
          TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M UTC")
          DATE=$(date -u +"%Y-%m-%d")

          # Create daily log file
          LOG_FILE="logs/\${DATE}.md"
          mkdir -p logs

          # Append to daily log
          echo "" >> "$LOG_FILE"
          echo "## \${TIMESTAMP}" >> "$LOG_FILE"
          echo "**Platform:** \${PLATFORM}" >> "$LOG_FILE"
          echo "**Activity:** \${MESSAGE}" >> "$LOG_FILE"

          # Update README summary
          echo "# Progress Log" > README.md
          echo "" >> README.md
          echo "Last activity: **\${MESSAGE}** on **\${PLATFORM}**" >> README.md
          echo "" >> README.md
          echo "_Updated: \${TIMESTAMP}_" >> README.md
          echo "" >> README.md
          echo "## Recent Logs" >> README.md
          ls logs/ | sort -r | head -7 | while read f; do
            echo "- [\${f%.md}](logs/$f)" >> README.md
          done

      - name: Commit and push
        run: |
          git config user.name "\${{ github.actor }}"
          git config user.email "\${{ github.actor }}@users.noreply.github.com"
          git add -A
          git diff --staged --quiet || git commit -m "📊 \${{ github.event.client_payload.platform }}: \${{ github.event.client_payload.message }}"
          git push
`;

async function setupRepository() {
  const config = await getConfig();
  if (!config.github_token || !config.github_owner || !config.github_repo) {
    return { ok: false, error: 'not_configured' };
  }

  const path = '.github/workflows/log-progress.yml';
  const url = `https://api.github.com/repos/${config.github_owner}/${config.github_repo}/contents/${path}`;

  try {
    // 1. Check if file already exists
    const checkRes = await fetch(url, {
      headers: { 'Authorization': `Bearer ${config.github_token}` }
    });

    let sha = null;
    if (checkRes.ok) {
      const fileData = await checkRes.json();
      sha = fileData.sha;
    }

    // 2. Create or Update the file
    const pushRes = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${config.github_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: '📊 Setup Progress Push Workflow',
        content: btoa(unescape(encodeURIComponent(WORKFLOW_TEMPLATE))),
        sha: sha // required if updating
      })
    });

    if (pushRes.ok) {
      return { ok: true };
    } else {
      const error = await pushRes.json();
      return { ok: false, error: error.message || 'Failed to create workflow file' };
    }
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'PUSH_PROGRESS') {
    pushToGitHub(msg.payload).then(sendResponse);
    return true; // keep channel open for async
  }

  if (msg.type === 'MANUAL_PUSH') {
    pushToGitHub({
      platform: msg.payload.platform || 'manual',
      message: msg.payload.message,
      eventType: 'custom_progress'
    }).then(sendResponse);
    return true;
  }

  if (msg.type === 'SETUP_REPO') {
    setupRepository().then(sendResponse);
    return true;
  }
});
