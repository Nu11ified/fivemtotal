/**
 * Base64 detector and decoder.
 *
 * Detects base64-encoded strings and decodes them inline.
 * Only decodes strings that appear to be intentionally base64-encoded
 * (minimum length, valid charset, decodable to printable text).
 */
export function decodeBase64Strings(source: string): string {
  // Match quoted strings that look like base64
  // Minimum 20 chars to avoid false positives
  const base64Regex = /(['"])([A-Za-z0-9+/]{20,}={0,2})\1/g;

  return source.replace(base64Regex, (match, quote: string, encoded: string) => {
    try {
      // Validate base64 length (must be multiple of 4 or with padding)
      if (encoded.length % 4 !== 0 && !encoded.endsWith("=")) {
        return match;
      }

      const decoded = atob(encoded);

      // Only replace if decoded text is mostly printable ASCII
      const printableCount = [...decoded].filter(
        (c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) <= 126,
      ).length;
      const printableRatio = printableCount / decoded.length;

      if (printableRatio > 0.8 && decoded.length > 0) {
        // Escape the decoded string for Lua
        const escaped = decoded
          .replace(/\\/g, "\\\\")
          .replace(/"/g, '\\"')
          .replace(/'/g, "\\'")
          .replace(/\n/g, "\\n")
          .replace(/\r/g, "\\r")
          .replace(/\t/g, "\\t");

        return `${quote}${escaped}${quote} --[[base64:${encoded.slice(0, 30)}...]]`;
      }
    } catch {
      // Not valid base64
    }

    return match;
  });
}
