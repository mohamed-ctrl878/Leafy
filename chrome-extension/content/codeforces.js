// ============================================
// Codeforces Content Script (Strict Version)
// ============================================

(function () {
  'use strict';
  console.log('[ProgressPush] Codeforces script loaded');

  let lastPushedId = null;
  let isProcessing = false;

  function getUserHandle() {
    const profileLink = document.querySelector('a[href^="/profile/"]');
    if (profileLink) {
      return profileLink.getAttribute('href').split('/').pop().toLowerCase();
    }
    return null;
  }

  function extractProblemInfo(row) {
    if (row) {
      const problemLink = row.querySelector('td a[href*="/problem/"]');
      if (problemLink) return problemLink.innerText.trim();
    }
    
    // Page title fallback
    const titleEl = document.querySelector('.problem-statement .title, #pageContent .title');
    if (titleEl) return titleEl.innerText.trim();

    return 'Unknown Problem';
  }

  async function pushCodeforcesEvent(problemName) {
    if (!problemName || problemName === 'Unknown Problem' || isProcessing) return;
    if (lastPushedId === problemName) return;

    isProcessing = true;
    const storageKey = `pushed_codeforces_${problemName.replace(/[^a-z0-9]/gi, '_')}`;

    try {
      const data = await new Promise(r => chrome.storage.local.get([storageKey], r));
      if (data[storageKey] && (Date.now() - data[storageKey] < 12 * 60 * 60 * 1000)) {
        lastPushedId = problemName;
        isProcessing = false;
        return;
      }

      const message = `Solved: ${problemName}`;
      console.log('[ProgressPush] Triggering Codeforces push:', message);

      chrome.runtime.sendMessage({
        type: 'PUSH_PROGRESS',
        payload: { platform: 'Codeforces', message, eventType: 'codeforces_solved' }
      }, (res) => {
        isProcessing = false;
        if (res && res.ok) {
          lastPushedId = problemName;
          chrome.storage.local.set({ [storageKey]: Date.now() });
        }
      });
    } catch (e) {
      isProcessing = false;
    }
  }

  // Monitor specifically for the current user's success
  const observer = new MutationObserver(() => {
    const handle = getUserHandle();
    
    // 1. Check submission tables
    const rows = document.querySelectorAll('tr[data-submission-id], tr[data-submissionid]');
    rows.forEach(row => {
      const verdict = row.querySelector('.verdict-accepted, span[submissionverdict="OK"], span.submissionVerdictWrapper');
      if (verdict) {
        if (!row.dataset.ppTracked) {
          console.log('[ProgressPush] Found accepted verdict in row. Checking handle:', handle);
          row.dataset.ppTracked = 'true';
          
          if (handle) {
            const userCell = row.querySelector('td a[href^="/profile/"]');
            if (userCell) {
               const rowHandle = userCell.getAttribute('href').split('/').pop().toLowerCase();
               console.log('[ProgressPush] Row handle is:', rowHandle);
               if (rowHandle !== handle) return;
            }
          }
          
          const problemName = extractProblemInfo(row);
          console.log('[ProgressPush] Extracted problem name:', problemName);
          if (problemName) pushCodeforcesEvent(problemName);
        }
      }
    });

    // 2. Direct problem page verdict (only if we just submitted)
    if (location.pathname.includes('/submit')) {
        const successMessage = document.querySelector('.verdict-accepted');
        if (successMessage && !successMessage.dataset.ppTracked) {
            successMessage.dataset.ppTracked = 'true';
            console.log('[ProgressPush] Found accepted verdict on submit page.');
            const probName = extractProblemInfo();
            pushCodeforcesEvent(probName);
        }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // On initial load, only sync if it's a specific submission page
  if (location.pathname.includes('/submission/')) {
    setTimeout(() => {
      const accepted = document.querySelector('.verdict-accepted');
      if (accepted) {
        const probName = extractProblemInfo();
        pushCodeforcesEvent(probName);
      }
    }, 2000);
  }
})();
