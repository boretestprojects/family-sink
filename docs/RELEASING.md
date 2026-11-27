# Family Sink 0.1.2 release review

The review target is `boretestprojects/family-sink`, owned by Padezhki Lab. Keep the private repository as the review surface until the owner approves publication.

## Local deliverables

- `dist/release/Family-Sink-0.1.2.zip` is the manual installation asset. It contains the `family_sink` folder only.
- `dist/release/Family-Sink-0.1.2-source.zip` is the audited Git source snapshot. It includes the documentation and demo media, with local artifacts excluded.
- [Release notes](RELEASE_NOTES.md) provide the text for the GitHub release.
- **Approved license** is MIT. It permits reuse and modification with the copyright and license notice retained. Review the copyright attribution before making the repository public. [Project license](../LICENSE) · [Open Source Initiative](https://opensource.org/license/mit)

## Repository settings

Use **A local-first family toothbrushing game for Home Assistant.** as the description.

Suggested topics are `home-assistant`, `home-assistant-integration`, `hacs`, `oral-b`, `toothbrushing`, `gamification` and `local-first`.

Enable Issues and check private vulnerability reporting availability. The [validation workflow](../.github/workflows/validate.yml) runs frontend and backend checks on Ubuntu and includes hassfest. The HACS job runs when the repository is public. It checks the repository's public metadata and layout. [Marketplace validation checks](https://contributors.home-assistant.io/marketplace/reference/validation/)

## Push an approved review to the existing private repository

Run the following in PowerShell from the prepared workspace **after approving the source archive**. It creates a sibling checkout. If the private repository has an existing history, the import goes to a new review branch. An empty repository will receive its first `main` branch.

```powershell
$source = (Resolve-Path -LiteralPath '.\dist\release\Family-Sink-0.1.2-source.zip').Path
$review = Join-Path (Split-Path -Parent (Get-Location).Path) 'family-sink-release-review'
if (Test-Path -LiteralPath $review) { throw "Choose a new review checkout path." }
git clone https://github.com/boretestprojects/family-sink.git $review
if ($LASTEXITCODE -ne 0) { throw "Clone failed." }

git -C $review rev-parse --verify HEAD 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
    $branch = 'release/0.1.2'
    git -C $review switch -c $branch
} else {
    $branch = 'main'
    git -C $review symbolic-ref HEAD refs/heads/main
}
if ($LASTEXITCODE -ne 0) { throw "Could not prepare the review branch." }

Expand-Archive -LiteralPath $source -DestinationPath $review -Force -ErrorAction Stop
git -C $review add --all
if ($LASTEXITCODE -ne 0) { throw "Staging failed." }
git -C $review diff --cached --check
if ($LASTEXITCODE -ne 0) { throw "Review the staged whitespace warnings." }
git -C $review diff --cached --stat
git -C $review status --short
```

Inspect the staged changes and any files already in the clone. If the review looks right, commit and push to the private repository.

```powershell
git -C $review commit -m "Prepare Family Sink 0.1.2 for public release"
if ($LASTEXITCODE -ne 0) { throw "Commit failed." }
git -C $review push -u origin $branch
```

## Publish after review

1. Review the README on GitHub and wait for the Linux validation jobs. Merge the review branch into the default branch if applicable.
2. Review all existing Git history and repository assets for private material before changing repository visibility. The local audit covers the prepared source snapshot and installer.
3. When approved, make the repository public and run the full validation workflow, including HACS.
4. Tag the reviewed default-branch commit `v0.1.2`. Use the [release notes](RELEASE_NOTES.md) and attach only the manual installation ZIP to the GitHub release.
5. Verify custom installation from the public repository with Marketplace and HACS before submitting it to the community catalogue. [Catalogue submission guide](https://contributors.home-assistant.io/marketplace/guides/get-into-the-catalog/)
