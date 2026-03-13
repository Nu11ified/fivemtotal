import { db, iocIndicators, malwareFamilies } from "@fivemtotal/db";
import { eq, inArray } from "drizzle-orm";
import type { Finding, Inventory } from "../types";

/**
 * Known malicious panel URL patterns.
 */
const KNOWN_PANEL_PATTERNS: Array<{
  pattern: RegExp;
  family: string;
  description: string;
}> = [
  {
    pattern: /_i\/i\?to=/,
    family: "Cipher",
    description: "Cipher panel callback URL",
  },
];

/**
 * Discord webhook pattern for token/data exfiltration.
 */
const DISCORD_WEBHOOK_PATTERN =
  /discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+/i;

/**
 * Phase 5: IOC matching.
 *
 * 1. Collect all URLs/domains from Phase 3 + Phase 4 deobfuscation findings
 * 2. Query ioc_indicators for matches
 * 3. Check known panel URL patterns
 * 4. Check Discord webhook patterns
 * 5. Create findings for each match with malware family attribution
 */
export async function matchIOCs(
  existingFindings: Finding[],
  inventory: Inventory,
  scanJobId: string,
): Promise<Finding[]> {
  const findings: Finding[] = [];

  // Collect all URLs and domains from existing findings
  const allUrls = new Set<string>();
  const allDomains = new Set<string>();

  for (const f of existingFindings) {
    if (f.extractedUrls) {
      for (const url of f.extractedUrls) allUrls.add(url);
    }
    if (f.extractedDomains) {
      for (const domain of f.extractedDomains) allDomains.add(domain);
    }
  }

  if (allUrls.size === 0 && allDomains.size === 0) {
    return findings;
  }

  // Get a default artifact file ID for IOC findings
  const defaultArtifactFileId =
    inventory.files[0]?.artifactFileId ?? inventory.files[0]?.sha256 ?? "unknown";

  // 1. Check known panel URL patterns
  for (const url of allUrls) {
    for (const panel of KNOWN_PANEL_PATTERNS) {
      if (panel.pattern.test(url)) {
        findings.push({
          scanJobId,
          artifactFileId: defaultArtifactFileId,
          category: "ioc_match",
          severity: "critical",
          confidence: 95,
          title: `Known ${panel.family} panel URL detected`,
          evidenceSnippet: url,
          extractedUrls: [url],
        });
      }
    }
  }

  // 2. Check Discord webhook pattern
  for (const url of allUrls) {
    if (DISCORD_WEBHOOK_PATTERN.test(url)) {
      findings.push({
        scanJobId,
        artifactFileId: defaultArtifactFileId,
        category: "exfil",
        severity: "critical",
        confidence: 90,
        title: "Discord webhook exfiltration endpoint detected",
        evidenceSnippet: url,
        extractedUrls: [url],
        extractedDomains: ["discord.com"],
      });
    }
  }

  // 3. Query IOC indicators from database
  const now = new Date();

  // Query domain IOCs
  if (allDomains.size > 0) {
    const domainList = [...allDomains];
    const domainIOCs = await db
      .select({
        id: iocIndicators.id,
        type: iocIndicators.type,
        value: iocIndicators.value,
        malwareFamilyId: iocIndicators.malwareFamilyId,
        confidence: iocIndicators.confidence,
        source: iocIndicators.source,
      })
      .from(iocIndicators)
      .where(
        eq(iocIndicators.type, "domain"),
      );

    // Match domains against IOC values
    for (const ioc of domainIOCs) {
      for (const domain of domainList) {
        if (domain === ioc.value || domain.endsWith("." + ioc.value)) {
          const familyName = ioc.malwareFamilyId
            ? await getMalwareFamilyName(ioc.malwareFamilyId)
            : null;

          findings.push({
            scanJobId,
            artifactFileId: defaultArtifactFileId,
            category: "ioc_match",
            severity: "critical",
            confidence: ioc.confidence,
            title: familyName
              ? `IOC match: domain ${domain} (${familyName})`
              : `IOC match: known malicious domain ${domain}`,
            evidenceSnippet: `Matched IOC indicator: ${ioc.value} (source: ${ioc.source})`,
            extractedDomains: [domain],
          });
        }
      }
    }
  }

  // Query URL IOCs
  if (allUrls.size > 0) {
    const urlIOCs = await db
      .select({
        id: iocIndicators.id,
        type: iocIndicators.type,
        value: iocIndicators.value,
        malwareFamilyId: iocIndicators.malwareFamilyId,
        confidence: iocIndicators.confidence,
        source: iocIndicators.source,
      })
      .from(iocIndicators)
      .where(
        inArray(iocIndicators.type, ["url", "url_pattern"]),
      );

    for (const ioc of urlIOCs) {
      for (const url of allUrls) {
        let matched = false;

        if (ioc.type === "url") {
          matched = url === ioc.value;
        } else if (ioc.type === "url_pattern") {
          try {
            const regex = new RegExp(ioc.value);
            matched = regex.test(url);
          } catch {
            // Invalid regex in IOC database
            matched = url.includes(ioc.value);
          }
        }

        if (matched) {
          const familyName = ioc.malwareFamilyId
            ? await getMalwareFamilyName(ioc.malwareFamilyId)
            : null;

          findings.push({
            scanJobId,
            artifactFileId: defaultArtifactFileId,
            category: "ioc_match",
            severity: "critical",
            confidence: ioc.confidence,
            title: familyName
              ? `IOC match: URL pattern (${familyName})`
              : `IOC match: known malicious URL`,
            evidenceSnippet: `URL: ${url} matched IOC: ${ioc.value} (source: ${ioc.source})`,
            extractedUrls: [url],
          });
        }
      }
    }
  }

  return findings;
}

/**
 * Look up malware family name by ID.
 */
async function getMalwareFamilyName(id: string): Promise<string | null> {
  const rows = await db
    .select({ name: malwareFamilies.name })
    .from(malwareFamilies)
    .where(eq(malwareFamilies.id, id))
    .limit(1);

  return rows[0]?.name ?? null;
}
