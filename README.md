# CommitSense

CommitSense is a VS Code extension that analyzes Git changes and predicts commit intent (for example: Refactor, Feature, Bug Fix) with confidence and supporting signals.

## Features

- Inline commit intent annotations on changed lines in the editor.
- Inline CodeLens actions at the top of files:
	- `CommitSense: Analyze Latest Commit`
	- `CommitSense: Open Summary Panel`
 - Commit Narrative Generator:
	 - Suggests concise conventional-commit messages for staged changes.
	 - Offered when editing `COMMIT_EDITMSG` or via command.
 - Change Heatmap:
	 - Colorizes changed hunks by per-hunk risk (green/yellow/red) using editor decorations.
 - Per-hunk intent labels and confidence:
	- Each changed hunk is locally classified (based on added lines) and the inline annotation shows the hunk's predicted intent and confidence when reliable.
	- Hover a heatmap hunk to see the exact risk reasons detected for that hunk.
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
 - `commitsense.generateCommitMessage`
    - Title: `CommitSense: Generate Commit Message`
    - Generates a suggested conventional-commit subject and body for staged changes; can insert into the commit editor or copy to clipboard.

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

Additional usage tips:

- Open the `COMMIT_EDITMSG` buffer during an interactive commit — CommitSense will offer a suggested commit message to insert or preview.
- Run `CommitSense: Generate Commit Message` to create a suggestion for currently staged changes and copy or insert it into a commit buffer.

- Notes on editor support:
	- CommitSense now supports decorating files opened from the Source Control diff view and other non-file editors by matching document paths to workspace folders.
	- Inline decorations are computed from live staged/working-tree diffs so the annotations reflect the changes you're about to commit.

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

## Unreleased (master)

- Commit Narrative Generator: suggests conventional-commit style messages for staged changes and offers to insert/preview suggestions when `COMMIT_EDITMSG` is opened.
- Change Heatmap: per-hunk risk coloring (green/yellow/red) applied to changed hunks in the editor using decorations.
- Per-hunk risk heuristics power the heatmap and can be surfaced via hover/tooltips in a future update.

- Per-hunk intent classification: CommitSense classifies each changed hunk (preferring added lines) and will show the local intent and confidence inline when above a confidence threshold.
- Hover tooltips on heatmap hunks: hovers now show the hunk risk level and specific reasons (e.g., "removed error-handling", "function signature change").
- Improved SCM/diff editor compatibility: inline decorations now work for files opened from the Source Control diff view and other non-file URI editors.

## Development

- Build: `npm run compile`
- Watch: `npm run watch`
- Test: `npm test`
