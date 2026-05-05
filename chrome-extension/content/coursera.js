(function () {
  'use strict';
  console.log('[ProgressPush] Coursera script loaded');

  function getCourseInfo() {
    const match = location.pathname.match(/\/learn\/([^/]+)/);
    const courseSlug = match ? match[1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Unknown Course';
    const titleEl = document.querySelector('h1[class*="title"], .rc-NavItems h3, [data-testid="lecture-title"], .video-name');
    const lectureTitle = titleEl ? titleEl.innerText.trim() : '';
    return { courseSlug, lectureTitle };
  }

  let lastPushedId = null;
  let isProcessing = false;

  async function pushCourseraEvent(type, detail) {
    const key = `${type}-${detail}`;
    if (lastPushedId === key || isProcessing) return;
    
    // Internal session debounce
    const now = Date.now();
    isProcessing = true;

    const storageKey = `pushed_coursera_${type}_${detail.replace(/[^a-z0-9]/gi, '_')}`;
    const data = await new Promise(r => chrome.storage.local.get([storageKey], r));
    
    if (data[storageKey] && (now - data[storageKey] < 60 * 60 * 1000)) {
      console.log('[ProgressPush] Event already pushed recently:', key);
      lastPushedId = key;
      isProcessing = false;
      return;
    }

    const { courseSlug, lectureTitle } = getCourseInfo();
    let message;
    if (type === 'video') {
      message = lectureTitle ? `Watched: "${lectureTitle}" — ${courseSlug}` : `Completed video in ${courseSlug}`;
    } else if (type === 'quiz') {
      message = `Passed quiz in ${courseSlug}`;
    } else {
      message = `Progress in ${courseSlug}`;
    }

    console.log('[ProgressPush] Sending Coursera event:', message);

    chrome.runtime.sendMessage({
      type: 'PUSH_PROGRESS',
      payload: { platform: 'Coursera', message, eventType: 'coursera_viewed' }
    }, (res) => {
      isProcessing = false;
      if (res && res.ok) {
        lastPushedId = key;
        chrome.storage.local.set({ [storageKey]: Date.now() });
        console.log('[ProgressPush] Success: Coursera event logged');
      }
    });
  }

  // Monitor the UI
  const observer = new MutationObserver(() => {
    // 1. Check for "Checkmarks" in the sidebar (Video completion)
    const checks = document.querySelectorAll('.rc-NavItem.completed, .check-icon, [aria-label*="Completed"]');
    checks.forEach(check => {
      const parent = check.closest('a') || check.closest('li');
      if (parent) {
        const text = parent.innerText.split('\n')[0].trim();
        if (text) pushCourseraEvent('video', text);
      }
    });

    // 2. Check for Quiz Success
    const bodyText = document.body.innerText;
    const isQuizPassed = /Passed|Congratulations! You passed|Grade: 100%|أحسنت|ناجح/i.test(bodyText);
    const hasPassingGrade = !!document.querySelector('.rc-GradeNotification--passed, [data-testid="passing-grade"]');

    if (isQuizPassed || hasPassingGrade) {
      console.log('[ProgressPush] Quiz completion detected');
      pushCourseraEvent('quiz', location.pathname);
    }
    
    // 3. Video element ended check
    const video = document.querySelector('video');
    if (video && video.ended) {
      pushCourseraEvent('video', location.pathname);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
