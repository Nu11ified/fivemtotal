import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  integer,
  index,
  unique,
} from "drizzle-orm/pg-core";

// Enums
export const hashTypeEnum = pgEnum("hash_type", ["file", "archive"]);
export const hashListEnum = pgEnum("hash_list", [
  "blacklist",
  "warning",
  "safe",
  "unknown",
]);
export const iocTypeEnum = pgEnum("ioc_type", [
  "domain",
  "url",
  "url_pattern",
  "hash",
  "regex",
]);

// Malware families (declared first since others reference it)
export const malwareFamilies = pgTable("malware_families", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull().unique(),
  description: text("description"),
  firstSeen: timestamp("first_seen"),
  lastSeen: timestamp("last_seen"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Hash reputation
export const hashReputation = pgTable(
  "hash_reputation",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sha256: text("sha256").notNull(),
    hashType: hashTypeEnum("hash_type").notNull(),
    list: hashListEnum("list").notNull().default("unknown"),
    malwareFamilyId: text("malware_family_id").references(
      () => malwareFamilies.id
    ),
    source: text("source").notNull(),
    analystNote: text("analyst_note"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    expiresAt: timestamp("expires_at"),
  },
  (table) => [
    unique("hash_reputation_sha256_type_uniq").on(table.sha256, table.hashType),
  ]
);

// IOC indicators
export const iocIndicators = pgTable(
  "ioc_indicators",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    type: iocTypeEnum("type").notNull(),
    value: text("value").notNull(),
    malwareFamilyId: text("malware_family_id").references(
      () => malwareFamilies.id
    ),
    confidence: integer("confidence").notNull(),
    source: text("source").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    expiresAt: timestamp("expires_at"),
  },
  (table) => [
    index("ioc_indicators_type_value_idx").on(table.type, table.value),
  ]
);
