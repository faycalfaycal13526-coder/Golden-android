# Golden Store — Capacitor Android App Plan

## Goal
Wrap the existing Vercel web store (`https://goldenstore.vercel.app`) into a fully-functional native Android app that:
- Loads the remote store in a Capacitor WebView shell (smallest possible APK).
- Blocks pinch/zoom and long-press text selection to feel like a native app.
- Downloads APKs and triggers Android install with progress.
- Receives Firebase Cloud Messaging push notifications with the store/app logo.
- Uses the existing web-side native hooks (`window.GSAndroid`, `window.__gsRegisterPushToken`).

## Architecture
- **Capacitor 6 + Android platform**.
- **Remote server URL**: `server.url = https://goldenstore.vercel.app` with `allowNavigation` for store + OAuth/Firebase domains.
- **CapacitorHttp enabled** so the web app calls the Vercel API natively, bypassing CORS.
- **Custom JavaScript interface (`GSAndroid`)** added to the WebView for the install bridge.
- **Custom `FirebaseMessagingService`** to render rich notifications from the data payloads sent by the server.
- **Minimal `www/` stub** so the APK stays tiny; real UI is served from Vercel.

## Work Division

### Agent 1 — Project Skeleton & Capacitor Config
- Capacitor `capacitor.config.json`: appId `com.goldenstore.app`, server URL, `CapacitorHttp`, `apiBase`.
- Create `www/index.html` loading stub.
- Commit/push baseline to `goldenstore-native`.
- Run `cap add android` and verify the generated Android project.

### Agent 2 — WebView Shell & MainActivity
- Customize `MainActivity.java`:
  - Append `GoldenStoreApp` to the WebView user agent.
  - Disable zoom controls and pinch zoom.
  - Add the `GSAndroid` JavaScript interface object to the WebView.
  - Handle hardware back button to go back/exit.
  - Request `POST_NOTIFICATIONS` on Android 13+.
- Forward any pending FCM token to the JS layer once a page loads.
- Keep text selection disabled globally, but allow it on inputs/textareas via CSS already in the web app.

### Agent 3 — APK Download & Install Bridge
- Implement `GSAndroid.java` JavaScript interface:
  - `downloadApk(url, filename, slug, packageName)` starts a background download.
  - Uses `HttpURLConnection` with redirect following and writes to `getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)`.
  - Reports progress to `window.__gsApkDownloadUpdate(slug, 'downloading', progress)`.
  - On complete: `downloaded`, `installing`, then opens an `Intent.ACTION_VIEW` install intent through a `FileProvider`.
  - On failure: `failed`.
- Request `REQUEST_INSTALL_PACKAGES` at runtime; if not granted, open `Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES` and retry.
- Add `FileProvider` paths in `file_paths.xml` and AndroidManifest.
- Register a `BroadcastReceiver` for `ACTION_PACKAGE_ADDED`/`ACTION_PACKAGE_REPLACED` so the web UI is notified when the APK is actually installed.

### Agent 4 — Push Notifications (FCM)
- Copy `google-services.json` into `android/app/`.
- Apply `com.google.gms.google-services` plugin and `firebase-messaging` dependency in `build.gradle`.
- Implement `GoldenFirebaseMessagingService.java` extending `FirebaseMessagingService`:
  - `onNewToken`: store token and call `window.__gsRegisterPushToken(token)` once the WebView is ready.
  - `onMessageReceived`: build a system notification from data keys `title`, `body`, `type`, `app_slug`, `image`, `store_logo`.
  - Download the image (OkHttp or `HttpURLConnection`) for the large icon, fallback to app icon, small icon to the launcher icon.
  - Tapping the notification opens `MainActivity`.
- Add notification permission logic.

### Agent 5 — Manifest, Gradle, Icons & Size Optimization
- Update `AndroidManifest.xml` with required permissions (`INTERNET`, `REQUEST_INSTALL_PACKAGES`, `POST_NOTIFICATIONS`, `FOREGROUND_SERVICE`, etc.), `FileProvider`, `DownloadReceiver`, FCM service, and `MainActivity` intent filters.
- Configure `build.gradle` (app) release build: `minifyEnabled true`, `shrinkResources true`, R8/ProGuard rules to keep Capacitor, Firebase, and our JS interface classes.
- Replace default launcher icons with the Golden Store logo (generate/adapt from `images/logo.png`).
- Configure a debug/release signing keystore for the APK.
- Run `./gradlew assembleRelease` and fix any build issues.

### Agent 6 — Testing, APK Distribution & Documentation
- Create an AVD, start the emulator, install the APK with `adb`.
- Smoke test: app loads, categories/apps display, download button triggers install flow, push token registers.
- Build the release APK with size optimized.
- Create a minimal static download page (`index.html` + APK) and deploy it.
- Document build steps and branch strategy in `README.md`.

## Key Constraints
- The web app already checks `window.GSAndroid.downloadApk` and `window.__gsApkDownloadUpdate`; do not change the web app.
- `window.__gsRegisterPushToken` is the only push hook the web app exposes.
- Keep the APK as small as possible: use remote UI, shrink resources, enable minification, avoid unnecessary plugins.
- `apiBase` in `capacitor.config.json` must be `https://goldenstore.vercel.app`.
- Do not commit the real `google-services.json` with secrets; keep it in the workspace and copy at build time (it is already supplied as a session attachment).
