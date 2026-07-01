-- Optional personal ID number shown alongside the owner's bank account
-- details (some Georgian banks require it to identify the recipient).
alter table public.bank_accounts add column if not exists id_number text;
