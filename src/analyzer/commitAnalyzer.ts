import { classifyIntent, IntentKey, IntentScores } from './intentClassifier';

export type CommitIntentAnalysisResult = {
    intent: string;
    confidence: number;
    scores: IntentScores;
    reason: string;
    signals: string[];
    impact: {
        fileCount: number;
    };
};

const INTENT_LABELS: Record<IntentKey, string> = {
    bugfix: 'Bug Fix',
    feature: 'Feature',
    refactor: 'Refactor',
    docs: 'Docs',
    formatting: 'Formatting'
};

export function analyzeIntent(diff: string): {
    intent: string;
    confidence: number;
    scores: IntentScores;
} {
    const result = classifyIntent(diff);

    return {
        intent: INTENT_LABELS[result.intent],
        confidence: result.confidence,
        scores: result.scores
    };
}

export function analyzeCommitIntent(input: {
    diff: string;
    nameStatus: string;
    message: string;
}): CommitIntentAnalysisResult {
    const baseResult = classifyIntent(input.diff);

    const scores: IntentScores = {
        ...baseResult.scores
    };

    const message = input.message.trim().toLowerCase();
    if (message.startsWith('fix')) {
        scores.bugfix += 5;
    } else if (message.startsWith('feat')) {
        scores.feature += 5;
    } else if (message.startsWith('refactor')) {
        scores.refactor += 5;
    }

    const nameStatusLines = input.nameStatus
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    for (const line of nameStatusLines) {
        if (line.startsWith('R')) {
            scores.refactor += 4;
        }

        if (line.endsWith('.md') || line.includes('README')) {
            scores.docs += 2;
        }
    }

    const bestIntent = (Object.entries(scores).sort(
        (a, b) => b[1] - a[1]
    )[0][0] ?? 'refactor') as IntentKey;
    const maxScore = Math.max(...Object.values(scores));
    const confidence = Math.min(Math.round((maxScore / 10) * 100), 100);
    const signals = buildSignals(input);
    const impact = {
        fileCount: getChangedFileCount(input.nameStatus)
    };
    const reason = buildReason(bestIntent, input, signals);

    return {
        intent: INTENT_LABELS[bestIntent],
        confidence,
        scores,
        reason,
        signals,
        impact
    };
}

function buildReason(
    intent: IntentKey,
    input: { nameStatus: string; message: string; diff: string },
    signals: string[]
): string {
    const message = input.message.trim().toLowerCase();
    const diff = input.diff.toLowerCase();
    const hasRename = input.nameStatus
        .split('\n')
        .some((line) => line.trim().startsWith('R'));

    if (message.startsWith('fix')) {
        return 'commit message starts with fix';
    }

    if (message.startsWith('feat')) {
        return 'commit message starts with feat';
    }

    if (message.startsWith('refactor')) {
        return 'commit message starts with refactor';
    }

    if (intent === 'refactor' && hasRename) {
        return 'rename detected in latest commit';
    }

    if (intent === 'bugfix' && (diff.includes('try') || diff.includes('catch'))) {
        return 'error-handling changes detected';
    }

    if (
        intent === 'feature' &&
        (/\bfunction\s+\w+\(/.test(input.diff) || input.diff.includes('class '))
    ) {
        return 'function or class signature changes detected';
    }

    if (intent === 'docs') {
        return 'documentation files changed';
    }

    if (signals.length > 0) {
        return signals[0];
    }

    return 'latest commit diff patterns matched';
}

function buildSignals(input: {
    diff: string;
    nameStatus: string;
    message: string;
}): string[] {
    const signals: string[] = [];
    const nameStatusLines = input.nameStatus
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    const renameCount = nameStatusLines.filter((line) => line.startsWith('R')).length;
    const functionSignatureCount = countMatches(input.diff, /\bfunction\s+\w+\(/g);
    const classCount = countMatches(input.diff, /\bclass\s+\w+/g);
    const arrowChangeCount = countMatches(input.diff, /=>/g);
    const tryCatchCount = countMatches(input.diff, /\btry\b|\bcatch\b/g);
    const throwCount = countMatches(input.diff, /\bthrow\b/g);
    const docFileCount = nameStatusLines.filter(
        (line) => line.endsWith('.md') || line.includes('README')
    ).length;
    const message = input.message.trim();

    if (message) {
        signals.push(`commit message: ${message}`);
    }

    if (renameCount > 0) {
        signals.push(`renamed ${renameCount} ${pluralize('file', renameCount)}`);
    }

    if (functionSignatureCount > 0 || classCount > 0) {
        const structuralCount = functionSignatureCount + classCount;
        signals.push(
            `changed ${structuralCount} ${pluralize('function or class signature', structuralCount)}`
        );
    }

    if (arrowChangeCount > 0) {
        signals.push(`logic simplified in ${arrowChangeCount} ${pluralize('line', arrowChangeCount)}`);
    }

    if (tryCatchCount > 0 || throwCount > 0) {
        const defensiveCount = tryCatchCount + throwCount;
        signals.push(`added ${defensiveCount} ${pluralize('error-handling signal', defensiveCount)}`);
    }

    if (docFileCount > 0) {
        signals.push(`updated ${docFileCount} ${pluralize('documentation file', docFileCount)}`);
    }

    return signals.slice(0, 4);
}

function getChangedFileCount(nameStatus: string): number {
    return nameStatus
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0).length;
}

function countMatches(text: string, pattern: RegExp): number {
    return text.match(pattern)?.length ?? 0;
}

function pluralize(word: string, count: number): string {
    return count === 1 ? word : `${word}s`;
}