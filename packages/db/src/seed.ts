import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { malwareFamilies, iocIndicators } from "./schema/intelligence";
import { rules } from "./schema/review";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

const client = postgres(connectionString);
const db = drizzle(client);

async function seed() {
  console.log("Seeding database...");

  // Seed malware families
  console.log("Seeding malware families...");
  const families = await db
    .insert(malwareFamilies)
    .values([
      {
        name: "cipher-panel",
        description:
          "Remote loader and propagator using PerformHttpRequest + assert(load(...)) chain. Known panel URL patterns include _i/i?to= paths. Propagates by enumerating resources and modifying fxmanifest.lua.",
        firstSeen: new Date("2024-01-01"),
      },
      {
        name: "blum-panel",
        description:
          "Active campaign with loader and exfiltration capabilities. Less public technical documentation available. Tracked as campaign tags with incomplete teardown coverage.",
        firstSeen: new Date("2024-06-01"),
      },
      {
        name: "generic-loader",
        description:
          "Generic remote code loader pattern: fetches code from external URL and executes dynamically without propagation capability.",
      },
      {
        name: "generic-propagator",
        description:
          "Generic propagation pattern: writes to sibling resources without remote fetch. Spreads locally across the server's resource directories.",
      },
      {
        name: "generic-exfiltrator",
        description:
          "Generic exfiltration pattern: accesses server configuration (GetConvar) or sensitive data and sends it to external endpoints.",
      },
      {
        name: "generic-host-escape",
        description:
          "Generic host escape pattern: attempts to execute shell commands or access the underlying operating system from within FiveM context.",
      },
    ])
    .returning();

  const familyMap = Object.fromEntries(families.map((f) => [f.name, f.id]));

  // Seed IOC indicators
  console.log("Seeding IOC indicators...");
  await db.insert(iocIndicators).values([
    {
      type: "domain",
      value: "cipher-panel.xyz",
      malwareFamilyId: familyMap["cipher-panel"],
      confidence: 95,
      source: "community",
    },
    {
      type: "domain",
      value: "blum-panel.me",
      malwareFamilyId: familyMap["blum-panel"],
      confidence: 90,
      source: "community",
    },
    {
      type: "url_pattern",
      value: "_i/i?to=",
      malwareFamilyId: familyMap["cipher-panel"],
      confidence: 90,
      source: "community",
    },
    {
      type: "url_pattern",
      value: "discord.com/api/webhooks",
      malwareFamilyId: null,
      confidence: 60,
      source: "community",
    },
  ]);

  // Seed initial detection rules
  console.log("Seeding detection rules...");
  await db.insert(rules).values([
    {
      name: "detect-remote-loader",
      description:
        "Detects remote code loading pattern: PerformHttpRequest fetching code that is then executed via load/loadstring/assert(load(...))",
      category: "loader",
      severity: "critical",
      pattern: {
        type: "source_sink_pair",
        source: {
          functions: ["PerformHttpRequest"],
        },
        sink: {
          functions: ["load", "loadstring", "assert"],
          pattern: "assert\\s*\\(\\s*load\\s*\\(",
        },
        description: "HTTP fetch followed by dynamic code execution",
      },
    },
    {
      name: "detect-propagator",
      description:
        "Detects cross-resource write patterns: reading from one resource and writing to another, especially modifying fxmanifest.lua or __resource.lua",
      category: "propagator",
      severity: "critical",
      pattern: {
        type: "behavior_combination",
        requires: [
          {
            functions: ["LoadResourceFile", "SaveResourceFile"],
            crossResource: true,
          },
        ],
        indicators: [
          "fxmanifest.lua",
          "__resource.lua",
          "GetNumResources",
          "GetResourceByFindIndex",
        ],
        description: "Cross-resource file manipulation",
      },
    },
    {
      name: "detect-exfil",
      description:
        "Detects configuration exfiltration: accessing server convars or sensitive data and sending it to external endpoints",
      category: "exfil",
      severity: "critical",
      pattern: {
        type: "source_sink_pair",
        source: {
          functions: ["GetConvar", "GetConvarInt"],
        },
        sink: {
          functions: ["PerformHttpRequest"],
        },
        description:
          "Server configuration access followed by outbound HTTP request",
      },
    },
    {
      name: "detect-host-escape",
      description:
        "Detects attempts to escape FiveM sandbox and execute arbitrary system commands",
      category: "host_abuse",
      severity: "critical",
      pattern: {
        type: "function_call",
        functions: ["os.execute", "io.popen", "os.getenv"],
        description: "Direct system command execution or environment access",
      },
    },
    {
      name: "detect-obfuscated-loader",
      description:
        "Detects obfuscated code loading patterns: hex arrays, string.char sequences, or encoded strings that are decoded and then executed",
      category: "obfuscation",
      severity: "high",
      pattern: {
        type: "obfuscation_pattern",
        indicators: [
          {
            pattern: "\\\\x[0-9a-fA-F]{2}",
            minOccurrences: 10,
            description: "Hex escape sequences",
          },
          {
            pattern: "string\\.char\\s*\\(",
            nearby: ["load", "loadstring"],
            description: "string.char near dynamic execution",
          },
          {
            pattern: "\\{\\s*0x[0-9a-fA-F]+",
            minOccurrences: 5,
            description: "Hex array initialization",
          },
        ],
        sinks: ["load", "loadstring", "assert"],
        description:
          "Obfuscated payload decoding followed by dynamic execution",
      },
    },
  ]);

  console.log("Seed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
