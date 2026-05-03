// ============================================
// LeetCode Content Script
// Detects successful problem submissions
// ============================================

(function () {
  'use strict';

  let lastPushed = null;

  function extractProblemName() {
    // LeetCode problem title selectors (may change with site updates)
    const selectors = [
      '[data-cy="question-title"]',
      '.mr-2.text-lg',
      'title'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const text = el.innerText || el.textContent;
        // Remove "- LeetCode" suffix from title tag
        return text.replace(/\s*-\s*LeetCode\s*$/, '').trim();
      }
    }
    // Fallback: extract from URL  /problems/two-sum/
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

  function onSubmissionAccepted() {
    const problemName = extractProblemName();
    const difficulty = extractDifficulty();
    const key = `${problemName}-${Date.now()}`;

    if (lastPushed === problemName) return; // debounce same problem
    lastPushed = problemName;

    const diffText = difficulty ? ` (${difficulty})` : '';
    const message = `Solved: ${problemName}${diffText}`;

    chrome.runtime.sendMessage({
      type: 'PUSH_PROGRESS',
      payload: {
        platform: 'LeetCode',
        message,
        eventType: 'leetcode_solved'
      }
    });

    console.log('[ProgressPush] LeetCode submission logged:', message);

    // Reset debounce after 5 minutes
    setTimeout(() => { lastPushed = null; }, 5 * 60 * 1000);
  }

  // Watch for the "Accepted" result in the submission panel
  // LeetCode uses a React SPA, so we use MutationObserver
  const observer = new MutationObserver(() => {
    // Check for accepted verdict indicators
    const accepted = document.querySelector(
      '[data-e2e-locator="submission-result"]'
    );
    if (accepted && /accepted/i.test(accepted.textContent)) {
      onSubmissionAccepted();
    }

    // Alternative: check for green checkmark in results area
    const successIcon = document.querySelector('.success__3Ai7');
    if (successIcon) onSubmissionAccepted();

    // URL-based: /submissions/detail/{id}/ with accepted state
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
