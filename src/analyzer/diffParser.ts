import * as path from 'path';
import * as vscode from 'vscode';

export type ChangedHunk = {
	startLine: number;
	endLine: number;
};

type ParsedFileDiff = {
	filePath: string;
	hunks: ChangedHunk[];
};

export function getChangedHunksForDocument(
	diff: string,
	document: vscode.TextDocument,
	workspaceFolder: vscode.WorkspaceFolder
): ChangedHunk[] {
	const relativePath = normalizePath(
		path.relative(workspaceFolder.uri.fsPath, document.uri.fsPath)
	);
	const parsedFiles = parseDiffByFile(diff);
	const matchedFile = parsedFiles.find((file) => file.filePath === relativePath);

	return matchedFile?.hunks ?? [];
}

function parseDiffByFile(diff: string): ParsedFileDiff[] {
	const files: ParsedFileDiff[] = [];
	let currentFile: ParsedFileDiff | undefined;

	for (const line of diff.split('\n')) {
		if (line.startsWith('diff --git ')) {
			const match = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
			if (!match) {
				currentFile = undefined;
				continue;
			}

			currentFile = {
				filePath: normalizePath(match[2]),
				hunks: []
			};
			files.push(currentFile);
			continue;
		}

		if (!currentFile || !line.startsWith('@@')) {
			continue;
		}

		const hunkMatch = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
		if (!hunkMatch) {
			continue;
		}

		const newStartLine = Number(hunkMatch[1]);
		const newLineCount = hunkMatch[2] ? Number(hunkMatch[2]) : 1;

		if (newLineCount === 0) {
			const anchorLine = Math.max(newStartLine - 1, 0);
			currentFile.hunks.push({
				startLine: anchorLine,
				endLine: anchorLine
			});
			continue;
		}

		currentFile.hunks.push({
			startLine: Math.max(newStartLine - 1, 0),
			endLine: Math.max(newStartLine + newLineCount - 2, 0)
		});
	}

	return files;
}

function normalizePath(filePath: string): string {
	return filePath.replaceAll('\\', '/');
}
