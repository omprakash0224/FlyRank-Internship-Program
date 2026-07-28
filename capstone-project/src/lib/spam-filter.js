// ─── Spam Filter ──────────────────────────────────────────────────────────────
//
// Two-layer defence against automated/spam submissions:
//
//   Layer 1 — Honeypot field (`website`)
//     Hidden from real users via CSS (`display:none`). Bots fill every field,
//     so a non-empty `website` value is a strong spam signal. We silently accept
//     but never store — giving no feedback to help bots adapt.
//
//   Layer 2 — Heuristic content checks on `data` values
//     • Excessive URLs (>3 http/https links in any single value)
//     • All-caps text (>80 % uppercase alphabetic characters)
//     • Known spam trigger keywords
//

/** @type {string[]} */
const SPAM_KEYWORDS = [
  'buy now',
  'click here',
  'free money',
  'make money fast',
  'lose weight',
  'casino',
  'viagra',
  'cialis',
  'poker',
  'crypto earn',
  'investment opportunity',
  'work from home guaranteed',
];

// Pre-compile the keyword regex for performance
const SPAM_KEYWORD_REGEX = new RegExp(
  SPAM_KEYWORDS.map((kw) => kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
  'i'
);

const URL_REGEX = /https?:\/\/[^\s]+/gi;

/**
 * Check whether a submission is likely spam.
 *
 * @param {{ website?: string, data: Record<string, string> }} submission
 * @returns {{ isSpam: boolean, reason: string | null }}
 */
export function checkSpam({ website, data }) {
  // ── Layer 1: Honeypot ──────────────────────────────────────────────────────
  if (website && website.trim().length > 0) {
    return { isSpam: true, reason: 'honeypot' };
  }

  // ── Layer 2: Heuristic content checks ─────────────────────────────────────
  const values = Object.values(data);

  for (const value of values) {
    if (typeof value !== 'string') continue;

    // Check for excessive URLs
    const urlMatches = value.match(URL_REGEX);
    if (urlMatches && urlMatches.length > 3) {
      return { isSpam: true, reason: 'excessive_links' };
    }

    // Check for all-caps (>80% uppercase alphabetic characters)
    const alpha = value.replace(/[^a-zA-Z]/g, '');
    if (alpha.length > 10) {
      const upperRatio = (alpha.match(/[A-Z]/g) ?? []).length / alpha.length;
      if (upperRatio > 0.8) {
        return { isSpam: true, reason: 'all_caps' };
      }
    }

    // Check for known spam keywords
    if (SPAM_KEYWORD_REGEX.test(value)) {
      return { isSpam: true, reason: 'spam_keyword' };
    }
  }

  return { isSpam: false, reason: null };
}
