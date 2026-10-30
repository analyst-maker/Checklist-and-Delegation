-- ============================================================
-- Inspect what is ACTUALLY installed in the database right now.
-- Read-only: nothing here changes any data or object.
-- Run these in the Supabase SQL Editor one block at a time.
-- ============================================================


-- ------------------------------------------------------------
-- 1) Full source of generate_checklist_tasks()
--    This is the definitive "what is running right now" answer.
-- ------------------------------------------------------------
SELECT pg_get_functiondef(p.oid) AS function_source
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'generate_checklist_tasks';


-- ------------------------------------------------------------
-- 2) Does the installed version already handle "Work Type"?
--    expected_after_patch = true  -> PART 2 of add_work_type_column.sql has been applied
--    expected_after_patch = false -> still the old version, recurring tasks
--                                    will always fall back to the 'Task' default
-- ------------------------------------------------------------
SELECT
    p.proname                                   AS function_name,
    p.prosrc LIKE '%Work Type%'                 AS has_work_type,
    p.prosecdef                                 AS is_security_definer,
    pg_get_function_identity_arguments(p.oid)   AS arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
      'generate_checklist_tasks',
      'trg_fn_generate_first_task_for_unique',
      'is_template_due',
      'parse_ddmmyyyy'
  )
ORDER BY p.proname;


-- ------------------------------------------------------------
-- 3) Source of the insert trigger function (the other place that
--    creates Checklist rows — the first task for a new template)
-- ------------------------------------------------------------
SELECT pg_get_functiondef(p.oid) AS function_source
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'trg_fn_generate_first_task_for_unique';


-- ------------------------------------------------------------
-- 4) Is the trigger actually attached to the Unique table, and enabled?
--    tgenabled: 'O' = enabled (normal), 'D' = DISABLED
-- ------------------------------------------------------------
SELECT
    t.tgname        AS trigger_name,
    c.relname       AS on_table,
    t.tgenabled     AS enabled_flag,
    pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE NOT t.tgisinternal
  AND n.nspname = 'public'
  AND c.relname IN ('Unique', 'Checklist')
ORDER BY c.relname, t.tgname;


-- ------------------------------------------------------------
-- 5) Does the "Work Type" column exist yet, and on which tables?
--    Run this BEFORE part 2 — if a table is missing here, the
--    patched function would fail with "column does not exist".
-- ------------------------------------------------------------
SELECT
    table_name,
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'Work Type'
ORDER BY table_name;


-- ------------------------------------------------------------
-- 6) Exact column names of the three tables.
--    Useful because this schema has typos baked in
--    ("Tast Descriptions", "Require Attatchment", "Give By"),
--    so copy names from here rather than guessing.
-- ------------------------------------------------------------
SELECT
    table_name,
    ordinal_position,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('Unique', 'Checklist')
ORDER BY table_name, ordinal_position;


-- ------------------------------------------------------------
-- 7) Dry run: see what the generator would do, without waiting
--    for the cron. NOTE: this one is NOT read-only — it really
--    inserts due tasks and updates "Last Date" on the templates.
--    Wrap it in a transaction and roll back to test safely.
-- ------------------------------------------------------------
-- BEGIN;
--   SELECT public.generate_checklist_tasks();
--   SELECT "Task ID", "Name", "Work Type", "Tast Descriptions", "Task Start Date"
--   FROM public."Checklist"
--   ORDER BY "Task ID" DESC
--   LIMIT 20;
-- ROLLBACK;   -- change to COMMIT only if you want to keep the generated rows


-- ------------------------------------------------------------
-- 8) Is the daily cron job scheduled? (needs pg_cron enabled)
-- ------------------------------------------------------------
-- SELECT jobid, schedule, command, active FROM cron.job;


-- ------------------------------------------------------------
-- 9) After applying PART 2, confirm Work Type is flowing through
-- ------------------------------------------------------------
-- SELECT "Work Type", COUNT(*) FROM public."Checklist" GROUP BY 1 ORDER BY 2 DESC;
-- SELECT "Work Type", COUNT(*) FROM public."Unique"    GROUP BY 1 ORDER BY 2 DESC;
