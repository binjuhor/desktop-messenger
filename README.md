# Desktop Messenger

A small, hardened Electron wrapper that runs [messenger.com](https://www.messenger.com) as a desktop app on macOS, Windows and Linux.

## Features

- Resizable window that remembers its size, position and maximized state
- Unread count on the dock / taskbar badge (macOS, Linux Unity), dock bounce or taskbar flash on new messages
- macOS: closing the window keeps the app running in the dock (Cmd+Q quits)
- Windows: closing the window minimizes to the tray; Linux shows a tray icon with Show/Quit
- Screen sharing in calls via a native picker (screens and windows)
- Native application menu (edit shortcuts, zoom, back/forward, fullscreen) and right-click menu (spelling suggestions, copy/paste, copy link, save image)
- Desktop notifications, camera and microphone for calls
- External links open in your default browser
- Single instance: launching again focuses the existing window

## Security model

- Renderer is sandboxed with context isolation, no Node.js integration, no preload and no `<webview>`
- Top-level navigation is restricted to `https://` on `messenger.com`, `facebook.com` and `meta.com`; anything else opens in the system browser (only `http`, `https`, `mailto` are ever passed to the OS)
- Permissions are allow-listed (notifications, camera/mic, fullscreen, clipboard write) and granted only to trusted origins; device pickers (USB/HID/serial) are always denied
- DevTools are disabled in packaged builds
- Packaged builds flip Electron fuses: no `ELECTRON_RUN_AS_NODE`, no `NODE_OPTIONS`/`--inspect`, encrypted cookie store, asar integrity validation, load app only from asar
- Profile data lives in its own folder (`Desktop Messenger`), separate from Meta's official Messenger app

## Develop

Requires Node.js 22+ and npm.

```bash
git clone https://github.com/binjuhor/desktop-messenger
cd desktop-messenger
npm install
npm start        # run the app
npm test         # URL policy unit tests
```

## Build

```bash
npm run pack     # unpacked app in dist/ (quick check)
npm run dist     # installers: dmg/zip (macOS), nsis (Windows), AppImage/deb (Linux)
```

## Release

Pushing a `v*` tag (e.g. `git tag v0.2.0 && git push --tags`) runs `.github/workflows/release.yml`, which builds installers on macOS, Windows and Linux and attaches them to a **draft** GitHub release. Review and publish the draft manually. Every PR runs tests and a production dependency audit (`ci.yml`).

macOS builds use the hardened runtime with camera/microphone entitlements (`build/entitlements.mac.plist`). Unsigned builds work locally; for distribution add the repo secrets `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` and the release workflow signs and notarizes automatically (see [electron.build code signing](https://www.electron.build/code-signing)).

## License

[CC0 1.0 (Public Domain)](LICENSE.md)
