begin;
insert into public.faculty_accounts(email,password_hash,display_name,role)
values ('admin@gmail.com','$2b$12$pK60Zfi7f5DBu7lCIYBjHeMzKYvQBnMQH1cYrNyvCyYtqLZaGmdGe','Administrator','admin')
on conflict(email) do update set role='admin',password_hash=excluded.password_hash,updated_at=now();
update public.faculty_accounts set role='faculty',updated_at=now() where email='tarinrifa@gmail.com';
delete from public.faculty_sessions where account_id in (select id from public.faculty_accounts where email in ('admin@gmail.com','tarinrifa@gmail.com'));
commit;
