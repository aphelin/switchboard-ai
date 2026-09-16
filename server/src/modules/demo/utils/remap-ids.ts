/** Shorter strings are never rewritten: they could occur in ordinary text. AI SDK ids are 16 characters, uuids 36. */
const MIN_ID_LENGTH = 16;

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Builds a function that rewrites every occurrence of an old id inside a JSON
 * value. Copied rows reference each other by id (tool outputs name generations
 * and documents, message metadata names the conversation, image URLs name the
 * generation), so a copy must point at the other copies, not at the originals.
 */
export function createIdRemapper(
  ids: ReadonlyMap<string, string>,
): <T>(value: T) => T {
  const keys = [...ids.keys()]
    .filter((id) => id.length >= MIN_ID_LENGTH)
    // Longest first, so an id that contains another is replaced whole.
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp);
  if (keys.length === 0) return (value) => value;

  const pattern = new RegExp(keys.join('|'), 'g');
  return <T>(value: T): T => {
    if (value === null || value === undefined) return value;
    const json = JSON.stringify(value).replace(
      pattern,
      (match) => ids.get(match) ?? match,
    );
    return JSON.parse(json) as T;
  };
}
