// ============================================
// YouTube Content Script
// Tracks video watching from user-selected tech channels
// Logs at 70% watch threshold
// Channel name is prominent in commit message
// ============================================

(function () {
  'use strict';
  console.log('[ProgressPush] YouTube script loaded');

  let trackedChannels = [];
  let currentVideoId = null;
  let hasLoggedCurrent = false;
  let isProcessing = false;
  let progressInterval = null;

  // Load tracked channels from storage
  function loadTrackedChannels() {
    return new Promise(resolve => {
      chrome.storage.sync.get({ youtube_channels: [] }, (data) => {
        trackedChannels = data.youtube_channels.map(ch => ch.toLowerCase().replace(/^@/, ''));
        console.log('[ProgressPush] Tracked YouTube channels:', trackedChannels);
        resolve();
      });
    });
  }

  // Listen for storage changes (user adds/removes channels in popup)
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.youtube_channels) {
      trackedChannels = (changes.youtube_channels.newValue || []).map(ch => ch.toLowerCase().replace(/^@/, ''));
      console.log('[ProgressPush] YouTube channels updated:', trackedChannels);
    }
  });

  function getChannelHandle() {
    // Try multiple selectors for the channel name/handle
    const selectors = [
      'ytd-channel-name a.yt-simple-endpoint',
      '#channel-name a',
      '#owner #channel-name a',
      'ytd-video-owner-renderer a.yt-simple-endpoint',
      '#top-row ytd-channel-name a'
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        // Try to get the @handle from the href
        const href = el.getAttribute('href') || '';
        const handleMatch = href.match(/\/@([^/]+)/);
        if (handleMatch) return handleMatch[1].toLowerCase();

        // Fallback to the text content
        return el.innerText.trim().toLowerCase();
      }
    }
    return null;
  }

  function getChannelDisplayName() {
    const selectors = [
      'ytd-channel-name a.yt-simple-endpoint',
      '#channel-name a',
      '#owner #channel-name a'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el.innerText.trim();
    }
    return 'Unknown Channel';
  }

  function getVideoTitle() {
    const titleEl = document.querySelector(
      'h1.ytd-watch-metadata yt-formatted-string, h1.ytd-video-primary-info-renderer, #title h1'
    );
    return titleEl ? titleEl.innerText.trim() : document.title.replace(' - YouTube', '').trim();
  }

  function getVideoId() {
    const params = new URLSearchParams(location.search);
    return params.get('v') || '';
  }

  function isChannelTracked(channelHandle) {
    if (!channelHandle || trackedChannels.length === 0) return false;
    return trackedChannels.some(tracked =>
      channelHandle.includes(tracked) || tracked.includes(channelHandle)
    );
  }

  async function pushYouTubeEvent(videoTitle, channelName) {
    if (isProcessing) return;

    isProcessing = true;
    const videoId = getVideoId();
    const storageKey = `pushed_youtube_${videoId}`;

    try {
      const data = await new Promise(r => chrome.storage.local.get([storageKey], r));
      if (data[storageKey] && (Date.now() - data[storageKey] < 5 * 60 * 1000)) {
        console.log('[ProgressPush] YouTube video already pushed recently:', videoTitle);
        isProcessing = false;
        return;
      }

      // Channel name is PROMINENT in the commit message to discourage gaming
      const message = `[${channelName}] Watched: "${videoTitle}"`;

      chrome.runtime.sendMessage({
        type: 'PUSH_PROGRESS',
        payload: {
          platform: 'YouTube',
          message,
          eventType: 'youtube_watched'
        }
      }, (res) => {
        isProcessing = false;
        if (res && res.ok) {
          chrome.storage.local.set({ [storageKey]: Date.now() });
          console.log('[ProgressPush] YouTube video logged:', message);
        } else {
          console.warn('[ProgressPush] Push failed:', res ? res.error : 'Unknown error');
        }
      });
    } catch (e) {
      isProcessing = false;
    }
  }

  function startWatchingProgress() {
    // Clear any existing interval
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }

    const videoId = getVideoId();
    if (!videoId || videoId === currentVideoId) return;

    currentVideoId = videoId;
    hasLoggedCurrent = false;

    // Wait for the channel info to load
    setTimeout(() => {
      const channelHandle = getChannelHandle();
      console.log('[ProgressPush] Current channel handle:', channelHandle);

      if (!isChannelTracked(channelHandle)) {
        console.log('[ProgressPush] Channel not tracked, skipping');
        return;
      }

      console.log('[ProgressPush] Channel IS tracked, monitoring video progress');

      // Monitor video progress every 5 seconds
      progressInterval = setInterval(() => {
        if (hasLoggedCurrent) {
          clearInterval(progressInterval);
          progressInterval = null;
          return;
        }

        const video = document.querySelector('video');
        if (!video || !video.duration || video.duration === 0) return;

        const progress = video.currentTime / video.duration;

        if (progress >= 0.70) {
          hasLoggedCurrent = true;
          clearInterval(progressInterval);
          progressInterval = null;

          const videoTitle = getVideoTitle();
          const channelName = getChannelDisplayName();
          console.log(`[ProgressPush] 70% reached! Logging: ${videoTitle} by ${channelName}`);
          pushYouTubeEvent(videoTitle, channelName);
        }
      }, 5000);
    }, 3000); // Wait 3 seconds for channel info to render
  }

  // Watch for URL changes (YouTube is an SPA)
  let lastUrl = location.href;
  const urlObserver = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      if (location.pathname === '/watch') {
        console.log('[ProgressPush] New video detected, starting progress watch');
        startWatchingProgress();
      }
    }
  });

  // Initialize
  loadTrackedChannels().then(() => {
    urlObserver.observe(document, { subtree: true, childList: true });

    // If already on a watch page
    if (location.pathname === '/watch') {
      startWatchingProgress();
    }
  });
})();
