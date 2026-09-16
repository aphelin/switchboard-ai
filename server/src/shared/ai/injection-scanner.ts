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
  {
    pattern:
      /(note|message|instructions?|directive|command)\s+(to|for)\s+(the\s+|any\s+)?(ai|assistant|model|llm|chatbot|agent)\b/i,
    reason: 'addresses the AI assistant directly',
  },
  {
    // German and Spanish variants of "ignore the previous instructions".
    pattern:
      /(ignoriere|vergiss)\s+(alle\s+)?(vorherigen|bisherigen|obigen)\s+(anweisungen|regeln)|ignora\s+(todas\s+)?las\s+instrucciones\s+(anteriores|previas)/i,
    reason: 'asks to ignore previous instructions (non-English)',
  },
  {
    pattern:
      /["']?(approved|approval|user_approved)["']?\s*:\s*(true|["']approved["'])/i,
    reason: 'contains a fake tool approval',
  },
];

/** Checked on the original text: shapes that carry data out or hide instructions. */
const RAW_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /!\[[^\]]*\]\(\s*<?https?:\/\//i,
    reason: 'embeds a remote image (possible data exfiltration)',
  },
  {
    pattern: /[​-‍⁠﻿]/,
    reason: 'contains invisible zero-width characters',
  },
  {
    pattern: /(?:[A-Za-z0-9+/]{4}){20,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?/,
    reason: 'contains a long base64 blob (possibly an encoded instruction)',
  },
];

const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
};

/**
 * The text the instruction patterns see: compatibility forms folded (full-width
 * and styled letters), zero-width characters removed, and common digit-for-letter
 * swaps undone inside words, so "1gn0re prev1ous 1nstruct1ons" still matches.
 */
function normalize(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[​-‍⁠﻿­]/g, '')
    .replace(/[a-z]*[013457@$][a-z013457@$]*/gi, (word) =>
      /[a-z]/i.test(word) ? word.replace(/[013457@$]/g, (c) => LEET[c]) : word,
    );
}

export interface InjectionScanResult {
  flagged: boolean;
  reasons: string[];
}

export function scanForInjection(text: string): InjectionScanResult {
  const normalized = normalize(text);
  const reasons = [
    ...INJECTION_PATTERNS.filter(({ pattern }) => pattern.test(normalized)),
    ...RAW_PATTERNS.filter(({ pattern }) => pattern.test(text)),
  ].map(({ reason }) => reason);
  return { flagged: reasons.length > 0, reasons };
}
