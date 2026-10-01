-- Run with `supabase test db`. Add real auth fixtures before production.
begin;
select plan(4);
select has_table('public', 'transactions', 'transactions table exists');
select has_table('public', 'attachments', 'attachments table exists');
select policies_are('public', 'transactions', array['transactions_company_access'], 'transactions has company policy');
select policies_are('storage', 'objects', array['receipt_delete','receipt_insert','receipt_read'], 'receipts have private policies');
select * from finish();
rollback;
