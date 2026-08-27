-- Governance review professional outputs
create table if not exists public.eezicomply_governance_outputs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  review_type text not null check (review_type in ('moi','sha','alignment')),
  review_id uuid not null,
  document_kind text not null check (document_kind in ('review_report','implementation_checklist','revised_moi','revised_sha')),
  file_format text not null check (file_format in ('docx','pdf')),
  display_name text not null,
  storage_path text not null,
  mime_type text not null,
  version integer not null default 1,
  is_current boolean not null default true,
  document_status text not null default 'working_draft'
    check (document_status in ('working_draft','professional_review_required','professionally_reviewed','signed','filed','superseded')),
  professional_review_required boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists eezicomply_governance_outputs_owner_idx
  on public.eezicomply_governance_outputs(owner_id, created_at desc);
create index if not exists eezicomply_governance_outputs_review_idx
  on public.eezicomply_governance_outputs(review_type, review_id, document_kind, is_current);

alter table public.eezicomply_governance_outputs enable row level security;

drop policy if exists "Owners can read governance outputs" on public.eezicomply_governance_outputs;
create policy "Owners can read governance outputs"
on public.eezicomply_governance_outputs for select to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists "Owners can create governance outputs" on public.eezicomply_governance_outputs;
create policy "Owners can create governance outputs"
on public.eezicomply_governance_outputs for insert to authenticated
with check ((select auth.uid()) = owner_id);

grant select, insert on public.eezicomply_governance_outputs to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'eezicomply-governance-outputs','eezicomply-governance-outputs',false,52428800,
  array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document']::text[]
)
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "Governance output owners can read files" on storage.objects;
create policy "Governance output owners can read files"
on storage.objects for select to authenticated
using (
  bucket_id='eezicomply-governance-outputs'
  and (storage.foldername(name))[1]=(select auth.uid())::text
);
