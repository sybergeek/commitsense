import * as vscode from 'vscode';

export class CommitSenseCodeLensProvider implements vscode.CodeLensProvider {
    provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder) {
            return [];
        }

        const topOfFile = new vscode.Range(0, 0, 0, 0);

        return [
            new vscode.CodeLens(topOfFile, {
                title: 'CommitSense: Analyze Latest Commit',
                command: 'commitsense.analyzeCommit'
            }),
            new vscode.CodeLens(topOfFile, {
                title: 'CommitSense: Open Summary Panel',
                command: 'commitsense.openSummaryPanel'
            })
        ];
    }
}