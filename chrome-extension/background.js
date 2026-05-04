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
});
