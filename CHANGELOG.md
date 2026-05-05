# Changelog

All notable changes to Progress Push are documented here.

---

## [1.0.0] - 2026-05-05

### Added

- **Automated platform detection** for LeetCode, Coursera, and Duolingo
- **LeetCode**: Detects "Accepted" submissions via DOM observation and SPA navigation monitoring
- **Coursera**: Detects video completions (sidebar checkmarks), quiz passes (grade notifications), and full course completion
- **Duolingo**: Detects lesson completions via test attributes, completion phrases, and session exit monitoring
- **Manual Push**: Push progress from any platform via the extension popup
- **Custom Platforms**: Add user-defined platforms (e.g., Udemy, YouTube) from Settings for manual tracking
- **Platform Badges**: Automated platforms display an "Automated" badge; custom platforms appear without it
- **Persistent Debouncing**: All platforms use `chrome.storage.local` to prevent duplicate commits across page refreshes (24-hour expiration for LeetCode and Coursera, 5-minute for Duolingo)
- **Session-level Locking**: In-memory locks prevent re-triggers within the same page session
- **History Deduplication**: Background worker checks the last history entry to prevent UI-driven spam (10-minute window)
- **Reload Protection (Coursera)**: `syncInitialState()` snapshots completed items on page load to avoid false triggers on refresh
- **One-click Repository Setup**: "Init Repository" button in Settings deploys the GitHub Action workflow via the Contents API
- **Test Connection**: Validates GitHub credentials and repository access from the Settings tab
- **Activity History**: Displays the last 15 activities with platform, message, and relative timestamp
- **Browser Notifications**: Shows a notification on every successful push
- **Cross-browser Support**: Compatible with Chrome, Edge, Brave, Opera, Vivaldi, and Firefox (Manifest V3 with gecko settings)
- **GitHub Token Guide**: Settings page includes permission requirements and a direct link to generate a token
- **Dark Theme UI**: GitHub-inspired dark theme with Space Grotesk and JetBrains Mono typography

### Technical

- Manifest V3 with service worker architecture
- `chrome.storage.sync` for credentials and custom platforms (encrypted, synced)
- `chrome.storage.local` for history and debounce state (device-local)
- Content scripts wrapped in IIFE with strict mode
- MutationObserver-based detection for all automated platforms
- SPA navigation handling via URL change monitoring
- Safety timeouts on processing locks to prevent deadlocks
- Comprehensive error handling for extension context invalidation

### Documentation

- `README.md`: Full setup guide, feature overview, troubleshooting table, and privacy statement
- `ARCHITECTURE.md`: System design, data flow diagrams, storage schema, and security model
- `CONTRIBUTING.md`: Development setup, platform addition guide, code guidelines, and submission process
- `CHANGELOG.md`: This file
- `LICENSE`: MIT License
