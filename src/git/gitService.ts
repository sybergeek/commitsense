import * as vscode from 'vscode';
import simpleGit from 'simple-git';

export type CommitAnalysisData = {
    diff: string;
    nameStatus: string;
    message: string;
    source: 'latest-commit' | 'staged' | 'working-tree';
};

type GitRequestOptions = {
    workspaceFolder?: vscode.WorkspaceFolder;
    silent?: boolean;
};

export async function getLatestCommitData(
    options: GitRequestOptions = {}
): Promise<CommitAnalysisData | undefined> {
    const targetWorkspaceFolder =
        options.workspaceFolder ?? vscode.workspace.workspaceFolders?.[0];

    if (!targetWorkspaceFolder) {
        if (!options.silent) {
            vscode.window.showErrorMessage('No workspace folder open.');
        }
        return;
    }

    const repoPath = targetWorkspaceFolder.uri.fsPath;
    const git = simpleGit(repoPath);

    try {
        const [diff, nameStatus, message] = await Promise.all([
            git.show(['HEAD', '--unified=0']),
            git.show(['--name-status', '--format=', 'HEAD']),
            git.show(['-s', '--format=%s', 'HEAD'])
        ]);

        return {
            diff,
            nameStatus,
            message: message.trim(),
            source: 'latest-commit'
        };
    } catch {
        if (!options.silent) {
            vscode.window.showErrorMessage(
                'CommitSense: This folder is not a Git repository.'
            );
        }
        return;
    }
}

export async function getLiveAnalysisData(
    options: GitRequestOptions = {}
): Promise<CommitAnalysisData | undefined> {
    const targetWorkspaceFolder =
        options.workspaceFolder ?? vscode.workspace.workspaceFolders?.[0];

    if (!targetWorkspaceFolder) {
        if (!options.silent) {
            vscode.window.showErrorMessage('No workspace folder open.');
        }
        return;
    }

    const repoPath = targetWorkspaceFolder.uri.fsPath;
    const git = simpleGit(repoPath);

    try {
        const [stagedDiff, stagedNameStatus, workingTreeDiff, workingTreeNameStatus] =
            await Promise.all([
                git.diff(['--cached', '--unified=0']),
                git.diff(['--cached', '--name-status']),
                git.diff(['--unified=0']),
                git.diff(['--name-status'])
            ]);

        if (stagedDiff.trim()) {
            return {
                diff: stagedDiff,
                nameStatus: stagedNameStatus,
                message: '',
                source: 'staged'
            };
        }

        return {
            diff: workingTreeDiff,
            nameStatus: workingTreeNameStatus,
            message: '',
            source: 'working-tree'
        };
    } catch {
        if (!options.silent) {
            vscode.window.showErrorMessage(
                'CommitSense: This folder is not a Git repository.'
            );
        }
        return;
    }
}