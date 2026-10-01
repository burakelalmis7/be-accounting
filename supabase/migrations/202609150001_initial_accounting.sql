-- Central accounting data. Apply with `supabase db push`; do not run this
-- migration with a service-role key in the browser.
create extension if not exists pgcrypto;
create schema if not exists private;

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.company_members (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

create function private.is_company_member(p_company_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.company_members m where m.company_id = p_company_id and m.user_id = (select auth.uid()))
$$;
revoke all on function private.is_company_member(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_company_member(uuid) to authenticated;

create table public.settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  company_snapshot jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.counterparties (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  data jsonb not null default '{}'::jsonb, version integer not null default 1 check (version > 0),
  idempotency_key uuid not null default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(company_id, idempotency_key), unique(company_id, id)
);
create table public.transactions (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  date date, type text check (type in ('income','expense')), counterparty_id uuid,
  invoice_id uuid, invoice_ref text, net_amount numeric(18,2), vat_amount numeric(18,2), gross_amount numeric(18,2),
  data jsonb not null default '{}'::jsonb, version integer not null default 1 check (version > 0),
  idempotency_key uuid not null default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(company_id, idempotency_key), unique(company_id, id)
);
create table public.invoices (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  kind text not null check (kind in ('issued','received')), number text not null, issue_date date, counterparty_id uuid,
  linked_transaction_id uuid, status text, data jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version > 0), idempotency_key uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(company_id, idempotency_key), unique(company_id, kind, number), unique(company_id, id)
);
alter table public.transactions add constraint transactions_invoice_fk foreign key (company_id, invoice_id) references public.invoices(company_id, id) deferrable initially deferred;
alter table public.invoices add constraint invoices_transaction_fk foreign key (company_id, linked_transaction_id) references public.transactions(company_id, id) deferrable initially deferred;
alter table public.transactions add constraint transactions_counterparty_fk foreign key (company_id, counterparty_id) references public.counterparties(company_id, id) deferrable initially deferred;
alter table public.invoices add constraint invoices_counterparty_fk foreign key (company_id, counterparty_id) references public.counterparties(company_id, id) deferrable initially deferred;

create table public.assets (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade, data jsonb not null default '{}'::jsonb, version integer not null default 1 check(version > 0), idempotency_key uuid not null default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(company_id,idempotency_key));
create table public.dividends (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade, data jsonb not null default '{}'::jsonb, version integer not null default 1 check(version > 0), idempotency_key uuid not null default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(company_id,idempotency_key));
create table public.vehicle_records (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade, data jsonb not null default '{}'::jsonb, version integer not null default 1 check(version > 0), idempotency_key uuid not null default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(company_id,idempotency_key));
create table public.notes (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade, data jsonb not null default '{}'::jsonb, version integer not null default 1 check(version > 0), idempotency_key uuid not null default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(company_id,idempotency_key));
create table public.drafts (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, form_kind text not null, record_id uuid, base_version integer, content jsonb not null, updated_at timestamptz not null default now(), unique(company_id,user_id,form_kind,record_id));
create table public.attachments (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade, record_id uuid, draft_id uuid references public.drafts(id) on delete set null, storage_path text not null unique, original_name text not null, mime_type text not null check(mime_type in ('application/pdf','image/jpeg','image/png')), byte_size bigint not null check(byte_size > 0 and byte_size <= 15728640), created_at timestamptz not null default now());
create table public.audit_log (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade, actor_id uuid not null references auth.users(id), operation text not null, idempotency_key uuid not null, entity_id uuid, details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), unique(company_id, operation, idempotency_key));

create index transactions_company_date_idx on public.transactions(company_id, date desc);
create index invoices_company_issue_date_idx on public.invoices(company_id, issue_date desc);
create index attachments_company_record_idx on public.attachments(company_id, record_id);
create index drafts_scope_idx on public.drafts(company_id, user_id, updated_at desc);

create function private.bump_version() returns trigger language plpgsql security invoker set search_path = '' as $$ begin new.updated_at = now(); new.version = old.version + 1; return new; end $$;
create trigger settings_touch before update on public.settings for each row execute function private.bump_version();
create trigger counterparties_touch before update on public.counterparties for each row execute function private.bump_version();
create trigger transactions_touch before update on public.transactions for each row execute function private.bump_version();
create trigger invoices_touch before update on public.invoices for each row execute function private.bump_version();
create trigger assets_touch before update on public.assets for each row execute function private.bump_version();
create trigger dividends_touch before update on public.dividends for each row execute function private.bump_version();
create trigger vehicle_records_touch before update on public.vehicle_records for each row execute function private.bump_version();
create trigger notes_touch before update on public.notes for each row execute function private.bump_version();

-- RLS and grants are deliberately explicit. An anon visitor gets no table rights.
do $$ declare tab text; begin foreach tab in array array['companies','company_members','settings','counterparties','transactions','invoices','assets','dividends','vehicle_records','notes','drafts','attachments','audit_log'] loop execute format('alter table public.%I enable row level security', tab); execute format('revoke all on public.%I from anon', tab); execute format('grant select, insert, update, delete on public.%I to authenticated', tab); end loop; end $$;
create policy company_read on public.companies for select to authenticated using ((select private.is_company_member(id)));
create policy member_read on public.company_members for select to authenticated using ((select private.is_company_member(company_id)));
create policy member_insert on public.company_members for insert to authenticated with check ((select private.is_company_member(company_id)));
create policy member_delete on public.company_members for delete to authenticated using ((select private.is_company_member(company_id)));
do $$ declare tab text; begin foreach tab in array array['settings','counterparties','transactions','invoices','assets','dividends','vehicle_records','notes','attachments','audit_log'] loop execute format('create policy %I on public.%I for all to authenticated using ((select private.is_company_member(company_id))) with check ((select private.is_company_member(company_id)))', tab || '_company_access', tab); end loop; end $$;
create policy drafts_access on public.drafts for all to authenticated using (user_id = (select auth.uid()) and (select private.is_company_member(company_id))) with check (user_id = (select auth.uid()) and (select private.is_company_member(company_id)));

-- The operation supplies its own final number while holding a row lock on
-- settings. Drafts never call this RPC. The idempotency audit row makes a retry
-- return the original invoice instead of creating another income transaction.
create or replace function public.save_issued_invoice(p_invoice jsonb, p_expected_version integer, p_idempotency_key uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_company uuid := (p_invoice->>'companyId')::uuid; v_invoice_id uuid := (p_invoice->>'id')::uuid; v_tx_id uuid; v_existing public.audit_log; v_invoice public.invoices; v_number text; v_settings public.settings; v_sequence integer; v_format text; v_prefix text; v_year text; v_is_update boolean;
begin
  if not (select private.is_company_member(v_company)) then raise exception 'FORBIDDEN'; end if;
  select * into v_existing from public.audit_log where company_id=v_company and operation='save_issued_invoice' and idempotency_key=p_idempotency_key;
  if found then return v_existing.details; end if;
  select * into v_settings from public.settings where company_id=v_company for update;
  if not found then raise exception 'SETTINGS_MISSING'; end if;
  -- A concurrent retry can have committed while this call waited on settings.
  select * into v_existing from public.audit_log where company_id=v_company and operation='save_issued_invoice' and idempotency_key=p_idempotency_key;
  if found then return v_existing.details; end if;
  select * into v_invoice from public.invoices where id=v_invoice_id and company_id=v_company for update;
  v_is_update := found;
  if v_is_update and p_expected_version is distinct from v_invoice.version then raise exception 'VERSION_CONFLICT'; end if;
  v_number := coalesce(nullif(p_invoice->>'number',''), nullif(p_invoice->>'invoiceNumber',''));
  if not v_is_update then
    v_sequence := coalesce((v_settings.data #>> '{invoice,nextNumber}')::integer, 1);
    v_format := coalesce(v_settings.data #>> '{invoice,numberingFormat}', 'plain');
    v_prefix := coalesce(v_settings.data #>> '{invoice,prefix}', '');
    v_year := coalesce(substr(p_invoice->>'issueDate',1,4), to_char(current_date, 'YYYY'));
    v_number := case v_format when 'year-seq' then v_year || '-' || lpad(v_sequence::text,4,'0') when 'prefix-year-seq' then coalesce(nullif(v_prefix,''),'RE') || '-' || v_year || '-' || lpad(v_sequence::text,4,'0') when 'plain' then coalesce(v_prefix,'') || lpad(v_sequence::text,4,'0') else coalesce(v_prefix,'') || lpad(v_sequence::text,4,'0') end;
  end if;
  if v_number is null then raise exception 'INVOICE_NUMBER_REQUIRED'; end if;
  v_tx_id := coalesce(v_invoice.linked_transaction_id, nullif(p_invoice->>'linkedTransactionId','')::uuid, gen_random_uuid());
  if v_is_update then update public.invoices set number=v_number, issue_date=(p_invoice->>'issueDate')::date, counterparty_id=nullif(p_invoice->>'counterpartyId','')::uuid, linked_transaction_id=v_tx_id, status=p_invoice->>'status', data=p_invoice - 'companyId' - 'version' - 'idempotencyKey', idempotency_key=p_idempotency_key where id=v_invoice_id and company_id=v_company returning * into v_invoice;
  else insert into public.invoices(id,company_id,kind,number,issue_date,counterparty_id,linked_transaction_id,status,data,idempotency_key) values(v_invoice_id,v_company,'issued',v_number,(p_invoice->>'issueDate')::date,nullif(p_invoice->>'counterpartyId','')::uuid,v_tx_id,p_invoice->>'status',p_invoice - 'companyId' - 'version' - 'idempotencyKey',p_idempotency_key) returning * into v_invoice;
       update public.settings set data=jsonb_set(data,'{invoice,nextNumber}',to_jsonb(coalesce((data #>> '{invoice,nextNumber}')::integer,1)+1),true) where company_id=v_company; end if;
  insert into public.transactions(id,company_id,date,type,counterparty_id,invoice_id,invoice_ref,net_amount,vat_amount,gross_amount,data,idempotency_key) values(v_tx_id,v_company,(p_invoice->>'issueDate')::date,'income',nullif(p_invoice->>'counterpartyId','')::uuid,v_invoice_id,v_number,coalesce((p_invoice->>'subtotalNet')::numeric,0),coalesce((p_invoice->>'totalVat')::numeric,0),coalesce((p_invoice->>'totalGross')::numeric,0),jsonb_build_object('id',v_tx_id,'date',p_invoice->>'issueDate','type','income','category','Rechnungsumsatz','description',coalesce(p_invoice #>> '{lineItems,0,description}','Rechnung '||v_number),'counterpartyId',p_invoice->>'counterpartyId','netAmount',p_invoice->>'subtotalNet','vatAmount',p_invoice->>'totalVat','grossAmount',p_invoice->>'totalGross','invoiceRef',v_number,'vatTreatment',p_invoice->>'vatTreatment','paymentStatus',case when p_invoice->>'status'='paid' then 'paid' else 'unpaid' end,'deductible',true,'currency',coalesce(p_invoice->>'currency','EUR')),gen_random_uuid()) on conflict (id) do update set date=excluded.date, counterparty_id=excluded.counterparty_id, invoice_ref=excluded.invoice_ref, net_amount=excluded.net_amount, vat_amount=excluded.vat_amount, gross_amount=excluded.gross_amount, data=excluded.data;
  update public.invoices set data=jsonb_set(data,'{linkedTransactionId}',to_jsonb(v_tx_id::text),true) where id=v_invoice_id;
  select * into v_invoice from public.invoices where id=v_invoice_id;
  insert into public.audit_log(company_id,actor_id,operation,idempotency_key,entity_id,details) values(v_company,(select auth.uid()),'save_issued_invoice',p_idempotency_key,v_invoice_id,jsonb_build_object('invoice',to_jsonb(v_invoice),'transactionId',v_tx_id));
  return jsonb_build_object('invoice',to_jsonb(v_invoice),'transactionId',v_tx_id);
end $$;
revoke all on function public.save_issued_invoice(jsonb,integer,uuid) from public;
grant execute on function public.save_issued_invoice(jsonb,integer,uuid) to authenticated;

-- Private receipts bucket; each object path starts with its company UUID.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('receipts','receipts',false,15728640,array['application/pdf','image/jpeg','image/png']) on conflict (id) do update set public=false, file_size_limit=15728640, allowed_mime_types=array['application/pdf','image/jpeg','image/png'];
create policy receipt_read on storage.objects for select to authenticated using (bucket_id='receipts' and (select private.is_company_member((storage.foldername(name))[1]::uuid)));
create policy receipt_insert on storage.objects for insert to authenticated with check (bucket_id='receipts' and (select private.is_company_member((storage.foldername(name))[1]::uuid)));
create policy receipt_delete on storage.objects for delete to authenticated using (bucket_id='receipts' and (select private.is_company_member((storage.foldername(name))[1]::uuid)));
