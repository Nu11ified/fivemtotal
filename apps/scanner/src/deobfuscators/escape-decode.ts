/**
 * Escape sequence decoder.
 *
 * Detects \xNN escape sequences in string literals and
 * converts them to readable characters.
 */
export function decodeEscapeSequences(source: string): string {
  // Match string literals containing \xNN escape sequences
  const stringRegex = /(['"])((\\x[0-9a-fA-F]{2}|\\[0-9]{1,3}|[^'"])*?)\1/g;

  return source.replace(stringRegex, (match, quote: string, inner: string) => {
    // Only process if there are actual escape sequences
    if (!inner.includes("\\x") && !/\\[0-9]/.test(inner)) {
      return match;
    }

    let decoded = inner;

    // Decode \xNN hex escapes
    decoded = decoded.replace(/\\x([0-9a-fA-F]{2})/g, (_m, hex: string) => {
      const code = parseInt(hex, 16);
      if (code >= 32 && code <= 126) {
        return String.fromCharCode(code);
      }
      return _m; // Keep non-printable as-is
    });

    // Decode \NNN decimal escapes (Lua style)
    decoded = decoded.replace(/\\(\d{1,3})/g, (_m, digits: string) => {
      const code = parseInt(digits, 10);
      if (code >= 32 && code <= 126) {
        return String.fromCharCode(code);
      }
      return _m;
    });

    return `${quote}${decoded}${quote}`;
  });
}
