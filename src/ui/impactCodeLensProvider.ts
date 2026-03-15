import * as vscode from 'vscode';
import * as path from 'path';

export class ImpactCodeLensProvider implements vscode.CodeLensProvider {
    provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
        const codeLenses: vscode.CodeLens[] = [];
        const text = document.getText();

        const funcRegex = /function\s+([a-zA-Z0-9_$]+)\s*\(/g;
        let match: RegExpExecArray | null;
        while ((match = funcRegex.exec(text)) !== null) {
            const name = match[1];
            const pos = document.positionAt(match.index);
            const range = new vscode.Range(pos.line, 0, pos.line, 0);

            const lens = new vscode.CodeLens(range);
            // store metadata for resolve
            (lens as any).data = { name };
            codeLenses.push(lens);
        }

        return codeLenses;
    }

    async resolveCodeLens(codeLens: vscode.CodeLens): Promise<vscode.CodeLens> {
        const data = (codeLens as any).data as { name?: string } | undefined;
        if (!data || !data.name) {
            return codeLens;
        }

        const name = data.name;
        const files = await vscode.workspace.findFiles('**/*.{ts,js,jsx,tsx}', '**/node_modules/**');
        const fileSet = new Set<string>();

        for (const uri of files) {
            try {
                const doc = await vscode.workspace.openTextDocument(uri);
                const text = doc.getText();
                const re = new RegExp('\\b' + name + '\\b', 'g');
                if (re.test(text)) {
                    fileSet.add(uri.fsPath);
                }
            } catch {
                // ignore read errors
            }
        }

        const count = fileSet.size;
        codeLens.command = {
            title: `CommitSense Impact: ${count} file${count === 1 ? '' : 's'} affected`,
            command: 'commitsense.showImpact',
            arguments: [Array.from(fileSet)]
        };

        return codeLens;
    }
}
