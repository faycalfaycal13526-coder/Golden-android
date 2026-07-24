# Golden Store - تطبيق Android

Native Android wrapper for the Golden Store web app, built with **Capacitor 6**.

## Download

Get the latest signed release APK from the [Releases page](https://github.com/brahimslm158-arch/goldenstore-native/releases).

## Features

- Wrapped `https://goldenstore.vercel.app` in a native WebView.
- Blocked zoom, pinch and text selection at the native WebView level.
- Custom `GSAndroid` JavaScript bridge for APK download + install.
- `REQUEST_INSTALL_PACKAGES` flow with FileProvider for secure APK install.
- Push notifications via Firebase Cloud Messaging (`GoldenFirebaseMessagingService`).
- Token registration exposed to the web app through `window.__gsRegisterPushToken`.
- Package install completion listener to update the web UI.

## Project structure

- `capacitor.config.json` — Capacitor server URL, allowed domains, HTTP plugin.
- `android/app/src/main/java/com/goldenstore/app/`
  - `MainActivity.java` — WebView config, JS interface registration, permissions.
  - `GSAndroid.java` — Download/install bridge.
  - `GoldenFirebaseMessagingService.java` — FCM notifications.
  - `PackageChangeReceiver.java` — Detect completed installs.
- `android/app/build.gradle` — release signing, minify/shrink, `resConfigs ar,en`.

## Build

```bash
npm install
npx cap sync android
cd android
export KEYSTORE_PATH=... KEYSTORE_PASSWORD=... KEY_ALIAS=... KEY_PASSWORD=...
./gradlew assembleRelease
```

`google-services.json` is required for Firebase notifications; it is intentionally excluded from the public repo.

## Security / Legal notice

This wrapper is distributed under the commitment that the store contains only authorized, simulation/demo content and does not distribute real hacked or cracked software.
