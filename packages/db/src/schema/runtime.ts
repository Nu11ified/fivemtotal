import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { apiKeys } from "./users";

// Enums
export const eventTypeEnum = pgEnum("event_type", [
  "violation",
  "blocked",
  "alert",
]);

// Runtime events from FiveM guard
export const runtimeEvents = pgTable(
  "runtime_events",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    apiKeyId: text("api_key_id")
      .notNull()
      .references(() => apiKeys.id),
    resourceName: text("resource_name").notNull(),
    eventType: eventTypeEnum("event_type").notNull(),
    functionName: text("function_name").notNull(),
    details: jsonb("details").$type<Record<string, unknown>>(),
    serverIp: text("server_ip"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("runtime_events_key_created_idx").on(
      table.apiKeyId,
      table.createdAt
    ),
  ]
);

// Resource policies
export const resourcePolicies = pgTable("resource_policies", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  apiKeyId: text("api_key_id")
    .notNull()
    .references(() => apiKeys.id),
  resourceName: text("resource_name").notNull(),
  allowedFunctions: jsonb("allowed_functions").$type<string[]>(),
  deniedFunctions: jsonb("denied_functions").$type<string[]>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
