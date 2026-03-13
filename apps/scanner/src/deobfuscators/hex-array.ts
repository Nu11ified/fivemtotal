/**
 * Hex array deobfuscator.
 *
 * Detects patterns like {0x48, 0x65, 0x6C, 0x6C, 0x6F}
 * and reconstructs them into string literals.
 */
export function deobfuscateHexArrays(source: string): string {
  // Match table constructors with hex values: {0x48, 0x65, ...}
  const hexArrayRegex = /\{(\s*0x[0-9a-fA-F]+\s*(?:,\s*0x[0-9a-fA-F]+\s*)*,?\s*)\}/g;

  return source.replace(hexArrayRegex, (match, inner: string) => {
    const hexValues = inner.match(/0x[0-9a-fA-F]+/g);
    if (!hexValues || hexValues.length < 2) return match;

    try {
      const chars = hexValues.map((h) => {
        const code = parseInt(h, 16);
        if (code < 0 || code > 127) return null; // Only ASCII
        return String.fromCharCode(code);
      });

      if (chars.some((c) => c === null)) return match;

      const str = chars.join("");
      // Only replace if it looks like it could be a meaningful string
      if (/^[\x20-\x7E]+$/.test(str)) {
        return `"${str}"`;
      }
    } catch {
      // Parsing error, leave as-is
    }

    return match;
  });
}
