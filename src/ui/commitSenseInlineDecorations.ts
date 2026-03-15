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
        const label = `CommitSense: ${result.intent} (${result.confidence}%)`;
        const reason = `Reason: ${result.reason}`;

        const hintRanges = hunks.map((hunk) => ({
            range: new vscode.Range(
                hunk.startLine,
                editor.document.lineAt(hunk.startLine).range.end.character,
                hunk.startLine,
                editor.document.lineAt(hunk.startLine).range.end.character
            ),
            renderOptions: {
                after: {
                    contentText: `${label} • ${reason}`
                }
            }
        }));

        const changedLineRanges = hunks.map(
            (hunk) =>
                new vscode.Range(
                    new vscode.Position(hunk.startLine, 0),
                    new vscode.Position(hunk.endLine, 0)
                )
        );

        editor.setDecorations(this.hintDecoration, hintRanges);
        editor.setDecorations(this.changedLineDecoration, changedLineRanges);
    }

    dispose(): void {
        this.hintDecoration.dispose();
        this.changedLineDecoration.dispose();
    }
}