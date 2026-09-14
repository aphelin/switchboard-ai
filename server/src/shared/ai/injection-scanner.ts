/**
 * Cheap heuristic detector for prompt-injection attempts inside retrieved
 * content (documents, tool results). It does not block anything on its own:
 * flagged passages are still shown to the model, but marked so the system
 * prompt can tell the model to treat them as untrusted data.
 *
 * A production system would layer this with a classifier model and strict
 * tool permissions; the heuristic is the first, zero-cost line of defence.
 */
const INJECTION_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern:
      /ignore\s+(all\s+|the\s+|any\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?)/i,
    reason: 'asks to ignore previous instructions',
  },
  {
    pattern:
      /disregard\s+(all\s+|the\s+|your\s+)?(previous|prior|above|system)\s+(instructions?|prompts?|rules?)/i,
    reason: 'asks to disregard instructions',
  },
  {
    pattern: /you\s+are\s+now\s+(a|an|the)\s+/i,
    reason: 'attempts to reassign the assistant role',
  },
  {
    // Only at the start of a line: "Operating system: Linux" mid-sentence is benign.
    pattern: /^\s*(system|assistant)\s*:/im,
    reason: 'contains fake role markers',
  },
  {
    pattern: /<\s*\/?\s*(system|instructions?|assistant)\s*>/i,
    reason: 'contains fake instruction tags',
  },
  {
    pattern:
      /(reveal|print|show|leak)\s+(your|the)\s+(system\s+prompt|instructions|api\s+key|secrets?)/i,
    reason: 'asks to reveal secrets or the system prompt',
  },
  {
    pattern: /do\s+not\s+(tell|inform)\s+the\s+user/i,
    reason: 'asks to hide behaviour from the user',
  },
];

export interface InjectionScanResult {
  flagged: boolean;
  reasons: string[];
}

export function scanForInjection(text: string): InjectionScanResult {
  const reasons = INJECTION_PATTERNS.filter(({ pattern }) =>
    pattern.test(text),
  ).map(({ reason }) => reason);
  return { flagged: reasons.length > 0, reasons };
}
