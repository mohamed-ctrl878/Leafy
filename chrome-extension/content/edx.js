// ============================================
// edX Content Script
// Detects course video completion & lesson progress
// ============================================

(function () {
  'use strict';
  console.log('[ProgressPush] edX script loaded');

  function getCourseInfo() {
    // Try to extract course name from breadcrumb or page title
    const breadcrumb = document.querySelector('.breadcrumb a, [aria-label="breadcrumb"] a, .course-title');
    const courseTitle = breadcrumb ? breadcrumb.innerText.trim() : '';

    // Fallback: extract from URL
    if (!courseTitle) {
      const match = location.pathname.match(/\/courses\/([^/]+\/[^/]+\/[^/]+)/);
      if (match) return match[1].replace(/\+/g, ' ');
    }

    return courseTitle || 'edX Course';
  }

  function getLessonTitle() {
    const selectors = [
      'h1.page-title',
      '.sequence-title',
      '[data-testid="unit-title"]',
      '.unit-title h2',
      'h2.hd-2'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el.innerText.trim();
    }
    return '';
  }

  const trackedCompletions = new Set();
  let isProcessing = false;

  async function pushEdxEvent(type, detail) {
    const key = `${type}-${detail}`;
    if (trackedCompletions.has(key) || isProcessing) return;

    isProcessing = true;
    const storageKey = `pushed_edx_${type}_${detail.replace(/[^a-z0-9]/gi, '_')}`;

    try {
      const data = await new Promise(r => chrome.storage.local.get([storageKey], r));
      if (data[storageKey] && (Date.now() - data[storageKey] < 24 * 60 * 60 * 1000)) {
        trackedCompletions.add(key);
        isProcessing = false;
        return;
      }

      const courseName = getCourseInfo();
      let message;
      if (type === 'video') {
        message = detail ? `Watched: "${detail}" — ${courseName}` : `Completed video in ${courseName}`;
      } else if (type === 'lesson') {
        message = `Completed lesson: "${detail}" — ${courseName}`;
      } else if (type === 'quiz') {
        message = `Passed assessment in ${courseName}`;
      }

      chrome.runtime.sendMessage({
        type: 'PUSH_PROGRESS',
        payload: { platform: 'edX', message, eventType: 'edx_completed' }
      }, (res) => {
        isProcessing = false;
        if (res && res.ok) {
          trackedCompletions.add(key);
          chrome.storage.local.set({ [storageKey]: Date.now() });
          console.log('[ProgressPush] edX event logged:', message);
        }
      });
    } catch (e) {
      isProcessing = false;
    }
  }

  // Track video completion
  function attachVideoListeners() {
    const videos = document.querySelectorAll('video');
    videos.forEach(video => {
      if (video.dataset.progressPushTracked) return;
      video.dataset.progressPushTracked = 'true';

      video.addEventListener('ended', () => {
        const lessonTitle = getLessonTitle();
        pushEdxEvent('video', lessonTitle || location.pathname);
      });
    });
  }

  // Watch for DOM changes
  const observer = new MutationObserver(() => {
    // 1. New video elements
    attachVideoListeners();

    // 2. Completion badges / checkmarks
    const completions = document.querySelectorAll(
      '.completion-badge:not([data-pp-tracked]), [data-testid="completion-icon"]:not([data-pp-tracked]), .fa-check-circle:not([data-pp-tracked])'
    );
    completions.forEach(el => {
      el.dataset.ppTracked = 'true';
      const parent = el.closest('.sequence-nav-button, .nav-item, li');
      const text = parent ? parent.innerText.trim().split('\n')[0] : '';
      if (text) pushEdxEvent('lesson', text);
    });

    // 3. Quiz/Assessment passed
    const passedEl = document.querySelector('.problem-feedback .correct, .submission-feedback .is-correct');
    if (passedEl) {
      pushEdxEvent('quiz', location.pathname);
    }
  });

  // Initial setup
  setTimeout(attachVideoListeners, 3000);
  observer.observe(document.body, { childList: true, subtree: true });
})();
