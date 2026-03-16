import * as path from 'path';
import * as vscode from 'vscode';

export type ChangedHunk = {
	startLine: number;
	endLine: number;
	diffText?: string;
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
	const docPath = document.uri.fsPath && document.uri.fsPath.length > 0 ? document.uri.fsPath : document.uri.path;
	const relativePath = normalizePath(
		path.relative(workspaceFolder.uri.fsPath, docPath)
	);
	const parsedFiles = parseDiffByFile(diff);
	const matchedFile = parsedFiles.find((file) => file.filePath === relativePath);

	return matchedFile?.hunks ?? [];
}

function parseDiffByFile(diff: string): ParsedFileDiff[] {
	const files: ParsedFileDiff[] = [];
	let currentFile: ParsedFileDiff | undefined;

	const lines = diff.split('\n');
	let i = 0;
	while (i < lines.length) {
		const line = lines[i];
		if (line.startsWith('diff --git ')) {
			const match = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
			if (!match) {
				currentFile = undefined;
				i++;
				continue;
			}

			currentFile = {
				filePath: normalizePath(match[2]),
				hunks: []
			};
			files.push(currentFile);
			i++;
			continue;
		}
		if (!currentFile) { i++; continue; }

		if (!line.startsWith('@@')) { i++; continue; }

		const hunkMatch = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
		if (!hunkMatch) { i++; continue; }

		const newStartLine = Number(hunkMatch[1]);
		const newLineCount = hunkMatch[2] ? Number(hunkMatch[2]) : 1;

		// collect raw hunk lines (starting at @@ until next @@ or diff --git)
		const hunkLines: string[] = [];
		hunkLines.push(line);
		let j = i + 1;
		while (j < lines.length && !lines[j].startsWith('diff --git ') && !lines[j].startsWith('@@')) {
			hunkLines.push(lines[j]);
			j++;
		}

		const hunkDiffText = hunkLines.join('\n');

		if (newLineCount === 0) {
			const anchorLine = Math.max(newStartLine - 1, 0);
			currentFile.hunks.push({
				startLine: anchorLine,
				endLine: anchorLine,
				diffText: hunkDiffText
			});
			i = j;
			continue;
		}

		currentFile.hunks.push({
			startLine: Math.max(newStartLine - 1, 0),
			endLine: Math.max(newStartLine + newLineCount - 2, 0),
			diffText: hunkDiffText
		});

		i = j;
	}

	return files;
}

function normalizePath(filePath: string): string {
	return filePath.replaceAll('\\', '/');
}
