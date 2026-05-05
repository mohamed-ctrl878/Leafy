// ============================================
// Duolingo Content Script
// Detects lesson completions
// ============================================

(function () {
  'use strict';
  console.log('[ProgressPush] Duolingo script loaded');

  function getLanguage() {
    const flag = document.querySelector('[data-test="skill-icon"] img, .course-switcher img');
    const alt = flag ? flag.alt : '';
    const title = document.title;
    const langMatch = title.match(/Learn (\w+)/i);
    return langMatch ? langMatch[1] : alt || 'Language';
  }

  let lastPushedTimeSession = 0;
  let isProcessing = false;

  async function onLessonComplete() {
    console.log('[ProgressPush] onLessonComplete triggered');
    if (isProcessing) return;
    
    const now = Date.now();
    if (now - lastPushedTimeSession < 30000) {
      console.log('[ProgressPush] Session debounce active, skipping');
      return;
    }
    
    isProcessing = true;
    const language = getLanguage();
    const storageKey = `pushed_duolingo_${language}`;
    
    const data = await new Promise(r => chrome.storage.local.get([storageKey], r));
    const lastPushedTimeGlobal = data[storageKey];

    if (lastPushedTimeGlobal && (now - lastPushedTimeGlobal < 5 * 60 * 1000)) {
       console.log('[ProgressPush] Global debounce active (5m), skipping');
       isProcessing = false;
       return;
    }

    const xpEl = document.querySelector('[data-test="xp-earned"], .e_2XOc, [class*="xpEarned"], [class*="xp-text"]');
    const xp = xpEl ? xpEl.innerText.trim() : '';
    const message = `Completed ${language} lesson ${xp ? `(+${xp} XP)` : ''}`;

    console.log('[ProgressPush] Sending message to background:', message);

    chrome.runtime.sendMessage({
      type: 'PUSH_PROGRESS',
      payload: { platform: 'Duolingo', message, eventType: 'duolingo_lesson' }
    }, (res) => {
      isProcessing = false;
      if (res && res.ok) {
        lastPushedTimeSession = Date.now();
        chrome.storage.local.set({ [storageKey]: Date.now() });
        console.log('[ProgressPush] Success: Lesson logged');
      } else {
        console.error('[ProgressPush] Failed to log:', res ? res.error : 'Unknown');
      }
    });
  }

  // Watch for lesson completion screen
  const observer = new MutationObserver(() => {
    // 1. Check for end-of-lesson specific screens or results
    const celebration = document.querySelector(
      '[data-test="lesson-complete"], [data-test="xp-summary"], [data-test="streak-extended"], [data-test="practice-complete"], [data-test="plus-ad-video-player"]'
    );
    
    // 2. Search for common completion text in any heading or button
    const bodyText = document.body.innerText;
    const completionPhrases = [
      'Lesson Complete', 'Great job', 'Lesson finished', 'XP earned', 'Daily Goal',
      'أحسنت', 'اكتمل الدرس', 'تم إكمال الهدف', 'نقطة خبرة'
    ];
    const hasPhrase = completionPhrases.some(phrase => bodyText.includes(phrase));

    // 3. More aggressive detection: If we see "Continue" or "Next" on a page that isn't a question
    const isSession = location.pathname.includes('/session');
    const hasNextBtn = !!document.querySelector('[data-test="player-next"]');
    
    if (celebration || (hasPhrase && !isSession)) {
      console.log('[ProgressPush] Potential match found! Celebration:', !!celebration, 'Phrase:', hasPhrase);
      onLessonComplete();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Watch for navigation to /learn after a lesson (SPA)
  let lastPath = location.pathname;
  setInterval(() => {
    if (location.pathname !== lastPath) {
      const prev = lastPath;
      lastPath = location.pathname;
      console.log('[ProgressPush] URL changed from', prev, 'to', lastPath);

      if (prev.includes('/session') && !location.pathname.includes('/session')) {
        console.log('[ProgressPush] Session ended, triggering check');
        setTimeout(onLessonComplete, 2000);
      }
    }
  }, 1000);
})();
