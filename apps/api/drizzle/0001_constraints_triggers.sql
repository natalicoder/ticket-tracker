-- Constraints and behaviour that the drizzle schema cannot express.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
-- Emails are stored trimmed + lowercased by the API; the index makes uniqueness case-insensitive regardless.
CREATE UNIQUE INDEX "users_email_lower" ON "users" (lower("email"));
--> statement-breakpoint
CREATE UNIQUE INDEX "teams_name_lower" ON "teams" (lower(btrim("name")));
--> statement-breakpoint
ALTER TABLE "email_tokens" ADD CONSTRAINT "email_tokens_purpose_check" CHECK ("purpose" IN ('verify', 'reset'));
--> statement-breakpoint
ALTER TABLE "epics" ADD CONSTRAINT "epics_id_team_unique" UNIQUE ("id", "team_id");
--> statement-breakpoint
-- A ticket's epic must belong to the ticket's team. MATCH SIMPLE lets a NULL epic through.
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_epic_same_team"
	FOREIGN KEY ("epic_id", "team_id") REFERENCES "epics" ("id", "team_id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_type_check" CHECK ("type" IN ('bug', 'feature', 'fix'));
--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_state_check"
	CHECK ("state" IN ('new', 'ready_for_implementation', 'in_progress', 'ready_for_acceptance', 'done'));
--> statement-breakpoint
ALTER TABLE "ticket_events" ADD CONSTRAINT "ticket_events_kind_check" CHECK ("kind" IN ('created', 'updated'));
--> statement-breakpoint
CREATE INDEX "tickets_team_modified_idx" ON "tickets" ("team_id", "modified_at" DESC, "id" DESC);
--> statement-breakpoint
CREATE INDEX "tickets_title_trgm_idx" ON "tickets" USING gin (lower("title") gin_trgm_ops);
--> statement-breakpoint
-- modified_at moves only when some other column actually changes; it can never be set directly.
CREATE FUNCTION touch_modified_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF (to_jsonb(NEW) - 'modified_at') IS DISTINCT FROM (to_jsonb(OLD) - 'modified_at') THEN
		NEW.modified_at := now();
	ELSE
		NEW.modified_at := OLD.modified_at;
	END IF;
	RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "teams_touch_modified_at" BEFORE UPDATE ON "teams" FOR EACH ROW EXECUTE FUNCTION touch_modified_at();
--> statement-breakpoint
CREATE TRIGGER "epics_touch_modified_at" BEFORE UPDATE ON "epics" FOR EACH ROW EXECUTE FUNCTION touch_modified_at();
--> statement-breakpoint
CREATE TRIGGER "tickets_touch_modified_at" BEFORE UPDATE ON "tickets" FOR EACH ROW EXECUTE FUNCTION touch_modified_at();
