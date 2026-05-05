(function () {
  'use strict';
  console.log('[ProgressPush] Coursera script loaded');

  const initialCompletedItems = new Set();
  let lastPushedId = null;
  let isProcessing = false;

  // Track items that were already complete when the page loaded
  function syncInitialState() {
    try {
      document.querySelectorAll('.rc-NavItem.completed, .check-icon, [aria-label*="Completed"]').forEach(check => {
        const parent = check.closest('a') || check.closest('li');
        const text = parent ? (parent.innerText || '').split('\n')[0].trim() : '';
        if (text) initialCompletedItems.add(text);
      });
      // console.log('[ProgressPush] Initial state synced');
    } catch (e) { /* Extension context might be invalidated */ }
  }

  async function pushCourseraEvent(type, detail) {
    const key = `${type}-${detail}`;
    if (lastPushedId === key || isProcessing) return;
    
    isProcessing = true;
    const storageKey = `pushed_coursera_${type}_${detail.replace(/[^a-z0-9]/gi, '_')}`;
    
    try {
      const data = await new Promise(r => chrome.storage.local.get([storageKey], r));
      // 24 hour protection
      if (data[storageKey] && (Date.now() - data[storageKey] < 24 * 60 * 60 * 1000)) {
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
      } else if (type === 'course_complete') {
        message = `Completed the entire course: ${courseSlug}!`;
      }

      chrome.runtime.sendMessage({
        type: 'PUSH_PROGRESS',
        payload: { platform: 'Coursera', message, eventType: 'coursera_viewed' }
      }, (res) => {
        isProcessing = false;
        if (res && res.ok) {
          lastPushedId = key;
          chrome.storage.local.set({ [storageKey]: Date.now() });
          console.log('[ProgressPush] Success: Coursera event logged:', message);
        }
      });
    } catch (e) { isProcessing = false; }
  }

  function getCourseInfo() {
    const match = location.pathname.match(/\/learn\/([^/]+)/);
    const courseSlug = match ? match[1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Course';
    const titleEl = document.querySelector('h1, .video-name, [data-testid="lecture-title"]');
    return { courseSlug, lectureTitle: titleEl ? titleEl.innerText.trim() : '' };
  }

  // Monitor the UI for changes
  const observer = new MutationObserver(() => {
    // 1. New Checkmarks in the sidebar
    document.querySelectorAll('.rc-NavItem.completed, .check-icon').forEach(check => {
      const parent = check.closest('a') || check.closest('li');
      const text = parent ? (parent.innerText || '').split('\n')[0].trim() : '';
      if (text && !initialCompletedItems.has(text)) {
        pushCourseraEvent('video', text);
      }
    });

    // 2. Quiz Passed - Look for the actual grade notification, not just any text
    const quizPass = document.querySelector('.rc-GradeNotification--passed, [data-testid="passing-grade"], .rc-PassFailNotification.passed');
    if (quizPass) {
      pushCourseraEvent('quiz', location.pathname);
    }
    
    // 3. Global Course Completion
    const bodyText = document.body.innerText;
    if (/Congratulations! You've completed the course|Certificate is ready|أكملت الدورة/i.test(bodyText)) {
      pushCourseraEvent('course_complete', courseSlug);
    }

    // 4. Video Element Ended
    const video = document.querySelector('video');
    if (video && video.ended) {
      const { lectureTitle } = getCourseInfo();
      pushCourseraEvent('video', lectureTitle || location.pathname);
    }
  });

  // Wait a bit for Coursera to load before syncing initial state
  setTimeout(syncInitialState, 3000);
  observer.observe(document.body, { childList: true, subtree: true });
})();
