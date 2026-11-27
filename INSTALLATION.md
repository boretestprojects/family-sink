# Installation and migration

Family Sink is a custom Home Assistant integration by Padezhki Lab. It reads the state, duration and battery entities provided by the official **Oral-B** integration. Home Assistant and its Bluetooth stack handle all communication with the brush. [Oral-B setup and supported devices](https://www.home-assistant.io/integrations/oralb/)

## Requirements

- Home Assistant **2026.10.0 or later** and an administrator account for setup.
- At least one brush reporting a toothbrush state and brushing duration through the official Oral-B integration.
- A working Bluetooth connection for that integration. Battery is optional and can require an active connection and close proximity to the brush. [Oral-B sensor requirements](https://www.home-assistant.io/integrations/oralb/)

## Install the local build

1. Take a Home Assistant backup. Verify that each toothbrush you want to track appears under **Settings → Devices & services → Oral-B**. Run each brush briefly to verify Home Assistant receives its state and duration. [Oral-B setup and battery requirements](https://www.home-assistant.io/integrations/oralb/)
2. Download the Family Sink ZIP from [GitHub Releases](https://github.com/boretestprojects/family-sink/releases) or use the local ZIP supplied for your installation. Extract the `family_sink` folder into your Home Assistant configuration's `custom_components` directory. If installing from a source checkout, use its complete `custom_components/family_sink` folder. On Home Assistant OS the resulting manifest path is `/config/custom_components/family_sink/manifest.json`. The installed folder includes `__init__.py` and the built `frontend` directory.
3. Restart Home Assistant. As an administrator, open **Settings → Devices & services → Add integration**, search for **Family Sink**, and submit the setup form.
4. Open **Family Sink** in the sidebar or visit `/family-sink` on your Home Assistant server. Open the gear icon under an administrator account and add your family members.
5. Select each person's brush and save their profile. In **Diagnostics**, verify that the state and duration sensors are available. Use **Manual sensor selection** if an automatic mapping is missing or ambiguous. The state sensor should report `running` while brushing. A manual duration sensor should report seconds or carry a supported time unit.
6. Set the profile color, team and built-in avatar in the profile editor. To add a personal picture, reopen a saved profile and upload a PNG, JPEG or WebP up to 2 MB.

When replacing a toothbrush, edit its existing participant and select the new device. The participant ID continues to link old sessions, points and achievements. Set a participant inactive to stop recording from their brush and remove them from current competition while retaining their records.

## Upgrade an existing installation

Back up Home Assistant, then replace the installed `custom_components/family_sink` folder with the new release folder. Restart Home Assistant and refresh the panel. Your profiles, settings, avatars and history are stored separately from the installed files.

## Bring over the existing history

1. Download a copy of the legacy `brush_log.txt` from your Home Assistant installation. Each line contains `timestamp|user|duration`. Local timestamps without an offset are interpreted in the Home Assistant time zone.
2. In **Family Sink → Settings → History import and export**, choose the file. Map each old identifier to the appropriate participant, then choose **Import**. Check counts for added, repeated, unmatched and invalid rows. Files can be up to 1 MiB each. Split larger files at line boundaries.
3. Compare several known dates with the legacy dashboard. Test a brush for at least 20 seconds, stop and wait 30 seconds. Test again with a pause and a restart within 30 seconds. Also try brushing two assigned brushes at the same time with the panel closed.
4. Once the new records and imported history have been verified, disable the old brushing automations. Keep the original history backup. Retire the old dashboard and revoke its dedicated token once you have finished using it.

Exports use stable Family Sink profile IDs in the user column. Same-household exports match those IDs automatically in the importer. Existing rows with the same timestamp, participant and duration are skipped on import.

## Install from a custom repository when published

On Home Assistant **2026.11 and newer**, go to **Settings → Marketplace → Add from link**. Follow the prompt to connect GitHub, then enter `https://github.com/boretestprojects/family-sink` and select **Add**. Choose **Integration** if prompted. Open Family Sink in the Marketplace and install it. Restart if prompted, then add the integration through **Devices & services**. [Marketplace custom repositories](https://www.home-assistant.io/integrations/marketplace/#custom-repositories)

On Home Assistant **2026.10**, open **HACS → ⋮ → Custom repositories**, add the same URL as an **Integration**, and download Family Sink. Restart Home Assistant and add the integration through **Devices & services**. [HACS custom repositories](https://hacs.xyz/docs/faq/custom_repositories/)

Both custom repository routes require public access to the repository. Use the local ZIP while the repository is private. Custom repository installation and official catalogue listing are separate distribution steps. [Marketplace repository requirements](https://contributors.home-assistant.io/marketplace/reference/repository-structure/)

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Family Sink is missing from **Add integration** | Confirm that the folder is named `family_sink`, that `manifest.json` is directly inside it, and that Home Assistant was restarted after copying the files. |
| A brush is absent or its sensors are missing | Wake the brush, check its official Oral-B entity states, and verify that the state and duration entities are enabled. Use Family Sink's **Diagnostics** and manual selector if needed. |
| The live timer appears, but no completed session appears | End a brush of at least 20 seconds, wait 30 seconds without resuming, then refresh the panel. Check that the profile is active and assigned. |
| A second participant cannot save the same brush | Release the previous active assignment or mark that participant inactive before reusing the brush. |
| Battery is blank | Check the battery entity in Home Assistant and the availability of an active Bluetooth connection. Other brush data can be available independently. |
| Settings or uploads are unavailable | Sign in as a Home Assistant administrator. Use a PNG, JPEG or WebP under the 2 MB upload limit. |
| A new release still looks like the old version | Confirm the new manifest version, restart Home Assistant, then reload the browser or Companion app panel. |

## Local data and access

The `.storage/family_sink` and `.storage/family_sink.avatars` files live under your Home Assistant configuration directory and are included in ordinary configuration backups. Photos are resized to a maximum of 256 pixels on the longest edge, converted to PNG and stripped of source metadata. Home Assistant authentication protects the panel data and photos. Each authenticated user can view the shared household, and live readings depend on that user's sensor permissions. Administrators can change settings, upload photos and use the history transfer interface. Treat these files, configuration backups and history exports as private household data.

If you remove the integration entry, Home Assistant removes its panel. Re-adding Family Sink restores the existing household data from those stores.
