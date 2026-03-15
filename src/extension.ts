import * as vscode from 'vscode';
import { getLatestCommitData } from './git/gitService';
import { analyzeCommitIntent } from './analyzer/commitAnalyzer';
import { CommitSenseCodeLensProvider } from './ui/commitSenseCodeLensProvider';
import { CommitSenseInlineDecorations } from './ui/commitSenseInlineDecorations';
import { ImpactCodeLensProvider } from './ui/impactCodeLensProvider';
import * as path from 'path';
import { CommitSenseSummaryPanel } from './ui/commitSenseSummaryPanel';

export function activate(context: vscode.ExtensionContext) {
    const codeLensProvider = vscode.languages.registerCodeLensProvider(
        { scheme: 'file' },
        new CommitSenseCodeLensProvider()
    );
    const inlineDecorations = new CommitSenseInlineDecorations();
    const summaryPanel = new CommitSenseSummaryPanel();
    const impactProviderTs = vscode.languages.registerCodeLensProvider({ language: 'typescript', scheme: 'file' }, new ImpactCodeLensProvider());
    const impactProviderJs = vscode.languages.registerCodeLensProvider({ language: 'javascript', scheme: 'file' }, new ImpactCodeLensProvider());

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
                `Intent: ${result.intent} | Confidence: ${result.confidence}% | Risk: ${result.risk} | Reason: ${result.reason} | Scores: ${scoreLines}`
            );

        }
    );

    const openSummaryPanelCommand = vscode.commands.registerCommand(
        'commitsense.openSummaryPanel',
        async () => {
            await summaryPanel.show(vscode.window.activeTextEditor?.document);
        }
    );

    const generateCommitMessageCommand = vscode.commands.registerCommand(
        'commitsense.generateCommitMessage',
        async () => {
            const editor = vscode.window.activeTextEditor;
            const workspaceFolder = editor ? vscode.workspace.getWorkspaceFolder(editor.document.uri) : undefined;
            const { getLiveAnalysisData } = await import('./git/gitService.js');
            const { analyzeCommitIntent, generateCommitMessageFromAnalysis } = await import('./analyzer/commitAnalyzer.js');

            const commitData = await getLiveAnalysisData({ workspaceFolder, silent: true });
            if (!commitData) {
                vscode.window.showInformationMessage('CommitSense: no staged changes detected to analyze.');
                return;
            }

            const analysis = analyzeCommitIntent(commitData);
            const suggestion = generateCommitMessageFromAnalysis(analysis);

            const pick = await vscode.window.showInformationMessage('CommitSense suggested commit message', 'Insert into editor', 'Copy to clipboard', 'Cancel');
            if (pick === 'Insert into editor') {
                if (editor) {
                    const fullRange = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(editor.document.lineCount + 1, 0));
                    const edit = new vscode.WorkspaceEdit();
                    edit.replace(editor.document.uri, fullRange, suggestion);
                    await vscode.workspace.applyEdit(edit);
                    await editor.document.save();
                } else {
                    const doc = await vscode.workspace.openTextDocument({ content: suggestion, language: 'git-commit' });
                    await vscode.window.showTextDocument(doc);
                }
            } else if (pick === 'Copy to clipboard') {
                await vscode.env.clipboard.writeText(suggestion);
                vscode.window.showInformationMessage('CommitSense: suggestion copied to clipboard');
            }
        }
    );

    const showImpactCommand = vscode.commands.registerCommand('commitsense.showImpact', async (files: string[]) => {
        if (!files || files.length === 0) {
            vscode.window.showInformationMessage('CommitSense: No impacted files found.');
            return;
        }

        const items = files.map((f: string) => ({ label: path.basename(f), description: f }));
        const pick = await vscode.window.showQuickPick(items, { placeHolder: 'Open impacted file' });
        if (pick && pick.description) {
            const doc = await vscode.workspace.openTextDocument(pick.description);
            await vscode.window.showTextDocument(doc);
        }
    });

    context.subscriptions.push(summaryPanel);
    context.subscriptions.push(inlineDecorations);
    context.subscriptions.push(impactProviderTs);
    context.subscriptions.push(impactProviderJs);
    context.subscriptions.push(codeLensProvider);
    context.subscriptions.push(disposable);
    context.subscriptions.push(openSummaryPanelCommand);
    context.subscriptions.push(showImpactCommand);
    context.subscriptions.push(generateCommitMessageCommand);

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

            // Hook into Git commit editor buffer (COMMIT_EDITMSG)
            const fileName = document.uri.path.split('/').pop();
            if (fileName === 'COMMIT_EDITMSG') {
                // show suggestion action
                void (async () => {
                    const { getLiveAnalysisData } = await import('./git/gitService.js');
                    const { analyzeCommitIntent, generateCommitMessageFromAnalysis } = await import('./analyzer/commitAnalyzer.js');
                    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
                    const commitData = await getLiveAnalysisData({ workspaceFolder, silent: true });
                    if (!commitData) {
                        return;
                    }
                    const analysis = analyzeCommitIntent(commitData);
                    const suggestion = generateCommitMessageFromAnalysis(analysis);

                    const action = await vscode.window.showInformationMessage('CommitSense: suggested commit message available', 'Insert suggestion', 'Preview', 'Ignore');
                    if (action === 'Insert suggestion') {
                        const editorForDoc = vscode.window.visibleTextEditors.find((e) => e.document.uri.toString() === document.uri.toString());
                        if (editorForDoc) {
                            const fullRange = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(editorForDoc.document.lineCount + 1, 0));
                            const edit = new vscode.WorkspaceEdit();
                            edit.replace(editorForDoc.document.uri, fullRange, suggestion);
                            await vscode.workspace.applyEdit(edit);
                            await editorForDoc.document.save();
                        }
                    } else if (action === 'Preview') {
                        void vscode.window.showInformationMessage(suggestion);
                    }
                })();
            }
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument((document) => {
            void summaryPanel.refresh(document);
        })
    );
}

export function deactivate() {}