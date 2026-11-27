# Security policy

## Report a vulnerability

Use **Security and quality → Report a vulnerability** in the Family Sink repository when private vulnerability reporting is available. Include the Family Sink and Home Assistant versions, the affected function, and a reproducible example with synthetic data. If private reporting is unavailable, open an issue asking the maintainers for a private channel and share the details after they respond. [Repository security page](https://github.com/boretestprojects/family-sink/security)

Keep credentials, access tokens, profile photos, brushing logs, Home Assistant backups and internal addresses out of public reports.

## Supported version

Security reports are reviewed for the latest released version. See the [changelog](CHANGELOG.md) for version history.

## Data and permissions

Family Sink uses the authenticated Home Assistant connection. Signed-in users can see shared household data. Sensor readings follow Home Assistant entity permissions. Configuration, avatar changes, diagnostic views and history transfer require a Home Assistant administrator.

Treat exported histories, the integration's storage files and Home Assistant backups as private. See [local data and access](INSTALLATION.md#local-data-and-access) for the storage locations.
