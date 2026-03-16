import * as vscode from 'vscode';
import { analyzeCommitIntent } from '../analyzer/commitAnalyzer';
import { classifyIntent } from '../analyzer/intentClassifier';
import { getChangedHunksForDocument } from '../analyzer/diffParser';
import { getLiveAnalysisData } from '../git/gitService';

export class CommitSenseInlineDecorations implements vscode.Disposable {
    private readonly hintDecoration = vscode.window.createTextEditorDecorationType({
        after: {
            color: new vscode.ThemeColor('descriptionForeground'),
            margin: '0 0 0 1em',
            textDecoration: 'none; font-style: italic;'
        }
    });

    private readonly changedLineDecoration = vscode.window.createTextEditorDecorationType({
        isWholeLine: true,
        backgroundColor: new vscode.ThemeColor('editor.wordHighlightStrongBackground'),
        overviewRulerColor: new vscode.ThemeColor('editorOverviewRuler.modifiedForeground')
    });

    private readonly heatLow = vscode.window.createTextEditorDecorationType({
        isWholeLine: true,
        backgroundColor: 'rgba(76,175,80,0.08)'
    });

    private readonly heatMedium = vscode.window.createTextEditorDecorationType({
        isWholeLine: true,
        backgroundColor: 'rgba(255,193,7,0.08)'
    });

    private readonly heatHigh = vscode.window.createTextEditorDecorationType({
        isWholeLine: true,
        backgroundColor: 'rgba(244,67,54,0.08)'
    });

    async refresh(editor: vscode.TextEditor | undefined): Promise<void> {
        if (!editor) {
            return;
        }

        // Determine document path (works for file and git/diff editors)
        const docPath = editor.document.uri.fsPath && editor.document.uri.fsPath.length > 0
            ? editor.document.uri.fsPath
            : editor.document.uri.path;

        // Resolve workspace folder: try direct lookup, then fallback by matching path prefixes
        let workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
        if (!workspaceFolder && docPath) {
            const folders = vscode.workspace.workspaceFolders ?? [];
            for (const f of folders) {
                if (docPath.startsWith(f.uri.fsPath)) {
                    workspaceFolder = f;
                    break;
                }
            }
        }

        if (!workspaceFolder) {
            editor.setDecorations(this.hintDecoration, []);
            editor.setDecorations(this.changedLineDecoration, []);
            editor.setDecorations(this.heatLow, []);
            editor.setDecorations(this.heatMedium, []);
            editor.setDecorations(this.heatHigh, []);
            return;
        }

        const commitData = await getLiveAnalysisData({
            workspaceFolder,
            silent: true
        });
        if (!commitData) {
            editor.setDecorations(this.hintDecoration, []);
            editor.setDecorations(this.changedLineDecoration, []);
            return;
        }

        const hunks = getChangedHunksForDocument(
            commitData.diff,
            editor.document,
            workspaceFolder
        );

        if (hunks.length === 0) {
            editor.setDecorations(this.hintDecoration, []);
            editor.setDecorations(this.changedLineDecoration, []);
            return;
        }

        const result = analyzeCommitIntent(commitData);
        const baseLabel = `CommitSense: ${result.intent} (${result.confidence}%)`;
        const riskPrefix = result.risk === 'HIGH' ? '⚠ HIGH RISK • ' : '';
        const label = `${riskPrefix}${baseLabel}`;
        const reason = `Reason: ${result.reason}`;

        const hintRanges: { range: vscode.Range; renderOptions: any }[] = [];
        const changedLineRanges: vscode.Range[] = [];

        const lowRanges: vscode.DecorationOptions[] = [];
        const medRanges: vscode.DecorationOptions[] = [];
        const highRanges: vscode.DecorationOptions[] = [];

        for (const hunk of hunks) {
            const hunkStartLine = hunk.startLine;
            const hunkEndLine = hunk.endLine;

            // per-hunk local intent (best-effort)
            const hunkText = (hunk as any).diffText ?? '';
            let perHunkLabel = '';
            try {
                if (hunkText.trim().length > 0) {
                    // Prefer classifying only added lines for a clearer local intent
                    const addedLines = hunkText
                        .split('\n')
                        .filter((l: string) => l.startsWith('+') && !l.startsWith('+++ '))
                        .join('\n');
                    const toClassify = addedLines.trim().length > 0 ? addedLines : hunkText;
                    const local = classifyIntent(toClassify);
                    const LABELS: Record<string, string> = {
                        bugfix: 'Bug Fix',
                        feature: 'Feature',
                        refactor: 'Refactor',
                        docs: 'Docs',
                        formatting: 'Formatting'
                    };
                    const localLabel = LABELS[local.intent] ?? local.intent;
                    const PER_HUNK_CONF_THRESHOLD = 20;
                    if (local.confidence >= PER_HUNK_CONF_THRESHOLD) {
                        perHunkLabel = `${localLabel} (${local.confidence}%)`;
                    }
                }
            } catch (e) {
                perHunkLabel = '';
            }

            const afterText = perHunkLabel ? `${perHunkLabel} • ${label} • ${reason}` : `${label} • ${reason}`;
            hintRanges.push({
                range: new vscode.Range(
                    hunkStartLine,
                    editor.document.lineAt(hunkStartLine).range.end.character,
                    hunkStartLine,
                    editor.document.lineAt(hunkStartLine).range.end.character
                ),
                renderOptions: {
                    after: {
                        contentText: afterText
                    }
                }
            });

            changedLineRanges.push(new vscode.Range(new vscode.Position(hunkStartLine, 0), new vscode.Position(hunkEndLine, 0)));

            // compute per-hunk risk using hunk.diffText (best-effort)
            // reuse previously-read `hunkText` from above
            const { assessHunkRisk } = await import('../analyzer/commitAnalyzer.js');
            const hunkRisk = assessHunkRisk(hunkText, commitData.nameStatus);

            const targetRange = new vscode.Range(new vscode.Position(hunkStartLine, 0), new vscode.Position(hunkEndLine, 0));
            const hoverText = hunkRisk.reasons.length > 0 ? hunkRisk.reasons.join('\n- ') : 'No specific risk reasons detected.';
            const md = new vscode.MarkdownString();
            md.appendMarkdown(`**Hunk risk:** ${hunkRisk.risk}`);
            md.appendMarkdown('\n\n');
            md.appendMarkdown('- ' + hoverText.replace(/\n/g, '\n- '));
            const decoOption: vscode.DecorationOptions = { range: targetRange, hoverMessage: md };

            if (hunkRisk.risk === 'HIGH') {
                highRanges.push(decoOption);
            } else if (hunkRisk.risk === 'MEDIUM') {
                medRanges.push(decoOption);
            } else {
                lowRanges.push(decoOption);
            }
        }

        editor.setDecorations(this.hintDecoration, hintRanges);
        editor.setDecorations(this.changedLineDecoration, changedLineRanges);

        editor.setDecorations(this.heatLow, lowRanges);
        editor.setDecorations(this.heatMedium, medRanges);
        editor.setDecorations(this.heatHigh, highRanges);
    }

    dispose(): void {
        this.hintDecoration.dispose();
        this.changedLineDecoration.dispose();
        this.heatLow.dispose();
        this.heatMedium.dispose();
        this.heatHigh.dispose();
    }
}