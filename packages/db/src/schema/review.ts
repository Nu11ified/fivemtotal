import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";
import { users } from "./users";

// Enums
export const reviewActionEnum = pgEnum("review_action", [
  "blacklist",
  "warning_list",
  "safe_list",
  "release",
  "revoke",
  "escalate",
]);

// Rules (declared before review_actions since findings references it)
export const rules = pgTable("rules", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  severity: text("severity").notNull(),
  pattern: jsonb("pattern").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// Review actions
// Note: verdict_id references verdicts table from findings.ts
// We use text() without FK here to avoid circular dependency; enforced at app level
export const reviewActions = pgTable("review_actions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  verdictId: text("verdict_id").notNull(),
  reviewerId: text("reviewer_id")
    .notNull()
    .references(() => users.id),
  action: reviewActionEnum("action").notNull(),
  previousStatus: text("previous_status"),
  newStatus: text("new_status"),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
