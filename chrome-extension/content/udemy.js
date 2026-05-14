// ============================================
// Udemy Content Script (v4 DEBUG)
// ============================================

(function () {
  'use strict';
  const isIframe = window.self !== window.top;
  console.log(`%c[ProgressPush] Udemy DEBUG v4 loaded | Frame: ${isIframe ? 'Iframe' : 'Main'} | URL: ${location.href}`, 'color: #00ff00; font-weight: bold;');

  function getCourseName() {
    try {
      if (isIframe && window.top.document.title) {
        return window.top.document.title.split('|')[0].split('-')[0].trim();
      }
    } catch (e) {}
    const el = document.querySelector('[data-purpose="course-header-title"], .header--course-title--29082');
    return el ? el.innerText.trim() : 'Udemy Course';
  }

  function getLectureTitle() {
    const selectors = [
      '[data-purpose="lesson-title"]',
      '[data-purpose="curriculum-item-title"] span',
      '.lecture-title-text',
      'h1[data-purpose="video-title"]',
      '.curriculum-item--is-current--3T7_6 [data-purpose="curriculum-item-title"]'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText.trim()) return el.innerText.trim();
    }
    return document.title.split('|')[0].trim();
  }

  const trackedLectures = new Set();
  let isProcessing = false;

  async function pushUdemyEvent(lectureTitle, source = 'unknown') {
    if (isProcessing || !lectureTitle || lectureTitle.length < 3) return;
    
    const normalizedTitle = lectureTitle.trim();
    if (trackedLectures.has(normalizedTitle)) return;

    console.log(`[ProgressPush] Detected potential completion: "${normalizedTitle}" via ${source}`);

    isProcessing = true;
    const storageKey = `pushed_udemy_${normalizedTitle.replace(/[^a-z0-9]/gi, '_')}`;

    try {
      const data = await new Promise(r => chrome.storage.local.get([storageKey], r));
      if (data[storageKey] && (Date.now() - data[storageKey] < 24 * 60 * 60 * 1000)) {
        console.log(`[ProgressPush] Already pushed "${normalizedTitle}" in the last 24h. Skipping.`);
        trackedLectures.add(normalizedTitle);
        isProcessing = false;
        return;
      }

      const courseName = getCourseName();
      const message = `Completed: "${normalizedTitle}" — ${courseName}`;
      console.log(`[ProgressPush] SENDING MESSAGE to background...`);

      chrome.runtime.sendMessage({
        type: 'PUSH_PROGRESS',
        payload: { platform: 'Udemy', message, eventType: 'udemy_completed' }
      }, (res) => {
        if (chrome.runtime.lastError) {
          console.error('[ProgressPush] Message error:', chrome.runtime.lastError.message);
          isProcessing = false;
          return;
        }
        
        isProcessing = false;
        if (res && res.ok) {
          trackedLectures.add(normalizedTitle);
          chrome.storage.local.set({ [storageKey]: Date.now() });
          console.log('%c[ProgressPush] SUCCESS: Progress logged to GitHub!', 'color: #00ff00; font-size: 14px;');
        } else {
          console.warn('[ProgressPush] Background failed to log:', res?.error);
        }
      });
    } catch (e) {
      console.error('[ProgressPush] Processing error:', e);
      isProcessing = false;
    }
  }

  // Monitor loop
  const check = () => {
    // 1. Video Check
    const video = document.querySelector('video');
    if (video) {
      if (!video.dataset.ppTracked) {
        video.dataset.ppTracked = 'true';
        console.log('[ProgressPush] Video element found and tracking.');
      }
      
      if (video.duration > 0) {
        const progress = video.currentTime / video.duration;
        if (video.ended || progress > 0.85) {
          const title = getLectureTitle();
          if (title) pushUdemyEvent(title, video.ended ? 'video_ended' : 'video_progress_85');
        }
      }
    }

    // 2. Sidebar Check
    if (!isIframe) {
      const currentItem = document.querySelector('[class*="curriculum-item--is-current"]');
      if (currentItem) {
        const isCompleted = currentItem.querySelector('[aria-checked="true"]') || currentItem.classList.contains('curriculum-item-link--is-completed');
        if (isCompleted) {
          const title = getLectureTitle();
          if (title) pushUdemyEvent(title, 'sidebar_check_polling');
        }
      }
    }
  };

  // Run check every 2 seconds
  const interval = setInterval(check, 2000);

  // Clean up if script is re-injected
  window.addEventListener('unload', () => clearInterval(interval));

  console.log('[ProgressPush] Polling started (2s interval)');
})();
