// ============================================
// LeetCode Content Script
// Detects successful problem submissions
// ============================================

(function () {
  'use strict';

  function extractProblemName() {
    const selectors = [
      '[data-cy="question-title"]',
      '.mr-2.text-lg',
      'title'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const text = el.innerText || el.textContent;
        return text.replace(/\s*-\s*LeetCode\s*$/, '').trim();
      }
    }
    const match = location.pathname.match(/\/problems\/([^/]+)/);
    if (match) return match[1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return 'Unknown Problem';
  }

  function extractDifficulty() {
    const diffEl = document.querySelector(
      '[diff],.text-difficulty-easy,.text-difficulty-medium,.text-difficulty-hard'
    );
    if (diffEl) return diffEl.innerText.trim();
    const badge = document.querySelector('.badge--ZO9qO');
    return badge ? badge.innerText.trim() : '';
  }

  let isProcessing = false;

  async function onSubmissionAccepted() {
    if (isProcessing) return;
    isProcessing = true;

    const problemName = extractProblemName();
    const storageKey = `pushed_leetcode_${problemName.replace(/\s+/g, '_')}`;
    
    // Check if recently pushed (within last 24 hours)
    const data = await new Promise(r => chrome.storage.local.get([storageKey], r));
    const lastPushedTime = data[storageKey];
    const now = Date.now();

    if (lastPushedTime && (now - lastPushedTime < 24 * 60 * 60 * 1000)) {
      console.log('[ProgressPush] Problem already pushed recently:', problemName);
      isProcessing = false;
      return;
    }

    const difficulty = extractDifficulty();
    const diffText = difficulty ? ` (${difficulty})` : '';
    const message = `Solved: ${problemName}${diffText}`;

    chrome.runtime.sendMessage({
      type: 'PUSH_PROGRESS',
      payload: {
        platform: 'LeetCode',
        message,
        eventType: 'leetcode_solved'
      }
    }, (res) => {
      if (res && res.ok) {
        chrome.storage.local.set({ [storageKey]: now });
        console.log('[ProgressPush] LeetCode submission logged:', message);
      }
      // Release lock after 5 seconds to allow for future submissions but prevent immediate noise
      setTimeout(() => { isProcessing = false; }, 5000);
    });
  }

  // Watch for the "Accepted" result in the submission panel
  const observer = new MutationObserver(() => {
    const accepted = document.querySelector('[data-e2e-locator="submission-result"]');
    if (accepted && /accepted/i.test(accepted.textContent)) {
      onSubmissionAccepted();
    }

    const successIcon = document.querySelector('.success__3Ai7');
    if (successIcon) onSubmissionAccepted();

    if (location.pathname.includes('/submissions/detail/')) {
      const verdict = document.querySelector('.status-accepted');
      if (verdict) onSubmissionAccepted();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Also watch for URL changes (SPA navigation)
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      // Give page time to render after navigation
      setTimeout(() => {
        const verdict = document.querySelector('.status-accepted, [data-e2e-locator="submission-result"]');
        if (verdict && /accepted/i.test(verdict.textContent)) {
          onSubmissionAccepted();
        }
      }, 1500);
    }
  }).observe(document, { subtree: true, childList: true });
})();
