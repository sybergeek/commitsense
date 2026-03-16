export type IntentKey = 'bugfix' | 'feature' | 'refactor' | 'docs' | 'formatting';
export type IntentScores = Record<IntentKey, number>;

export function classifyIntent(diff: string): {
	intent: IntentKey;
	confidence: number;
	scores: IntentScores;
} {
	const scores: IntentScores = {
		bugfix: 0,
		feature: 0,
		refactor: 0,
		docs: 0,
		formatting: 0
	};

	const lines = diff
		.split('\n')
		.filter(
			(line) =>
				(line.startsWith('+') || line.startsWith('-')) &&
				!line.startsWith('+++ ') &&
				!line.startsWith('--- ')
		);

	let bugTryCatchSignals = 0;
	let bugIfThrowSignals = 0;
	let featureFunctionClassSignals = 0;
	let featureTodoSignals = 0;
	let refactorRenameArrowSignals = 0;
	let featureFunctionSignatureSignals = 0;
	let docsSignals = 0;

	for (const line of lines) {
		if (line.startsWith('+')) {
			if (line.includes('try') || line.includes('catch')) {
				bugTryCatchSignals += 1;
			}

			if (line.includes('if (') || line.includes('throw')) {
				bugIfThrowSignals += 1;
			}

			if (line.includes('function') || line.includes('class')) {
				featureFunctionClassSignals += 1;
			}

			if (line.includes('TODO')) {
				featureTodoSignals += 1;
			}
		}

		if (line.includes('rename') || line.includes('=>')) {
			refactorRenameArrowSignals += 1;
		}

		if (/\bfunction\s+\w+\(/.test(line)) {
			featureFunctionSignatureSignals += 1;
		}

		if (line.includes('README') || line.includes('.md')) {
			docsSignals += 1;
		}
	}

	// Cap each signal contribution so very large diffs cannot dominate scores.
	scores.bugfix += Math.min(bugTryCatchSignals * 2, 5);
	scores.bugfix += Math.min(bugIfThrowSignals, 5);
	scores.feature += Math.min(Math.floor(featureFunctionClassSignals * 1.5), 4);
	scores.feature += Math.min(featureTodoSignals, 3);
	scores.feature += Math.min(featureFunctionSignatureSignals * 1, 4);
	scores.refactor += Math.min(refactorRenameArrowSignals * 3, 9);
	scores.docs += Math.min(docsSignals * 2, 6);

	const bestIntent = (Object.entries(scores).sort(
		(a, b) => b[1] - a[1]
	)[0][0] ?? 'refactor') as IntentKey;
	const maxScore = Math.max(...Object.values(scores));
	// normalize against a slightly larger scale to avoid overly confident defaults
	const confidence = Math.min(Math.round((maxScore / 12) * 100), 100);

	return {
		intent: bestIntent,
		confidence,
		scores
	};
}
