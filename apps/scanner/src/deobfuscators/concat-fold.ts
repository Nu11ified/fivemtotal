/**
 * Lua concatenation folder.
 *
 * Detects patterns like "a" .. "b" .. "c" and folds them
 * into a single string: "abc"
 */
export function foldConcatenation(source: string): string {
  // Repeatedly fold adjacent string concatenations until stable.
  // Pattern: "str1" .. "str2"
  // Supports both single and double quotes.
  let prev = "";
  let current = source;

  // Limit iterations to prevent infinite loops
  for (let i = 0; i < 100; i++) {
    prev = current;

    // Fold "a" .. "b" -> "ab"
    current = current.replace(
      /(['"])([^'"]*?)\1\s*\.\.\s*(['"])([^'"]*?)\3/g,
      (_match, q1: string, s1: string, _q2: string, s2: string) => {
        // Use the first quote style
        return `${q1}${s1}${s2}${q1}`;
      },
    );

    if (current === prev) break;
  }

  return current;
}
