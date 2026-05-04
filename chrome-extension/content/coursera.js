// ============================================
// Coursera Content Script
// Detects video completions and quiz passes
// ============================================

(function () {
  'use strict';

  function getCourseInfo() {
    // Extract from URL: /learn/{course-slug}/
    const match = location.pathname.match(/\/learn\/([^/]+)/);
    const courseSlug = match ? match[1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Unknown Course';

    // Try to get lecture/module title
    const titleEl = document.querySelector(
      'h1[class*="title"], .rc-NavItems h3, [data-testid="lecture-title"]'
    );
    const lectureTitle = titleEl ? titleEl.innerText.trim() : '';

    return { courseSlug, lectureTitle };
  }

  let isProcessing = false;

  async function pushCourseraEvent(type, detail) {
    if (isProcessing) return;
    isProcessing = true;
    const storageKey = `pushed_coursera_${type}_${detail.replace(/[^a-z0-9]/gi, '_')}`;
    
    // Check if already pushed
    const data = await new Promise(r => chrome.storage.local.get([storageKey], r));
    if (data[storageKey]) return;

    const { courseSlug, lectureTitle } = getCourseInfo();
    let message;

    if (type === 'video') {
      message = lectureTitle
        ? `Watched: "${lectureTitle}" — ${courseSlug}`
        : `Completed video in ${courseSlug}`;
    } else if (type === 'quiz') {
      message = `Passed quiz in ${courseSlug}`;
    } else if (type === 'week') {
      message = `Completed week in ${courseSlug}`;
    }

    chrome.runtime.sendMessage({
      type: 'PUSH_PROGRESS',
      payload: {
        platform: 'Coursera',
        message,
        eventType: 'coursera_viewed'
      }
    }, (res) => {
      if (res && res.ok) {
        chrome.storage.local.set({ [storageKey]: Date.now() });
        console.log('[ProgressPush] Coursera event logged:', message);
      }
      setTimeout(() => { isProcessing = false; }, 5000);
    });
  }

  // 1. Watch for video completion (Coursera marks video items as "complete")
  const observer = new MutationObserver(() => {
    // Video completed checkmark
    const completedItems = document.querySelectorAll(
      '[data-track-component="item_nav"] .check-icon, .rc-WeekView .check'
    );
    completedItems.forEach(el => {
      const parent = el.closest('[href]') || el.closest('li');
      const label = parent ? (parent.innerText || '').split('\n')[0].trim() : 'lecture';
      if (label) pushCourseraEvent('video', label);
    });

    // Quiz passed
    const passMsg = document.querySelector(
      '.rc-GradeNotification--passed, [data-testid="passing-grade"]'
    );
    if (passMsg) pushCourseraEvent('quiz', location.href);

    // Week completion badge
    const weekDone = document.querySelector('.rc-WeekCompletionBar--complete');
    if (weekDone) pushCourseraEvent('week', location.href);
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // 2. Watch for XHR/fetch calls that Coursera makes on progress updates
  //    (Intercept the progress API call)
  const originalFetch = window.fetch;
  window.fetch = function (url, opts) {
    if (typeof url === 'string' && url.includes('/api/ondemand.item.progress')) {
      originalFetch.apply(this, arguments).then(async (res) => {
        const clone = res.clone();
        const data = await clone.json().catch(() => null);
        if (data && data.elements && data.elements[0]?.completedAt) {
          pushCourseraEvent('video', url);
        }
        return res;
      });
    }
    return originalFetch.apply(this, arguments);
  };
})();
