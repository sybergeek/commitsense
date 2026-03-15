# CommitSense

CommitSense is a VS Code extension that analyzes Git changes and predicts commit intent (for example: Refactor, Feature, Bug Fix) with confidence and supporting signals.

## Features

- Inline commit intent annotations on changed lines in the editor.
- Inline CodeLens actions at the top of files:
	- `CommitSense: Analyze Latest Commit`
	- `CommitSense: Open Summary Panel`
- Command-based analysis with confidence percentage and score breakdown.
- Summary side panel with intent, confidence, reason, signals, impact, and score details.
- Live preview refresh on save using current Git changes:
	- staged diff when available
	- otherwise working tree diff
	- otherwise latest commit as fallback

## How It Works

CommitSense combines multiple signals:

- Diff content heuristics on added and removed lines.
- File-level change status (`git show --name-status` for latest commit, or `git diff --name-status` for live preview).
- Commit message prefixes such as `fix`, `feat`, and `refactor`.

It then computes:

- `intent`: top predicted category
- `confidence`: normalized percent score (0-100)
- `scores`: per-category score map
- `signals`: human-readable reasons that influenced the result
- `impact`: changed file count

## Commands

- `commitsense.analyzeCommit`
	- Title: `CommitSense: Analyze Commit Intent`
	- Runs analysis and shows a quick summary notification.
- `commitsense.openSummaryPanel`
	- Title: `CommitSense: Open Summary Panel`
	- Opens a webview panel with detailed analysis.

## Requirements

- A Git repository must be open in VS Code.
- Git CLI must be available in your environment.
- Works best when there is either:
	- an existing latest commit, or
	- staged/working tree changes for live preview.

## Usage

1. Open a project folder that is a Git repository.
2. Open a source file and use one of these entry points:
	 - Click `CommitSense: Analyze Latest Commit` CodeLens.
	 - Click `CommitSense: Open Summary Panel` CodeLens.
	 - Run `CommitSense: Analyze Commit Intent` from command search.
3. Save files to refresh the live summary panel automatically.

## Extension Settings

This extension currently does not contribute user-facing settings.

## Known Issues

- Intent is inferred using heuristics, so edge cases can be misclassified.
- Inline annotation is based on latest commit hunks, while the summary panel can show live staged/working-tree analysis.
- Very large diffs may reduce signal quality despite score caps.

## Release Notes

### 0.0.1

- Initial CommitSense implementation.
- Added commit intent classification and confidence scoring.
- Added workspace-safe Git integration.
- Added inline editor annotations and CodeLens actions.
- Added summary webview panel and live analysis refresh on save.

---

## Development

- Build: `npm run compile`
- Watch: `npm run watch`
- Test: `npm test`
