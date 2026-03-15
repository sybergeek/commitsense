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
    risk: 'LOW' | 'MEDIUM' | 'HIGH';
    riskReasons: string[];
};

export type HunkRisk = {
    risk: 'LOW' | 'MEDIUM' | 'HIGH';
    reasons: string[];
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

export function assessHunkRisk(hunkDiff: string, nameStatus: string): HunkRisk {
    const reasons: string[] = [];
    const removedTryCatch = countMatches(hunkDiff, /(^-.*\btry\b|^-.*\bcatch\b)/gm);
    const removedThrow = countMatches(hunkDiff, /(^-.*\bthrow\b)/gm);
    const functionSignatureChanges = countMatches(hunkDiff, /\bfunction\s+\w+\(/g);
    const arrowChanges = countMatches(hunkDiff, /=>/g);

    if (removedTryCatch + removedThrow > 0) {
        reasons.push('removed error-handling (try/catch/throw)');
    }

    if (functionSignatureChanges >= 1) {
        reasons.push('function signature change');
    }

    if (arrowChanges > 3) {
        reasons.push('many arrow/function style changes');
    }

    // simple file-level hints from nameStatus for this hunk (best-effort)
    const lower = nameStatus.toLowerCase();
    if (/auth|payment|service|controller|api|public/.test(lower)) {
        reasons.push('touches critical file(s)');
    }

    let risk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (reasons.length === 0) {
        risk = 'LOW';
    } else {
        const severe = reasons.some((r) => /removed error-handling|critical/.test(r));
        if (severe || removedTryCatch + removedThrow >= 2) {
            risk = 'HIGH';
        } else {
            risk = 'MEDIUM';
        }
    }

    return { risk, reasons };
}

export function generateCommitMessageFromAnalysis(analysis: CommitIntentAnalysisResult): string {
    const prefixMap: Record<string, string> = {
        'Bug Fix': 'fix',
        'Feature': 'feat',
        'Refactor': 'refactor',
        'Docs': 'docs',
        'Formatting': 'style'
    };

    const prefix = prefixMap[analysis.intent] ?? 'chore';

    // construct a short subject from reason/signals
    const short = (() => {
        if (analysis.signals && analysis.signals.length > 0) {
            // take first meaningful signal and trim
            const sig = analysis.signals[0];
            // remove `commit message:` prefix if present
            return sig.replace(/^commit message:\s*/i, '').slice(0, 60).trim();
        }
        // fallback to reason
        return analysis.reason.slice(0, 60);
    })();

    const subject = `${prefix}: ${short || analysis.intent.toLowerCase()}`;

    // optional body with confidence and signals
    const bodyLines = [] as string[];
    bodyLines.push(analysis.reason);
    bodyLines.push(`Confidence: ${analysis.confidence}%`);
    if (analysis.signals && analysis.signals.length > 0) {
        bodyLines.push('Signals: ' + analysis.signals.join(', '));
    }

    return `${subject}\n\n${bodyLines.join('\n')}`;
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
    const { risk, riskReasons } = assessRisk({ input, scores, signals, impact });

    return {
        intent: INTENT_LABELS[bestIntent],
        confidence,
        scores,
        reason,
        signals,
        impact
        ,
        risk,
        riskReasons
    };
}

function assessRisk({
    input,
    scores,
    signals,
    impact
}: {
    input: { diff: string; nameStatus: string; message: string };
    scores: IntentScores;
    signals: string[];
    impact: { fileCount: number };
}): { risk: 'LOW' | 'MEDIUM' | 'HIGH'; riskReasons: string[] } {
    const reasons: string[] = [];
    const diff = input.diff;
    const nameStatusLines = input.nameStatus
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

    const renameCount = nameStatusLines.filter((l) => l.startsWith('R')).length;
    const removedTryCatch = countMatches(diff, /(^-.*\btry\b|^-.*\bcatch\b)/gm);
    const removedThrow = countMatches(diff, /(^-.*\bthrow\b)/gm);
    const functionSignatureChanges = countMatches(diff, /\bfunction\s+\w+\(/g);
    const arrowChanges = countMatches(diff, /=>/g);

    // Critical service / public API indicators from file names
    const criticalFiles = nameStatusLines.filter((line) =>
        /auth|payment|service|controller|api|public/i.test(line)
    ).length;

    // High-risk conditions
    if (removedTryCatch + removedThrow > 0) {
        reasons.push('removed error-handling (try/catch/throw)');
    }

    if (renameCount >= 3) {
        reasons.push(`multiple renames (${renameCount})`);
    }

    if (criticalFiles > 0) {
        reasons.push(`modified critical files (${criticalFiles})`);
    }

    if ((scores.refactor >= 8 || renameCount >= 2) && impact.fileCount >= 4) {
        reasons.push('large refactor across multiple files');
    }

    if (functionSignatureChanges >= 2) {
        reasons.push('multiple function signature changes');
    }

    if (arrowChanges > 5) {
        reasons.push('many arrow/function style changes (possible bulk refactor)');
    }

    // Decide risk level
    let risk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (reasons.length === 0) {
        // fallback heuristics
        if (scores.bugfix >= 6) { risk = 'MEDIUM'; }
        if (scores.refactor >= 9 && impact.fileCount >= 3) { risk = 'MEDIUM'; }
    } else {
        // escalate based on severity
        const severe = reasons.some((r) => /removed error-handling|critical|large refactor/.test(r));
        if (severe || renameCount >= 3 || removedTryCatch + removedThrow >= 2) {
            risk = 'HIGH';
        } else {
            risk = 'MEDIUM';
        }
    }

    return { risk, riskReasons: reasons };
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