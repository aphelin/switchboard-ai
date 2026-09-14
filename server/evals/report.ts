import type { CaseResult, EvalReport, MetricCheck } from './types';

const pad = (
  value: string | number | null | undefined,
  width: number,
  align: 'left' | 'right' = 'left',
) => {
  const text = value === null || value === undefined ? '-' : String(value);
  const clipped = text.length > width ? `${text.slice(0, width - 1)}…` : text;
  return align === 'left' ? clipped.padEnd(width) : clipped.padStart(width);
};

const fmt = (value: number | null, digits = 2) =>
  value === null ? '-' : value.toFixed(digits);

export function formatCaseTable(
  cases: CaseResult[],
  retrievalOnly: boolean,
): string {
  const header = [
    pad('case', 30),
    pad('kind', 12),
    pad('rank', 4, 'right'),
    pad('hit', 3),
    ...(retrievalOnly
      ? []
      : [
          pad('corr', 4, 'right'),
          pad('faith', 5, 'right'),
          pad('abst', 4),
          pad('kw', 5),
          pad('pass', 4),
          pad('notes', 48),
        ]),
  ].join('  ');

  const rows = cases.map((result) => {
    const gen = result.generation;
    const cells = [
      pad(result.case.id, 30),
      pad(result.case.kind, 12),
      pad(result.retrieval.rank, 4, 'right'),
      pad(result.retrieval.hit ? 'yes' : 'NO', 3),
    ];
    if (!retrievalOnly) {
      const kw =
        gen && result.case.expectedKeywords.length > 0
          ? `${gen.keywordsFound.length}/${result.case.expectedKeywords.length}`
          : '-';
      const notes = result.error
        ? `ERROR: ${result.error}`
        : gen?.failures.length
          ? gen.failures.join('; ')
          : (gen?.judge?.reasoning ?? '');
      cells.push(
        pad(gen?.judge?.correctness ?? null, 4, 'right'),
        pad(gen?.judge?.faithfulness ?? null, 5, 'right'),
        pad(gen ? (gen.judge?.abstained ? 'yes' : 'no') : null, 4),
        pad(kw, 5),
        pad(gen ? (gen.passed ? 'ok' : 'FAIL') : null, 4),
        pad(notes, 48),
      );
    }
    return cells.join('  ');
  });

  return [header, '-'.repeat(header.length), ...rows].join('\n');
}

export function formatMetrics(metrics: MetricCheck[]): string {
  return metrics
    .map((m) => {
      const status = m.passed === null ? 'skip' : m.passed ? 'PASS' : 'FAIL';
      const op = m.direction === 'min' ? '>=' : '<=';
      return `${pad(status, 4)}  ${pad(m.name, 28)} ${pad(fmt(m.value), 6, 'right')}  (${op} ${m.threshold})`;
    })
    .join('\n');
}

export function formatSummary(report: EvalReport): string {
  const { usage } = report;
  const byName = Object.entries(usage.byName)
    .map(([name, calls]) => `${name}=${calls}`)
    .join(', ');
  return [
    `Run ${report.runId}  model=${report.model}  embeddings=${report.embeddingModel}`,
    `prompt=${report.promptVersion}  judge=${report.judgeVersion}  mode=${report.retrievalOnly ? 'retrieval-only' : 'full'}`,
    `LLM usage: ${usage.calls} calls (${byName}), ${usage.inputTokens} in / ${usage.outputTokens} out tokens, ~$${usage.costUsd.toFixed(4)}${usage.costComplete ? '' : ' (incomplete: some calls had no price data)'}`,
    `Result: ${report.passed ? 'PASSED' : 'FAILED'}`,
  ].join('\n');
}
