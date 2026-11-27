# Release assets

Family Sink's screenshots are captures of the built 0.1.2 Home Assistant panel. The loopback fixture gives it fictional participants, built-in avatars and generated sensor readings and history. The image descriptions in the [README](../../README.md) identify the screens and actions shown.

- `screenshots/` contains the desktop, phone and tablet views, the live demo, profile and game settings, history and awards.
- `badges/` contains local copies of the version, compatibility, license and local-storage badges.
- The application's tooth icon lives in `custom_components/family_sink/brand/icon.png`.

After installing the development dependencies and Chromium, regenerate the gallery and GIF from the repository root.

```sh
npm run build
node scripts/capture-release.mjs --frames
python scripts/prepare_release_media.py --frames .tools/release-gif-frames
```

The media script uses Pillow. Run it without `--frames` to refresh only the badges.
