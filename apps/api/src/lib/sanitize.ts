/**
 * Simple HTML tag stripping for user-provided text fields (analyst notes, comments, etc.).
 * Removes all HTML tags to prevent stored XSS.
 */
export function sanitizeHtml(input: string): string {
  return input.replace(/<[^>]*>/g, "").trim();
}
