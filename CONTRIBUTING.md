# Contributing to Family Sink

Family Sink is developed by Padezhki Lab. Contributions are welcome, whether they make setup easier, improve a translation or fix a bug in the dashboard.

## Report an issue

Search the open issues first. Include the Family Sink and Home Assistant Core versions, the setup or screen involved, what you expected, and what you saw. For an Oral-B issue, say which sensor types are present and whether the state and duration update in Home Assistant. Reproduce with fictional participants or redact personal names, entity identifiers, addresses and tokens before attaching anything. [GitHub Issues](https://github.com/boretestprojects/family-sink/issues)

Use the [security policy](SECURITY.md) for vulnerabilities.

## Set up a development copy

Use Node.js 22 or newer and Python 3.14. The Python suite runs against a temporary Home Assistant configuration. The browser suite uses a loopback fixture and synthetic sensor data.

```sh
npm ci
npm run build
npm run check:build
npm test
npx playwright install chromium
npm run test:browser
python -m pip install -r requirements-test.txt
python -m pytest
```

For the supported Home Assistant test matrix and clean Linux dependencies, see the [validation workflow](.github/workflows/validate.yml). For manual visual exploration, run `node tests/serve-panel.mjs` and open `http://127.0.0.1:4173/?release-demo&admin`. The fixture loads the same frontend bundle that ships with the release.

## Submit a change

- Keep changes focused and explain whose workflow they improve.
- Keep duration thresholds, day boundaries and awards aligned with the [game rules](GAME_RULES.md). Update those rules when an approved change affects scoring.
- Update English, Bulgarian and Lithuanian together for visible UI text.
- After editing the frontend, run `npm run build` and include the resulting files in `custom_components/family_sink/frontend` and the build hash in `_version.py`.
- Include regression coverage for user-visible behavior and use synthetic data in every fixture. By submitting a contribution, you agree to distribute it under the [project license](LICENSE).

## Refresh screenshots

Rebuild the panel and run `node scripts/capture-release.mjs` after installing Chromium. The script captures the shipping panel with a generated household. See the [asset notes](docs/assets/README.md) for recreating the animation and badges.
