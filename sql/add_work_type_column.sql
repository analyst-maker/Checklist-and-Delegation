-- ============================================================
-- Work Type field for Assign New Task
-- Adds a "Work Type" column (Task / Meeting / Report).
-- CHECKLIST ONLY — Delegation does not use Work Type.
-- Safe to re-run: every statement uses IF NOT EXISTS / IF EXISTS.
-- ============================================================

-- 1) Unique (recurring checklist template)
ALTER TABLE public."Unique"
  ADD COLUMN IF NOT EXISTS "Work Type" text DEFAULT 'Task';

-- 2) Checklist (generated task instances)
ALTER TABLE public."Checklist"
  ADD COLUMN IF NOT EXISTS "Work Type" text DEFAULT 'Task';


-- ------------------------------------------------------------
-- Backfill existing rows so nothing is left NULL
-- ------------------------------------------------------------
UPDATE public."Unique"    SET "Work Type" = 'Task' WHERE "Work Type" IS NULL;
UPDATE public."Checklist" SET "Work Type" = 'Task' WHERE "Work Type" IS NULL;


-- ------------------------------------------------------------
-- Restrict the column to the three allowed values
-- ------------------------------------------------------------
ALTER TABLE public."Unique" DROP CONSTRAINT IF EXISTS unique_work_type_check;
ALTER TABLE public."Unique"
  ADD CONSTRAINT unique_work_type_check
  CHECK ("Work Type" IN ('Task', 'Meeting', 'Report'));

ALTER TABLE public."Checklist" DROP CONSTRAINT IF EXISTS checklist_work_type_check;
ALTER TABLE public."Checklist"
  ADD CONSTRAINT checklist_work_type_check
  CHECK ("Work Type" IN ('Task', 'Meeting', 'Report'));


-- ------------------------------------------------------------
-- Optional: indexes if you plan to filter/report by Work Type
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_checklist_work_type ON public."Checklist" ("Work Type");


-- ------------------------------------------------------------
-- Verify
-- ------------------------------------------------------------
-- SELECT table_name, column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE column_name = 'Work Type'
--   AND table_schema = 'public';


-- ============================================================
-- PART 2 — carry "Work Type" into auto-generated Checklist rows
--
-- Recurring checklist tasks are created by two database routines that
-- list their columns explicitly, so they must be updated or every
-- auto-generated row would fall back to the 'Task' default.
-- Both are reproduced below with only the "Work Type" lines added.
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_checklist_tasks(
    p_target_date DATE DEFAULT (CURRENT_DATE AT TIME ZONE 'Asia/Kolkata')::DATE
)
RETURNS JSONB AS $$
DECLARE
    r RECORD;
    v_today_str TEXT;
    v_now_ts TEXT;
    v_next_task_id BIGINT;
    v_generated_count INT := 0;
    v_template_start_date DATE;
    v_template_last_date DATE;
    v_is_due BOOLEAN;
    v_exists BOOLEAN;
BEGIN
    v_today_str := TO_CHAR(p_target_date, 'DD/MM/YYYY');
    v_now_ts := TO_CHAR(NOW() AT TIME ZONE 'Asia/Kolkata', 'DD/MM/YYYY, HH12:MI:SS AM');

    SELECT COALESCE(MAX("Task ID"), 0) INTO v_next_task_id FROM public."Checklist";

    FOR r IN
        SELECT
            "Task ID",
            "Department",
            "Give By",
            "Name",
            "Work Type",                       -- added
            "Task Description",
            "Task Start date",
            "Frequency",
            "Enable Reminder",
            "Require Attatchment",
            "Last Date"
        FROM public."Unique"
        ORDER BY "Task ID" ASC
    LOOP
        v_template_start_date := public.parse_ddmmyyyy(r."Task Start date");
        v_template_last_date := public.parse_ddmmyyyy(r."Last Date");

        v_is_due := public.is_template_due(
            r."Frequency",
            v_template_start_date,
            v_template_last_date,
            p_target_date
        );

        IF v_is_due THEN
            SELECT EXISTS(
                SELECT 1 FROM public."Checklist"
                WHERE LOWER(TRIM("Name")) = LOWER(TRIM(COALESCE(r."Name", '')))
                  AND LOWER(TRIM(COALESCE("Tast Descriptions", ''))) = LOWER(TRIM(COALESCE(r."Task Description", '')))
                  AND "Task Start Date" = v_today_str
            ) INTO v_exists;

            IF NOT v_exists THEN
                v_next_task_id := v_next_task_id + 1;

                INSERT INTO public."Checklist" (
                    "Task ID",
                    "Timestamp",
                    "Department",
                    "Given By",
                    "Name",
                    "Work Type",               -- added
                    "Tast Descriptions",
                    "Task Start Date",
                    "Freq",
                    "Enable Reminders",
                    "Require Attachment",
                    "Actual",
                    "Delay",
                    "Status",
                    "Remarks",
                    "Uploaded Image"
                ) VALUES (
                    v_next_task_id,
                    v_now_ts,
                    r."Department",
                    COALESCE(r."Give By", 'Admin'),
                    r."Name",
                    COALESCE(r."Work Type", 'Task'),   -- added
                    r."Task Description",
                    v_today_str,
                    COALESCE(r."Frequency", 'daily'),
                    COALESCE(r."Enable Reminder", 'Yes'),
                    COALESCE(r."Require Attatchment", 'No'),
                    NULL,
                    NULL,
                    NULL,
                    NULL,
                    NULL
                );

                v_generated_count := v_generated_count + 1;
            END IF;

            UPDATE public."Unique"
            SET "Last Date" = v_today_str
            WHERE "Task ID" = r."Task ID";
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'target_date', v_today_str,
        'tasks_generated', v_generated_count,
        'message', FORMAT('Successfully generated %s task(s) for %s', v_generated_count, v_today_str)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.generate_checklist_tasks(DATE) TO anon, authenticated, service_role;


CREATE OR REPLACE FUNCTION public.trg_fn_generate_first_task_for_unique()
RETURNS TRIGGER AS $$
DECLARE
    v_today DATE := (CURRENT_DATE AT TIME ZONE 'Asia/Kolkata')::DATE;
    v_today_str TEXT := TO_CHAR(v_today, 'DD/MM/YYYY');
    v_now_ts TEXT := TO_CHAR(NOW() AT TIME ZONE 'Asia/Kolkata', 'DD/MM/YYYY, HH12:MI:SS AM');
    v_template_start DATE;
    v_next_id BIGINT;
    v_exists BOOLEAN;
BEGIN
    v_template_start := public.parse_ddmmyyyy(NEW."Task Start date");

    IF v_template_start IS NULL OR v_template_start <= v_today THEN
        SELECT EXISTS(
            SELECT 1 FROM public."Checklist"
            WHERE LOWER(TRIM("Name")) = LOWER(TRIM(COALESCE(NEW."Name", '')))
              AND LOWER(TRIM(COALESCE("Tast Descriptions", ''))) = LOWER(TRIM(COALESCE(NEW."Task Description", '')))
              AND "Task Start Date" = v_today_str
        ) INTO v_exists;

        IF NOT v_exists THEN
            SELECT COALESCE(MAX("Task ID"), 0) + 1 INTO v_next_id FROM public."Checklist";

            INSERT INTO public."Checklist" (
                "Task ID",
                "Timestamp",
                "Department",
                "Given By",
                "Name",
                "Work Type",                   -- added
                "Tast Descriptions",
                "Task Start Date",
                "Freq",
                "Enable Reminders",
                "Require Attachment",
                "Actual",
                "Delay",
                "Status",
                "Remarks",
                "Uploaded Image"
            ) VALUES (
                v_next_id,
                v_now_ts,
                NEW."Department",
                COALESCE(NEW."Give By", 'Admin'),
                NEW."Name",
                COALESCE(NEW."Work Type", 'Task'),   -- added
                NEW."Task Description",
                v_today_str,
                COALESCE(NEW."Frequency", 'daily'),
                COALESCE(NEW."Enable Reminder", 'Yes'),
                COALESCE(NEW."Require Attatchment", 'No'),
                NULL,
                NULL,
                NULL,
                NULL,
                NULL
            );
        END IF;

        NEW."Last Date" := v_today_str;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_unique_insert_generate_task ON public."Unique";
CREATE TRIGGER trg_unique_insert_generate_task
BEFORE INSERT ON public."Unique"
FOR EACH ROW
EXECUTE FUNCTION public.trg_fn_generate_first_task_for_unique();
