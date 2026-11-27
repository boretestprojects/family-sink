# Working on Family Sink

- `custom_components/family_sink` is the tree installed by Home Assistant. Place frontend source in `frontend` and update the packaged assets with `npm run build`.
- Use the Home Assistant Oral-B registries and state machine for toothbrush data. Keep the 30-second pause and 20-second recording floor. Use stable profile IDs and Home Assistant storage.
- Preserve the default scoring behavior documented in `GAME_RULES.md`. Update Bulgarian, English and Lithuanian translations together.
- Keep real toothbrush identifiers, photos, logs, hosts and credentials out of fixtures and release files. Use synthetic profiles and sessions in tests.
- Run `python -m pytest`, `npm test`, `npm run check:build` and `npm run test:browser` before releasing. Test with a disposable Home Assistant instance or wait for explicit authorization to use a live installation.
- Commit as Padezhki Lab with the GitHub noreply identity `242699205+boretestprojects@users.noreply.github.com`, as both author and committer. Do not add AI co-author trailers such as `Co-Authored-By: Claude ...` or other automatic AI attribution to commits or pull requests.
