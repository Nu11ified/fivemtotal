/**
 * URL and domain extractor.
 *
 * Extracts URLs and domain names from normalized/deobfuscated output
 * using regex patterns.
 */

export interface ExtractedUrl {
  url: string;
  domain: string;
  line: number;
}

/**
 * Extract all URLs from source content.
 */
export function extractUrls(source: string): ExtractedUrl[] {
  const results: ExtractedUrl[] = [];
  const seen = new Set<string>();
  const lines = source.split("\n");

  const urlRegex = /https?:\/\/[^\s'"<>\]\)}{,\\]+/gi;

  for (let i = 0; i < lines.length; i++) {
    const matches = lines[i].matchAll(urlRegex);
    for (const match of matches) {
      const url = match[0].replace(/[.;,]+$/, ""); // Strip trailing punctuation
      if (seen.has(url)) continue;
      seen.add(url);

      let domain = "";
      try {
        domain = new URL(url).hostname;
      } catch {
        // Try to extract domain manually
        const domainMatch = url.match(/https?:\/\/([^/:]+)/);
        if (domainMatch) domain = domainMatch[1];
      }

      results.push({ url, domain, line: i + 1 });
    }
  }

  return results;
}

/**
 * Extract domains from source content (including those not in full URLs).
 */
export function extractDomains(source: string): string[] {
  const domains = new Set<string>();

  // Extract from URLs first
  const urls = extractUrls(source);
  for (const { domain } of urls) {
    if (domain) domains.add(domain);
  }

  // Also look for bare domain patterns in strings
  // Match domain-like patterns: word.word.tld
  const domainRegex = /\b([a-zA-Z0-9][-a-zA-Z0-9]*\.)+[a-zA-Z]{2,}\b/g;
  const matches = source.match(domainRegex) || [];

  for (const match of matches) {
    // Filter out common false positives
    if (
      match.endsWith(".lua") ||
      match.endsWith(".js") ||
      match.endsWith(".json") ||
      match.endsWith(".txt") ||
      match.endsWith(".cfg") ||
      match.endsWith(".xml") ||
      match.endsWith(".html") ||
      match.endsWith(".css")
    ) {
      continue;
    }
    domains.add(match.toLowerCase());
  }

  return [...domains];
}
