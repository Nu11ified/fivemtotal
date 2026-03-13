CREATE TYPE "public"."finding_category" AS ENUM('loader', 'propagator', 'exfil', 'host_abuse', 'obfuscation', 'ioc_match');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('critical', 'high', 'medium', 'low', 'info');--> statement-breakpoint
CREATE TYPE "public"."verdict_status" AS ENUM('malicious', 'suspicious', 'safe', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'cancelled', 'past_due');--> statement-breakpoint
CREATE TYPE "public"."tier" AS ENUM('free', 'paid');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'analyst', 'user');--> statement-breakpoint
CREATE TYPE "public"."file_type" AS ENUM('lua', 'js', 'manifest', 'binary', 'other');--> statement-breakpoint
CREATE TYPE "public"."scan_status" AS ENUM('queued', 'processing', 'completed', 'failed', 'timed_out');--> statement-breakpoint
CREATE TYPE "public"."hash_list" AS ENUM('blacklist', 'warning', 'safe', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."hash_type" AS ENUM('file', 'archive');--> statement-breakpoint
CREATE TYPE "public"."ioc_type" AS ENUM('domain', 'url', 'url_pattern', 'hash', 'regex');--> statement-breakpoint
CREATE TYPE "public"."review_action" AS ENUM('blacklist', 'warning_list', 'safe_list', 'release', 'revoke', 'escalate');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('violation', 'blocked', 'alert');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"details" jsonb,
	"ip_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "findings" (
	"id" text PRIMARY KEY NOT NULL,
	"scan_job_id" text NOT NULL,
	"artifact_file_id" text NOT NULL,
	"rule_id" text,
	"category" "finding_category" NOT NULL,
	"severity" "severity" NOT NULL,
	"confidence" integer NOT NULL,
	"title" text NOT NULL,
	"evidence_snippet" text,
	"decoded_content" text,
	"extracted_urls" jsonb,
	"extracted_domains" jsonb,
	"line_number" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verdicts" (
	"id" text PRIMARY KEY NOT NULL,
	"artifact_id" text NOT NULL,
	"status" "verdict_status" NOT NULL,
	"severity" "severity" NOT NULL,
	"confidence" integer NOT NULL,
	"summary" text NOT NULL,
	"reviewer_id" text,
	"auto_generated" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"key_hash" text NOT NULL,
	"name" text NOT NULL,
	"tier" "tier" DEFAULT 'free' NOT NULL,
	"daily_usage_count" integer DEFAULT 0 NOT NULL,
	"daily_usage_reset_at" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"plan" "tier" DEFAULT 'free' NOT NULL,
	"polar_customer_id" text,
	"polar_subscription_id" text,
	"current_period_end" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "artifact_files" (
	"id" text PRIMARY KEY NOT NULL,
	"artifact_id" text NOT NULL,
	"file_path" text NOT NULL,
	"sha256_raw" text NOT NULL,
	"sha256_normalized" text,
	"file_size" integer NOT NULL,
	"file_type" "file_type" DEFAULT 'other' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artifacts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"original_filename" text NOT NULL,
	"sha256" text NOT NULL,
	"file_size" integer NOT NULL,
	"storage_path" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scan_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"artifact_id" text NOT NULL,
	"user_id" text,
	"status" "scan_status" DEFAULT 'queued' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"worker_id" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hash_reputation" (
	"id" text PRIMARY KEY NOT NULL,
	"sha256" text NOT NULL,
	"hash_type" "hash_type" NOT NULL,
	"list" "hash_list" DEFAULT 'unknown' NOT NULL,
	"malware_family_id" text,
	"source" text NOT NULL,
	"analyst_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	CONSTRAINT "hash_reputation_sha256_type_uniq" UNIQUE("sha256","hash_type")
);
--> statement-breakpoint
CREATE TABLE "ioc_indicators" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "ioc_type" NOT NULL,
	"value" text NOT NULL,
	"malware_family_id" text,
	"confidence" integer NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "malware_families" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"first_seen" timestamp,
	"last_seen" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "malware_families_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "review_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"verdict_id" text NOT NULL,
	"reviewer_id" text NOT NULL,
	"action" "review_action" NOT NULL,
	"previous_status" text,
	"new_status" text,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rules" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"severity" text NOT NULL,
	"pattern" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_policies" (
	"id" text PRIMARY KEY NOT NULL,
	"api_key_id" text NOT NULL,
	"resource_name" text NOT NULL,
	"allowed_functions" jsonb,
	"denied_functions" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runtime_events" (
	"id" text PRIMARY KEY NOT NULL,
	"api_key_id" text NOT NULL,
	"resource_name" text NOT NULL,
	"event_type" "event_type" NOT NULL,
	"function_name" text NOT NULL,
	"details" jsonb,
	"server_ip" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_scan_job_id_scan_jobs_id_fk" FOREIGN KEY ("scan_job_id") REFERENCES "public"."scan_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_artifact_file_id_artifact_files_id_fk" FOREIGN KEY ("artifact_file_id") REFERENCES "public"."artifact_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_rule_id_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verdicts" ADD CONSTRAINT "verdicts_artifact_id_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."artifacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verdicts" ADD CONSTRAINT "verdicts_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact_files" ADD CONSTRAINT "artifact_files_artifact_id_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."artifacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_jobs" ADD CONSTRAINT "scan_jobs_artifact_id_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."artifacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_jobs" ADD CONSTRAINT "scan_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hash_reputation" ADD CONSTRAINT "hash_reputation_malware_family_id_malware_families_id_fk" FOREIGN KEY ("malware_family_id") REFERENCES "public"."malware_families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ioc_indicators" ADD CONSTRAINT "ioc_indicators_malware_family_id_malware_families_id_fk" FOREIGN KEY ("malware_family_id") REFERENCES "public"."malware_families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_actions" ADD CONSTRAINT "review_actions_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_policies" ADD CONSTRAINT "resource_policies_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runtime_events" ADD CONSTRAINT "runtime_events_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "findings_scan_severity_idx" ON "findings" USING btree ("scan_job_id","severity");--> statement-breakpoint
CREATE INDEX "artifact_files_sha256_raw_idx" ON "artifact_files" USING btree ("sha256_raw");--> statement-breakpoint
CREATE INDEX "scan_jobs_queue_idx" ON "scan_jobs" USING btree ("status","priority","created_at");--> statement-breakpoint
CREATE INDEX "ioc_indicators_type_value_idx" ON "ioc_indicators" USING btree ("type","value");--> statement-breakpoint
CREATE INDEX "runtime_events_key_created_idx" ON "runtime_events" USING btree ("api_key_id","created_at");