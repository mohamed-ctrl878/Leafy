// ============================================
// Duolingo Content Script
// Detects lesson completions
// ============================================

(function () {
  'use strict';

  let lastLesson = null;

  function getLanguage() {
    // Duolingo stores current language in the page
    const flag = document.querySelector('[data-test="skill-icon"] img, .course-switcher img');
    const alt = flag ? flag.alt : '';

    // Try to extract from URL or page title
    const title = document.title;
    const langMatch = title.match(/Learn (\w+)/i);
    return langMatch ? langMatch[1] : alt || 'Language';
  }

  function onLessonComplete() {
    const now = Date.now();
    if (lastLesson && now - lastLesson < 30000) return; // 30s debounce
    lastLesson = now;

    const language = getLanguage();
    
    // Try to get XP earned
    const xpEl = document.querySelector(
      '[data-test="xp-earned"], .e_2XOc, [class*="xpEarned"]'
    );
    const xp = xpEl ? xpEl.innerText.trim() : '';
    const xpText = xp ? ` (+${xp} XP)` : '';

    const message = `Completed ${language} lesson${xpText}`;

    chrome.runtime.sendMessage({
      type: 'PUSH_PROGRESS',
      payload: {
        platform: 'Duolingo',
        message,
        eventType: 'duolingo_lesson'
      }
    });

    console.log('[ProgressPush] Duolingo lesson logged:', message);
  }

  // Watch for lesson completion screen
  const observer = new MutationObserver(() => {
    // Duolingo shows a celebration screen after each lesson
    const celebration = document.querySelector(
      '[data-test="lesson-complete"], .VEbBC, [class*="lessonComplete"]'
    );
    if (celebration) onLessonComplete();

    // Also check for streak/XP update which fires after lesson
    const streakUpdate = document.querySelector('[data-test="streak-extended"]');
    if (streakUpdate) onLessonComplete();
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Watch for navigation to /learn after a lesson (SPA)
  let lastPath = location.pathname;
  new MutationObserver(() => {
    if (location.pathname !== lastPath) {
      const prev = lastPath;
      lastPath = location.pathname;

      // Going from /session to /learn = lesson complete
      if (prev.includes('/session') && location.pathname === '/learn') {
        setTimeout(onLessonComplete, 1000);
      }
    }
  }).observe(document, { subtree: true, childList: true });
})();
