/**
 * string.char deobfuscator.
 *
 * Detects patterns like string.char(72, 101, 108, 108, 111)
 * and folds them into string literals: "Hello"
 */
export function deobfuscateStringChar(source: string): string {
  // Match string.char(N, N, N, ...) calls
  const stringCharRegex = /string\.char\s*\(\s*((?:\d+\s*,\s*)*\d+)\s*\)/g;

  return source.replace(stringCharRegex, (match, args: string) => {
    try {
      const codes = args.split(",").map((s) => parseInt(s.trim(), 10));

      // Validate all are valid ASCII/printable
      if (codes.some((c) => isNaN(c) || c < 0 || c > 255)) {
        return match;
      }

      const str = codes.map((c) => String.fromCharCode(c)).join("");

      // Only replace if result is printable
      if (/^[\x20-\x7E\n\r\t]+$/.test(str)) {
        return `"${str.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")}"`;
      }
    } catch {
      // Parse error
    }

    return match;
  });
}
