-- ============================================================
--  MAKE YOURSELF THE ADMIN (run once, after supabase-setup.sql)
--  1. Replace the email below with the email YOU log in with.
--  2. Supabase > SQL Editor > New query > paste > Run
--  You should see: "Success. 1 row" — if it says 0 rows,
--  the email is wrong (check Authentication > Users).
-- ============================================================

update public.profiles
   set is_admin = true,
       status = 'active'
 where email = 'shahidkha993@gmail.com';
