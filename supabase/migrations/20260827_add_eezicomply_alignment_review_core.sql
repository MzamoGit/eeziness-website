-- EeziComply MOI ↔ SHA Alignment Review
create table public.eezicomply_alignment_reviews (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  organisation_name text,
  status text not null default 'draft' check (status in ('draft','uploaded','processing','complete','failed')),
  moi_filename text,
  moi_storage_path text,
  sha_filename text,
  sha_storage_path text,
  review_json jsonb,
  revised_moi_text text,
  revised_sha_text text,
  next_steps_json jsonb,
  revision_generated_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.eezicomply_alignment_reviews enable row level security;

create policy "Owners can manage alignment reviews"
on public.eezicomply_alignment_reviews
for all to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

grant select, insert, update, delete on public.eezicomply_alignment_reviews to authenticated;

create table public.eezicomply_alignment_change_decisions (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.eezicomply_alignment_reviews(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  change_key text not null,
  topic text not null,
  target_document text not null check (target_document in ('moi','sha','both','none')),
  proposed_resolution text not null,
  decision text not null default 'pending' check (decision in ('pending','accepted','rejected')),
  user_note text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(review_id, change_key)
);

alter table public.eezicomply_alignment_change_decisions enable row level security;

create policy "Owners can manage alignment decisions"
on public.eezicomply_alignment_change_decisions
for all to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

grant select, insert, update, delete on public.eezicomply_alignment_change_decisions to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'eezicomply-alignment','eezicomply-alignment',false,20971520,
  array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']::text[]
)
on conflict (id) do nothing;

create policy "Alignment owners can manage files"
on storage.objects for all to authenticated
using (bucket_id='eezicomply-alignment' and (storage.foldername(name))[1]=(select auth.uid())::text)
with check (bucket_id='eezicomply-alignment' and (storage.foldername(name))[1]=(select auth.uid())::text);
