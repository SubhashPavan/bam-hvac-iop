/**
 * Sometimes the agent returns a stringified JSON object in
 * `summary.narrative` instead of plain prose. This helper pulls the
 * human-readable title and narrative out so the UI never renders raw
 * `{"title": "..."}` braces to the user.
 *
 * Handles three shapes seen in the wild:
 *   1. plain narrative text                          → return as-is
 *   2. raw JSON: `{"title": "...", "narrative": "..."}`
 *   3. fenced JSON: ```json\n{"title": "..."}\n```
 *
 * Falls back to regex extraction when `JSON.parse` chokes on the
 * narrative containing unescaped quotes (which the model sometimes
 * emits when it forgets it's serializing JSON).
 */
export function extractTitleAndNarrative(
  fallbackTitle: string,
  rawNarrative: string,
): { title: string; narrative: string } {
  const text = (rawNarrative || '').trim();
  if (!text) return { title: fallbackTitle, narrative: '' };

  // Strip a markdown code fence if the whole payload is wrapped in one.
  let cleaned = text;
  const fence = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) cleaned = fence[1].trim();

  // Quick exit: if it doesn't look JSON-shaped, it's already plain prose.
  if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
    return { title: fallbackTitle, narrative: text };
  }

  // First try: strict JSON parse.
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === 'object') {
      return {
        title: parsed.title || fallbackTitle,
        narrative: parsed.narrative || parsed.summary || cleaned,
      };
    }
  } catch {
    /* fall through to regex */
  }

  // Fallback: pull the title and narrative out via regex. Tolerant of
  // unescaped quotes inside the narrative as long as the keys are
  // double-quoted at the top level.
  const titleMatch = cleaned.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const narrativeMatch = cleaned.match(/"narrative"\s*:\s*"([\s\S]*?)"\s*(?:[,}]|$)/);
  const extractedTitle = titleMatch ? titleMatch[1].replace(/\\"/g, '"') : '';
  const extractedNarrative = narrativeMatch
    ? narrativeMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n')
    : '';

  if (extractedTitle || extractedNarrative) {
    return {
      title: extractedTitle || fallbackTitle,
      narrative: extractedNarrative || text,
    };
  }

  // Last resort — show the raw text rather than a confusing empty card.
  return { title: fallbackTitle, narrative: text };
}
