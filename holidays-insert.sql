-- Copy this SQL and run it in Supabase SQL Editor (Database > SQL Editor)
-- This will add all holidays to the Holiday List table

INSERT INTO "Holiday List" ("Date", "Day", "Holiday") VALUES
('01/01/2026', 'Thursday', 'New Year'),
('26/01/2026', 'Monday', 'Republic Day'),
('04/03/2026', 'Wednesday', 'Holi'),
('05/03/2026', 'Thursday', 'Post Holi'),
('15/08/2026', 'Saturday', 'Independence Day'),
('28/08/2026', 'Friday', 'Rakshabandhan'),
('02/10/2026', 'Friday', 'Gandhi Jayanti'),
('20/10/2026', 'Tuesday', 'Dussehra'),
('08/11/2026', 'Sunday', 'Diwali'),
('09/11/2026', 'Monday', 'Post Diwali'),
('10/11/2026', 'Tuesday', 'Post Diwali');

-- Verify the data was inserted
SELECT * FROM "Holiday List" ORDER BY "Date";
