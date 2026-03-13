import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users";

// Enums
export const scanStatusEnum = pgEnum("scan_status", [
  "queued",
  "processing",
  "completed",
  "failed",
  "timed_out",
]);
export const fileTypeEnum = pgEnum("file_type", [
  "lua",
  "js",
  "manifest",
  "binary",
  "other",
]);

// Artifacts
export const artifacts = pgTable("artifacts", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id),
  originalFilename: text("original_filename").notNull(),
  sha256: text("sha256").notNull(),
  fileSize: integer("file_size").notNull(),
  storagePath: text("storage_path").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Artifact files (individual files extracted from archive)
export const artifactFiles = pgTable(
  "artifact_files",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    artifactId: text("artifact_id")
      .notNull()
      .references(() => artifacts.id),
    filePath: text("file_path").notNull(),
    sha256Raw: text("sha256_raw").notNull(),
    sha256Normalized: text("sha256_normalized"),
    fileSize: integer("file_size").notNull(),
    fileType: fileTypeEnum("file_type").notNull().default("other"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("artifact_files_sha256_raw_idx").on(table.sha256Raw),
  ]
);

// Scan jobs
export const scanJobs = pgTable(
  "scan_jobs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    artifactId: text("artifact_id")
      .notNull()
      .references(() => artifacts.id),
    userId: text("user_id").references(() => users.id),
    status: scanStatusEnum("status").notNull().default("queued"),
    priority: integer("priority").notNull().default(0),
    workerId: text("worker_id"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("scan_jobs_queue_idx").on(
      table.status,
      table.priority,
      table.createdAt
    ),
  ]
);
