import * as vscode from 'vscode';
import { getLatestCommitData } from './git/gitService';
import { analyzeCommitIntent } from './analyzer/commitAnalyzer';
import { CommitSenseCodeLensProvider } from './ui/commitSenseCodeLensProvider';
import { CommitSenseInlineDecorations } from './ui/commitSenseInlineDecorations';
import { CommitSenseSummaryPanel } from './ui/commitSenseSummaryPanel';

export function activate(context: vscode.ExtensionContext) {
    const codeLensProvider = vscode.languages.registerCodeLensProvider(
        { scheme: 'file' },
        new CommitSenseCodeLensProvider()
    );
    const inlineDecorations = new CommitSenseInlineDecorations();
    const summaryPanel = new CommitSenseSummaryPanel();

    const disposable = vscode.commands.registerCommand(
        'commitsense.analyzeCommit',
        async () => {
            const activeEditor = vscode.window.activeTextEditor;
            const workspaceFolder = activeEditor
                ? vscode.workspace.getWorkspaceFolder(activeEditor.document.uri)
                : undefined;

            const commitData = await getLatestCommitData({ workspaceFolder });
            if (!commitData) {
                return;
            }
            const result = analyzeCommitIntent(commitData);
            const scoreLines = [
                `bugfix: ${result.scores.bugfix}`,
                `feature: ${result.scores.feature}`,
                `refactor: ${result.scores.refactor}`,
                `docs: ${result.scores.docs}`,
                `formatting: ${result.scores.formatting}`
            ].join(' | ');

            vscode.window.showInformationMessage(
                `Intent: ${result.intent} | Confidence: ${result.confidence}% | Reason: ${result.reason} | Scores: ${scoreLines}`
            );

        }
    );

    const openSummaryPanelCommand = vscode.commands.registerCommand(
        'commitsense.openSummaryPanel',
        async () => {
            await summaryPanel.show(vscode.window.activeTextEditor?.document);
        }
    );

    context.subscriptions.push(summaryPanel);
    context.subscriptions.push(inlineDecorations);
    context.subscriptions.push(codeLensProvider);
    context.subscriptions.push(disposable);
    context.subscriptions.push(openSummaryPanelCommand);

    void inlineDecorations.refresh(vscode.window.activeTextEditor);

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            void inlineDecorations.refresh(editor);
            void summaryPanel.refresh(editor?.document);
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument((document) => {
            const editor = vscode.window.visibleTextEditors.find(
                (visibleEditor) => visibleEditor.document.uri.toString() === document.uri.toString()
            );

            if (editor) {
                void inlineDecorations.refresh(editor);
            }

            void summaryPanel.refresh(document);
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument((document) => {
            void summaryPanel.refresh(document);
        })
    );
}

export function deactivate() {}