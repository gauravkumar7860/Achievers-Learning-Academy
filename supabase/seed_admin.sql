-- 1) Supabase Dashboard > Authentication > Users > Add user (founder's email + password, tick Auto Confirm)
-- 2) Then run this with that email:
insert into profiles (id, role, full_name, email)
select id, 'admin', 'Gaurav Kumar', email from auth.users where email = 'YOUR-ADMIN-EMAIL@example.com';
