# Future Improvements

This file lists prioritized improvements and ideas for CommitSense.

- Semantic impact analysis
  - Use `ts-morph` or the TypeScript language service to map changed symbols to usages across the workspace.
  - Improve `ImpactCodeLensProvider` to show symbol-level references rather than textual matches.

- Completed recently (short summary):
  - Per-hunk intent classification and inline labels (prefers added-lines).
  - Per-hunk confidence shown in inline annotations when above a threshold.
  - Change Heatmap: per-hunk risk coloring and hover tooltips with reasons.
  - Commit Narrative Generator with `COMMIT_EDITMSG` integration and command.
  - Improved support for decorating files opened from Source Control/diff editors.

- Better commit message generation
  - Allow configurable templates and scopes (e.g., `feat(scope): subject`).
  - Use more signals to craft a multi-line body and coalesce changed file summaries.

- Hover tooltips for heatmap hunks
  - Show the hunk's risk reasons and matching signals on hover.

- Short-term follow-ups:
  - Add a setting to toggle per-hunk labels and adjust confidence threshold.
  - Add per-hunk score breakdown in hover tooltips (bugfix/feature/refactor counts).
  - Add logging or a debug mode to surface parsed diff->hunk matches for hard-to-reproduce cases.

- Configuration & UX
  - Add settings to toggle heatmap, COMMIT_EDITMSG integration, and confidence thresholds.
  - Add a status bar summary and quick actions for accepting suggestions.

- Tests & CI
  - Add unit tests for `intentClassifier`, `commitAnalyzer`, and `diffParser`.
  - Add GitHub Actions to run `npm run compile` and tests on PRs.

- Packaging & Marketplace
  - Create `icon.png` and screenshots for the Marketplace listing.
  - Add `CHANGELOG.md`, license, and publisher metadata in `package.json`.

- Telemetry & privacy
  - Allow opt-in telemetry for anonymous usage metrics.
  - Add clear privacy policy and ensure no source code leaves the user's machine without consent.

- Security & resilience
  - Audit transitive dependencies and restrict dev-time warnings from tooling.
  - Add timeouts and graceful failures for very large diffs or monorepos.

- Performance
  - Incremental analysis for large diffs; debounce file system / git calls.
  - Cache previous analyses to speed repeated operations.

- Internationalization
  - Prepare strings for translation and add localization support.

- Experimentation
  - Try ML-backed commit message generation (local model or API) with opt-in.

Feel free to pick items from this list to prioritize into issues and TODOs.
