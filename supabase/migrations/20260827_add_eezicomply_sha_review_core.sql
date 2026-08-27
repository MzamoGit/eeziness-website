-- EeziComply Shareholders' Agreement Review
create table public.eezicomply_sha_reviews (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  organisation_name text,
  status text not null default 'draft' check (status in ('draft','uploaded','processing','complete','failed')),
  original_filename text,
  storage_path text,
  mime_type text,
  review_json jsonb,
  revised_sha_text text,
  next_steps_json jsonb,
  revision_generated_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index eezicomply_sha_reviews_owner_created_idx
on public.eezicomply_sha_reviews(owner_id, created_at desc);

alter table public.eezicomply_sha_reviews enable row level security;

create policy "Owners can read SHA reviews"
on public.eezicomply_sha_reviews for select to authenticated
using ((select auth.uid()) = owner_id);

create policy "Owners can create SHA reviews"
on public.eezicomply_sha_reviews for insert to authenticated
with check ((select auth.uid()) = owner_id);

create policy "Owners can update SHA reviews"
on public.eezicomply_sha_reviews for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "Owners can delete SHA reviews"
on public.eezicomply_sha_reviews for delete to authenticated
using ((select auth.uid()) = owner_id);

grant select, insert, update, delete on public.eezicomply_sha_reviews to authenticated;

create table public.eezicomply_sha_change_decisions (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.eezicomply_sha_reviews(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  change_key text not null,
  title text not null,
  clause_reference text,
  proposed_change text not null,
  decision text not null default 'pending' check (decision in ('pending','accepted','rejected')),
  user_note text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(review_id, change_key)
);

create index eezicomply_sha_change_decisions_review_idx
on public.eezicomply_sha_change_decisions(review_id);

alter table public.eezicomply_sha_change_decisions enable row level security;

create policy "Owners can read SHA change decisions"
on public.eezicomply_sha_change_decisions for select to authenticated
using ((select auth.uid()) = owner_id);

create policy "Owners can create SHA change decisions"
on public.eezicomply_sha_change_decisions for insert to authenticated
with check ((select auth.uid()) = owner_id);

create policy "Owners can update SHA change decisions"
on public.eezicomply_sha_change_decisions for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

grant select, insert, update on public.eezicomply_sha_change_decisions to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'eezicomply-sha','eezicomply-sha',false,20971520,
  array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']::text[]
)
on conflict (id) do nothing;

create policy "SHA owners can read files"
on storage.objects for select to authenticated
using (bucket_id='eezicomply-sha' and (storage.foldername(name))[1]=(select auth.uid())::text);

create policy "SHA owners can upload files"
on storage.objects for insert to authenticated
with check (bucket_id='eezicomply-sha' and (storage.foldername(name))[1]=(select auth.uid())::text);

create policy "SHA owners can update files"
on storage.objects for update to authenticated
using (bucket_id='eezicomply-sha' and (storage.foldername(name))[1]=(select auth.uid())::text)
with check (bucket_id='eezicomply-sha' and (storage.foldername(name))[1]=(select auth.uid())::text);

create policy "SHA owners can delete files"
on storage.objects for delete to authenticated
using (bucket_id='eezicomply-sha' and (storage.foldername(name))[1]=(select auth.uid())::text);
