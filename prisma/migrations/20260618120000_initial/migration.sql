CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGER', 'SUPERVISOR', 'INSPECTOR', 'VIEWER');
CREATE TYPE "InspectionStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'APPROVED', 'REJECTED', 'CANCELED');
CREATE TYPE "Shift" AS ENUM ('DAY', 'NIGHT', 'OTHER');
CREATE TYPE "ChecklistItemType" AS ENUM ('BOOLEAN', 'TEXT', 'NUMBER', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'PHOTO', 'SIGNATURE');
CREATE TYPE "AnswerStatus" AS ENUM ('COMPLIANT', 'NON_COMPLIANT', 'NOT_APPLICABLE', 'NOT_ANSWERED');
CREATE TYPE "EvidenceType" AS ENUM ('PHOTO', 'VIDEO', 'AUDIO', 'DOCUMENT', 'SIGNATURE');
CREATE TYPE "OccurrenceSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "OccurrenceStatus" AS ENUM ('OPEN', 'IN_ANALYSIS', 'RESOLVED', 'DISMISSED');
CREATE TYPE "ActionPlanStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELED');

CREATE TABLE "clients" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "legal_name" TEXT NOT NULL,
  "trade_name" TEXT,
  "document" TEXT,
  "contract_code" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "posts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "client_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "address" TEXT,
  "city" TEXT,
  "state" VARCHAR(2),
  "latitude" DECIMAL(10,7),
  "longitude" DECIMAL(10,7),
  "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "collaborators" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "post_id" UUID,
  "registration" TEXT,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "job_title" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "hired_at" DATE,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "collaborators_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "users" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "supabase_auth_id" UUID,
  "client_id" UUID,
  "collaborator_id" UUID,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
  "permissions" JSONB,
  "is_developer" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "last_login_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "operational_state" (
  "id" TEXT NOT NULL DEFAULT 'main',
  "data" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updated_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "operational_state_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "checklist_templates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "client_id" UUID,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "checklist_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "checklist_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "checklist_id" UUID NOT NULL,
  "parent_id" UUID,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "type" "ChecklistItemType" NOT NULL DEFAULT 'BOOLEAN',
  "required" BOOLEAN NOT NULL DEFAULT true,
  "position" INTEGER NOT NULL,
  "options" JSONB,
  "weight" DECIMAL(8,2),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "checklist_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inspections" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "post_id" UUID NOT NULL,
  "checklist_id" UUID NOT NULL,
  "created_by_id" UUID NOT NULL,
  "inspector_collaborator_id" UUID,
  "approved_by_id" UUID,
  "reference" TEXT NOT NULL,
  "status" "InspectionStatus" NOT NULL DEFAULT 'DRAFT',
  "shift" "Shift" NOT NULL DEFAULT 'OTHER',
  "scheduled_at" TIMESTAMPTZ(6),
  "started_at" TIMESTAMPTZ(6),
  "completed_at" TIMESTAMPTZ(6),
  "approved_at" TIMESTAMPTZ(6),
  "score" DECIMAL(8,2),
  "notes" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "inspections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inspection_responses" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "inspection_id" UUID NOT NULL,
  "checklist_item_id" UUID NOT NULL,
  "status" "AnswerStatus" NOT NULL DEFAULT 'NOT_ANSWERED',
  "value_text" TEXT,
  "value_number" DECIMAL(18,4),
  "value_boolean" BOOLEAN,
  "value_json" JSONB,
  "comment" TEXT,
  "answered_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "inspection_responses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "occurrences" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "inspection_id" UUID NOT NULL,
  "reported_by_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "severity" "OccurrenceSeverity" NOT NULL DEFAULT 'MEDIUM',
  "status" "OccurrenceStatus" NOT NULL DEFAULT 'OPEN',
  "detected_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMPTZ(6),
  "resolution" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "occurrences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "evidences" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "inspection_id" UUID NOT NULL,
  "response_id" UUID,
  "occurrence_id" UUID,
  "type" "EvidenceType" NOT NULL DEFAULT 'PHOTO',
  "bucket" TEXT NOT NULL DEFAULT 'evidencias',
  "storage_path" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size_bytes" BIGINT,
  "checksum" TEXT,
  "caption" TEXT,
  "captured_at" TIMESTAMPTZ(6),
  "latitude" DECIMAL(10,7),
  "longitude" DECIMAL(10,7),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "evidences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "action_plans" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "occurrence_id" UUID NOT NULL,
  "assigned_to_id" UUID,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" "ActionPlanStatus" NOT NULL DEFAULT 'OPEN',
  "priority" INTEGER NOT NULL DEFAULT 3,
  "due_at" TIMESTAMPTZ(6),
  "started_at" TIMESTAMPTZ(6),
  "completed_at" TIMESTAMPTZ(6),
  "completion_notes" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "action_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "actor_user_id" UUID,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entity_id" TEXT,
  "before" JSONB,
  "after" JSONB,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "request_id" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "clients_document_key" ON "clients"("document");
CREATE UNIQUE INDEX "posts_client_id_code_key" ON "posts"("client_id", "code");
CREATE INDEX "posts_client_id_active_idx" ON "posts"("client_id", "active");
CREATE UNIQUE INDEX "collaborators_registration_key" ON "collaborators"("registration");
CREATE UNIQUE INDEX "collaborators_email_key" ON "collaborators"("email");
CREATE INDEX "collaborators_post_id_active_idx" ON "collaborators"("post_id", "active");
CREATE UNIQUE INDEX "users_supabase_auth_id_key" ON "users"("supabase_auth_id");
CREATE UNIQUE INDEX "users_collaborator_id_key" ON "users"("collaborator_id");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_client_id_active_idx" ON "users"("client_id", "active");
CREATE UNIQUE INDEX "checklist_templates_client_id_name_version_key" ON "checklist_templates"("client_id", "name", "version");
CREATE UNIQUE INDEX "checklist_items_checklist_id_code_key" ON "checklist_items"("checklist_id", "code");
CREATE UNIQUE INDEX "checklist_items_checklist_id_position_key" ON "checklist_items"("checklist_id", "position");
CREATE INDEX "checklist_items_parent_id_idx" ON "checklist_items"("parent_id");
CREATE UNIQUE INDEX "inspections_reference_key" ON "inspections"("reference");
CREATE INDEX "inspections_post_id_status_scheduled_at_idx" ON "inspections"("post_id", "status", "scheduled_at");
CREATE INDEX "inspections_created_by_id_created_at_idx" ON "inspections"("created_by_id", "created_at");
CREATE UNIQUE INDEX "inspection_responses_inspection_id_checklist_item_id_key" ON "inspection_responses"("inspection_id", "checklist_item_id");
CREATE INDEX "inspection_responses_status_idx" ON "inspection_responses"("status");
CREATE UNIQUE INDEX "occurrences_code_key" ON "occurrences"("code");
CREATE INDEX "occurrences_inspection_id_status_severity_idx" ON "occurrences"("inspection_id", "status", "severity");
CREATE UNIQUE INDEX "evidences_bucket_storage_path_key" ON "evidences"("bucket", "storage_path");
CREATE INDEX "evidences_inspection_id_created_at_idx" ON "evidences"("inspection_id", "created_at");
CREATE INDEX "evidences_occurrence_id_idx" ON "evidences"("occurrence_id");
CREATE INDEX "action_plans_occurrence_id_status_idx" ON "action_plans"("occurrence_id", "status");
CREATE INDEX "action_plans_assigned_to_id_due_at_idx" ON "action_plans"("assigned_to_id", "due_at");
CREATE INDEX "audit_logs_entity_entity_id_created_at_idx" ON "audit_logs"("entity", "entity_id", "created_at");
CREATE INDEX "audit_logs_actor_user_id_created_at_idx" ON "audit_logs"("actor_user_id", "created_at");

ALTER TABLE "posts"
  ADD CONSTRAINT "posts_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "collaborators"
  ADD CONSTRAINT "collaborators_post_id_fkey"
  FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "users"
  ADD CONSTRAINT "users_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "users_collaborator_id_fkey"
  FOREIGN KEY ("collaborator_id") REFERENCES "collaborators"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "checklist_templates"
  ADD CONSTRAINT "checklist_templates_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "checklist_items"
  ADD CONSTRAINT "checklist_items_checklist_id_fkey"
  FOREIGN KEY ("checklist_id") REFERENCES "checklist_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "checklist_items_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "checklist_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "inspections"
  ADD CONSTRAINT "inspections_post_id_fkey"
  FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "inspections_checklist_id_fkey"
  FOREIGN KEY ("checklist_id") REFERENCES "checklist_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "inspections_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "inspections_inspector_collaborator_id_fkey"
  FOREIGN KEY ("inspector_collaborator_id") REFERENCES "collaborators"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "inspections_approved_by_id_fkey"
  FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "inspection_responses"
  ADD CONSTRAINT "inspection_responses_inspection_id_fkey"
  FOREIGN KEY ("inspection_id") REFERENCES "inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "inspection_responses_checklist_item_id_fkey"
  FOREIGN KEY ("checklist_item_id") REFERENCES "checklist_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "occurrences"
  ADD CONSTRAINT "occurrences_inspection_id_fkey"
  FOREIGN KEY ("inspection_id") REFERENCES "inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "occurrences_reported_by_id_fkey"
  FOREIGN KEY ("reported_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "evidences"
  ADD CONSTRAINT "evidences_inspection_id_fkey"
  FOREIGN KEY ("inspection_id") REFERENCES "inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "evidences_response_id_fkey"
  FOREIGN KEY ("response_id") REFERENCES "inspection_responses"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "evidences_occurrence_id_fkey"
  FOREIGN KEY ("occurrence_id") REFERENCES "occurrences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "action_plans"
  ADD CONSTRAINT "action_plans_occurrence_id_fkey"
  FOREIGN KEY ("occurrence_id") REFERENCES "occurrences"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "action_plans_assigned_to_id_fkey"
  FOREIGN KEY ("assigned_to_id") REFERENCES "collaborators"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
