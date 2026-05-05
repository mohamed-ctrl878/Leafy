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
chrome.storage.sync.get(['github_token', 'github_owner', 'github_repo', 'custom_platforms'], (cfg) => {
  if (cfg.github_token) document.getElementById('tokenInput').value = cfg.github_token;
  if (cfg.github_owner) document.getElementById('ownerInput').value = cfg.github_owner;
  if (cfg.github_repo)  document.getElementById('repoInput').value  = cfg.github_repo;
  
  const customPlatforms = cfg.custom_platforms || [];
  renderCustomPlatforms(customPlatforms);
  setStatus(cfg.github_token ? 'ok' : 'warn');
});

// ---- Save settings ----
document.getElementById('saveConfig').addEventListener('click', () => {
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

// ---- Init repository ----
document.getElementById('initBtn').addEventListener('click', async () => {
  const btn = document.getElementById('initBtn');
  btn.disabled = true;
  btn.textContent = 'Initializing...';

  chrome.runtime.sendMessage({ type: 'SETUP_REPO' }, (res) => {
    if (res && res.ok) {
      showToast('Repository setup successfully! 🎉');
      setStatus('ok');
    } else {
      const err = res ? res.error : 'Unknown error';
      showToast(`Setup failed: ${err}`, 'error');
      setStatus('error');
    }
    btn.disabled = false;
    btn.textContent = 'Init Repository (Auto-Setup)';
  });
});

// ---- Custom Platforms Logic ----
let currentSelectedPlatform = 'LeetCode';

function renderCustomPlatforms(platforms) {
  const managementList = document.getElementById('customPlatformsList');
  const grid = document.getElementById('platformGrid');
  
  // Clear lists
  managementList.innerHTML = '';
  grid.innerHTML = '';

  const automated = [
    { id: 'LeetCode', name: 'LeetCode' },
    { id: 'Coursera', name: 'Coursera' },
    { id: 'Duolingo', name: 'Duolingo' }
  ];

  // 1. Render for Manual Tab (Grid)
  automated.forEach(p => {
    grid.appendChild(createPlatformCard(p.id, p.name, true));
  });
  platforms.forEach(p => {
    grid.appendChild(createPlatformCard(p, p, false));
  });

  // 2. Render for Settings (Management List)
  platforms.forEach(p => {
    const item = document.createElement('div');
    item.className = 'platform-card';
    item.style.cursor = 'default';
    item.innerHTML = `
      <span>${p}</span>
      <span class="badge manual">Manual</span>
      <span style="cursor:pointer; color:var(--red); font-size:18px; margin-left:10px;" data-name="${p}">×</span>
    `;
    item.querySelector('span:last-child').onclick = () => removePlatform(p);
    managementList.appendChild(item);
  });
}

function createPlatformCard(id, name, isAuto) {
  const div = document.createElement('div');
  div.className = `platform-card ${currentSelectedPlatform === id ? 'selected' : ''}`;
  div.innerHTML = `
    <span>${name}</span>
    ${isAuto ? '<span class="badge auto">Automated</span>' : ''}
  `;
  div.onclick = () => {
    currentSelectedPlatform = id;
    document.querySelectorAll('#platformGrid .platform-card').forEach(c => c.classList.remove('selected'));
    div.classList.add('selected');
  };
  return div;
}

// UI Toggles for Adding
document.getElementById('showAddInputBtn').onclick = () => {
  document.getElementById('showAddInputBtn').style.display = 'none';
  document.getElementById('addInputGroup').style.display = 'flex';
};

document.getElementById('cancelAddBtn').onclick = () => {
  document.getElementById('showAddInputBtn').style.display = 'flex';
  document.getElementById('addInputGroup').style.display = 'none';
  document.getElementById('newPlatformName').value = '';
};

async function addPlatform() {
  const input = document.getElementById('newPlatformName');
  const name = input.value.trim();
  if (!name) return;

  const data = await chrome.storage.sync.get({ custom_platforms: [] });
  if (data.custom_platforms.includes(name)) {
    showToast('Platform already exists', 'error');
    return;
  }

  const newList = [...data.custom_platforms, name];
  await chrome.storage.sync.set({ custom_platforms: newList });
  input.value = '';
  document.getElementById('cancelAddBtn').click();
  renderCustomPlatforms(newList);
  showToast('Platform added ✓');
}

async function removePlatform(name) {
  const data = await chrome.storage.sync.get({ custom_platforms: [] });
  const newList = data.custom_platforms.filter(p => p !== name);
  await chrome.storage.sync.set({ custom_platforms: newList });
  renderCustomPlatforms(newList);
}

document.getElementById('addPlatformBtn').onclick = addPlatform;

// ---- Manual push ----
document.getElementById('manualPushBtn').addEventListener('click', () => {
  const selectedPlatform = currentSelectedPlatform;
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
