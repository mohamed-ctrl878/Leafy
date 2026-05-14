// ============================================
// HackerRank Content Script
// Detects successful challenge submissions
// ============================================

(function () {
  'use strict';
  console.log('[ProgressPush] HackerRank script loaded');

  function extractChallengeName() {
    // Try multiple selectors for the challenge title
    const selectors = [
      '.challenge-view h2.challenge-name',
      '.community-header h1',
      '.challenge-name-label',
      'h1.page-label',
      '.hr-challenge-name h2'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el.innerText.trim();
    }
    // Fallback: extract from URL
    const match = location.pathname.match(/\/challenges\/([^/]+)/);
    if (match) return match[1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return 'Unknown Challenge';
  }

  function extractDifficulty() {
    const diffEl = document.querySelector('.difficulty-label, .challenge-list-difficulty, .sidebar-problem-difficulty');
    return diffEl ? diffEl.innerText.trim() : '';
  }

  let lastPushedId = null;
  let isProcessing = false;

  async function onSubmissionAccepted() {
    const challengeName = extractChallengeName();
    if (lastPushedId === challengeName || isProcessing) return;

    isProcessing = true;
    const storageKey = `pushed_hackerrank_${challengeName.replace(/\s+/g, '_')}`;

    try {
      const data = await new Promise(r => chrome.storage.local.get([storageKey], r));
      const lastPushedTime = data[storageKey];
      const now = Date.now();

      if (lastPushedTime && (now - lastPushedTime < 24 * 60 * 60 * 1000)) {
        console.log('[ProgressPush] HackerRank challenge already pushed recently:', challengeName);
        lastPushedId = challengeName;
        isProcessing = false;
        return;
      }

      const difficulty = extractDifficulty();
      const diffText = difficulty ? ` (${difficulty})` : '';
      const message = `Solved: ${challengeName}${diffText}`;

      const safetyTimeout = setTimeout(() => { isProcessing = false; }, 30000);

      chrome.runtime.sendMessage({
        type: 'PUSH_PROGRESS',
        payload: {
          platform: 'HackerRank',
          message,
          eventType: 'hackerrank_solved'
        }
      }, (res) => {
        clearTimeout(safetyTimeout);
        isProcessing = false;
        if (res && res.ok) {
          lastPushedId = challengeName;
          chrome.storage.local.set({ [storageKey]: now });
          console.log('[ProgressPush] HackerRank submission logged:', message);
        } else {
          console.warn('[ProgressPush] Push failed:', res ? res.error : 'Unknown error');
        }
      });
    } catch (e) {
      isProcessing = false;
    }
  }

  // Watch for submission results
  const observer = new MutationObserver(() => {
    // 1. Congratulations modal / message
    const congrats = document.querySelector(
      '.congrats-heading, .congratulations-wrapper, .challenge-submission-result .congrats, .success-msg-wrapper'
    );
    if (congrats) {
      onSubmissionAccepted();
      return;
    }

    // 2. Green checkmark / accepted status in submissions list
    const accepted = document.querySelector(
      '.submissions-list .status.accepted, .judge-status-accepted, .text-success.submission-status'
    );
    if (accepted) {
      onSubmissionAccepted();
      return;
    }

    // 3. "All test cases passed" or similar text
    const bodyText = document.body.innerText;
    if (/Congratulations|All test cases passed|Score: \d+\.\d+/i.test(bodyText)) {
      const resultArea = document.querySelector('.compile-test-result, .submission-result');
      if (resultArea && /passed|accepted|congratulations/i.test(resultArea.innerText)) {
        onSubmissionAccepted();
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
