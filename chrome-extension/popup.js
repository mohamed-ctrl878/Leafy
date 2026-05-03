// popup.js

// ---- Tab switching ----
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab, .pane').forEach(el => el.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('pane-' + tab.dataset.tab).classList.add('active');
  });
});

// ---- Toast ----
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ---- Status dot ----
function setStatus(state) {
  const dot = document.getElementById('statusDot');
  dot.className = 'status-dot' + (state === 'ok' ? '' : ` ${state}`);
}

// ---- Load settings ----
chrome.storage.sync.get(['github_token', 'github_owner', 'github_repo'], (cfg) => {
  if (cfg.github_token) document.getElementById('tokenInput').value = cfg.github_token;
  if (cfg.github_owner) document.getElementById('ownerInput').value = cfg.github_owner;
  if (cfg.github_repo)  document.getElementById('repoInput').value  = cfg.github_repo;
  setStatus(cfg.github_token ? 'ok' : 'warn');
});

// ---- Save settings ----
document.getElementById('saveBtn').addEventListener('click', () => {
  const token = document.getElementById('tokenInput').value.trim();
  const owner = document.getElementById('ownerInput').value.trim();
  const repo  = document.getElementById('repoInput').value.trim();

  if (!token || !owner || !repo) {
    showToast('Please fill all fields', 'error');
    return;
  }

  chrome.storage.sync.set({ github_token: token, github_owner: owner, github_repo: repo }, () => {
    showToast('Settings saved ✓');
    setStatus('ok');
  });
});

// ---- Test connection ----
document.getElementById('testBtn').addEventListener('click', async () => {
  const btn = document.getElementById('testBtn');
  btn.disabled = true;
  btn.textContent = 'Testing...';

  const token = document.getElementById('tokenInput').value.trim();
  const owner = document.getElementById('ownerInput').value.trim();
  const repo  = document.getElementById('repoInput').value.trim();

  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }
    });

    if (res.ok) {
      showToast('Connected! Repo found ✓');
      setStatus('ok');
    } else if (res.status === 404) {
      showToast('Repo not found — check name', 'error');
      setStatus('error');
    } else {
      showToast(`Error ${res.status} — check token`, 'error');
      setStatus('error');
    }
  } catch (e) {
    showToast('Network error', 'error');
    setStatus('error');
  }

  btn.disabled = false;
  btn.textContent = 'Test Connection';
});

// ---- Manual push ----
let selectedPlatform = 'LeetCode';

document.querySelectorAll('.platform-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.platform-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedPlatform = btn.dataset.platform;
  });
});

document.getElementById('manualPushBtn').addEventListener('click', () => {
  const message = document.getElementById('manualMsg').value.trim();
  if (!message) { showToast('Enter an activity message', 'error'); return; }

  const btn = document.getElementById('manualPushBtn');
  btn.disabled = true;
  btn.textContent = 'Pushing...';

  chrome.runtime.sendMessage({
    type: 'MANUAL_PUSH',
    payload: { platform: selectedPlatform, message }
  }, (res) => {
    if (res && res.ok) {
      showToast('Pushed to GitHub! 🎉');
      document.getElementById('manualMsg').value = '';
      loadHistory();
    } else {
      const err = res ? res.error : 'Unknown error';
      if (err === 'not_configured') {
        showToast('Configure GitHub settings first', 'error');
      } else {
        showToast(`Error: ${err}`, 'error');
      }
    }
    btn.disabled = false;
    btn.textContent = 'Push to GitHub →';
  });
});

// ---- History ----
function timeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}

function loadHistory() {
  chrome.storage.local.get({ history: [] }, ({ history }) => {
    const list = document.getElementById('historyList');
    if (!history.length) {
      list.innerHTML = '<div class="empty">No activity yet.<br>Solve a problem or complete a lesson!</div>';
      return;
    }
    list.innerHTML = history.slice(0, 15).map(e => `
      <div class="history-item">
        <div class="platform">${e.platform}</div>
        <div class="msg">${e.message}</div>
        <div class="time">${timeAgo(e.timestamp)}</div>
      </div>
    `).join('');
  });
}

loadHistory();
