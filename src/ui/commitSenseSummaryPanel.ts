import * as vscode from 'vscode';
import {
    CommitIntentAnalysisResult,
    analyzeCommitIntent
} from '../analyzer/commitAnalyzer';
import {
    CommitAnalysisData,
    getLatestCommitData,
    getLiveAnalysisData
} from '../git/gitService';

export class CommitSenseSummaryPanel implements vscode.Disposable {
    private panel: vscode.WebviewPanel | undefined;

    async show(document?: vscode.TextDocument): Promise<void> {
        if (!this.panel) {
            this.panel = vscode.window.createWebviewPanel(
                'commitsenseSummary',
                'CommitSense Summary',
                vscode.ViewColumn.Beside,
                {
                    enableFindWidget: true
                }
            );

            this.panel.onDidDispose(() => {
                this.panel = undefined;
            });
        } else {
            this.panel.reveal(vscode.ViewColumn.Beside);
        }

        await this.refresh(document);
    }

    async refresh(document?: vscode.TextDocument): Promise<void> {
        if (!this.panel) {
            return;
        }

        const targetDocument = document ?? vscode.window.activeTextEditor?.document;
        const workspaceFolder = targetDocument
            ? vscode.workspace.getWorkspaceFolder(targetDocument.uri)
            : vscode.workspace.workspaceFolders?.[0];

        if (!workspaceFolder) {
            this.panel.webview.html = this.renderEmptyState('No workspace folder open.');
            return;
        }

        const liveData = await getLiveAnalysisData({
            workspaceFolder,
            silent: true
        });
        const data = liveData?.diff.trim()
            ? liveData
            : await getLatestCommitData({ workspaceFolder, silent: true });

        if (!data) {
            this.panel.webview.html = this.renderEmptyState(
                'CommitSense could not read Git data for this workspace.'
            );
            return;
        }

        const hasChanges = Boolean(data.diff.trim());
        if (!hasChanges) {
            this.panel.webview.html = this.renderEmptyState(
                'No staged or working tree changes detected.'
            );
            return;
        }

        const result = analyzeCommitIntent(data);
        this.panel.webview.html = this.renderHtml(result, data);
    }

    dispose(): void {
        this.panel?.dispose();
    }

    private renderEmptyState(message: string): string {
        return `<!DOCTYPE html>
<html lang="en">
<body style="font-family: var(--vscode-font-family); padding: 16px; color: var(--vscode-foreground); background: var(--vscode-editor-background);">
    <h2 style="margin-top: 0;">CommitSense Summary</h2>
    <p>${escapeHtml(message)}</p>
</body>
</html>`;
    }

    private renderHtml(
        result: CommitIntentAnalysisResult,
        data: CommitAnalysisData
    ): string {
        const signalItems = result.signals.length > 0
            ? result.signals.map((signal) => `<li>${escapeHtml(signal)}</li>`).join('')
            : '<li>No strong signals detected.</li>';
        const scoreItems = Object.entries(result.scores)
            .map(
                ([label, value]) =>
                    `<li><strong>${escapeHtml(label)}</strong>: ${value}</li>`
            )
            .join('');
        const sourceLabel =
            data.source === 'staged'
                ? 'Live preview from staged changes'
                : data.source === 'working-tree'
                  ? 'Live preview from working tree changes'
                  : 'Latest committed changes';

        return `<!DOCTYPE html>
<html lang="en">
<body style="font-family: var(--vscode-font-family); padding: 16px; color: var(--vscode-foreground); background: var(--vscode-editor-background);">
    <h2 style="margin-top: 0;">CommitSense Summary</h2>
    <p style="color: var(--vscode-descriptionForeground);">${escapeHtml(sourceLabel)}</p>
    <section style="margin-bottom: 20px;">
        <h3>Intent</h3>
        <p><strong>${escapeHtml(result.intent)}</strong></p>
        <p>Confidence: ${result.confidence}%</p>
        <p>Reason: ${escapeHtml(result.reason)}</p>
    </section>
    <section style="margin-bottom: 20px;">
        <h3>Signals</h3>
        <ul>${signalItems}</ul>
    </section>
    <section style="margin-bottom: 20px;">
        <h3>Impact</h3>
        <p>Affects ${result.impact.fileCount} ${result.impact.fileCount === 1 ? 'file' : 'files'}</p>
    </section>
    <section>
        <h3>Scores</h3>
        <ul>${scoreItems}</ul>
    </section>
</body>
</html>`;
    }
}

function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}