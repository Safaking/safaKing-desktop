# Safa King — Android

The same thin shell as the Windows build: it opens `https://store.safaking.in`
and nothing else. Features and fixes reach it the moment they deploy, so a new
APK is only needed when something in this folder changes — the icon, the URL,
or the WebView behaviour.

## What is handled here

A bare WebView cannot run this app. These are the pieces that had to be added:

- **DOM storage** — the signed-in session lives in `localStorage`. Without it
  the app forgets who is logged in every time it closes.
- **File chooser** — product photos are added from the admin screen.
- **Blob downloads** — bills are generated in the browser and handed over as
  `blob:` URLs, which Android's download manager cannot fetch. The blob is read
  back inside the page and written out here, or the app could show a bill but
  never save one.
- **Desktop viewport** — the till and booking screens are laid out for a
  counter monitor. Rendering at desktop width and scaling down keeps the three
  columns intact rather than reflowing them into a phone-width strip.

## Building

Needs the Android SDK and a JDK.

```
cd android
echo "sdk.dir=$HOME/Library/Android/sdk" > local.properties
gradle assembleRelease
```

The APK lands in `app/build/outputs/apk/release/`.

Signed with the debug key, like the Windows installer: it is handed to shop
staff directly, not published to Play. Android will warn about an unknown
source on first install. **If it is ever put on Play, it needs a real signing
key — and that key must then be kept, because Android will not accept an
update signed with a different one.**
