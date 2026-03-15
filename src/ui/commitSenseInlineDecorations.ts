import * as vscode from 'vscode';
import { analyzeCommitIntent } from '../analyzer/commitAnalyzer';
import { getChangedHunksForDocument } from '../analyzer/diffParser';
import { getLatestCommitData } from '../git/gitService';

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
        if (!editor || editor.document.uri.scheme !== 'file') {
            return;
        }

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
        if (!workspaceFolder) {
            editor.setDecorations(this.hintDecoration, []);
            editor.setDecorations(this.changedLineDecoration, []);
            return;
        }

        const commitData = await getLatestCommitData({
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

        const lowRanges: vscode.Range[] = [];
        const medRanges: vscode.Range[] = [];
        const highRanges: vscode.Range[] = [];

        for (const hunk of hunks) {
            const hunkStartLine = hunk.startLine;
            const hunkEndLine = hunk.endLine;

            hintRanges.push({
                range: new vscode.Range(
                    hunkStartLine,
                    editor.document.lineAt(hunkStartLine).range.end.character,
                    hunkStartLine,
                    editor.document.lineAt(hunkStartLine).range.end.character
                ),
                renderOptions: {
                    after: {
                        contentText: `${label} • ${reason}`
                    }
                }
            });

            changedLineRanges.push(new vscode.Range(new vscode.Position(hunkStartLine, 0), new vscode.Position(hunkEndLine, 0)));

            // compute per-hunk risk using hunk.diffText (best-effort)
            const hunkText = (hunk as any).diffText ?? '';
            const { assessHunkRisk } = await import('../analyzer/commitAnalyzer.js');
            const hunkRisk = assessHunkRisk(hunkText, commitData.nameStatus);

            const targetRange = new vscode.Range(new vscode.Position(hunkStartLine, 0), new vscode.Position(hunkEndLine, 0));
            if (hunkRisk.risk === 'HIGH') {
                highRanges.push(targetRange);
            } else if (hunkRisk.risk === 'MEDIUM') {
                medRanges.push(targetRange);
            } else {
                lowRanges.push(targetRange);
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
    }
}