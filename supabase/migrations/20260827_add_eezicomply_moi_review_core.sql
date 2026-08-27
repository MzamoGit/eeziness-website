-- EeziComply MOI Review core schema
create table public.eezicomply_moi_reviews (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  organisation_name text,
  status text not null default 'draft' check (status in ('draft','uploaded','processing','complete','failed')),
  original_filename text,
  storage_path text,
  mime_type text,
  review_json jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index eezicomply_moi_reviews_owner_created_idx
on public.eezicomply_moi_reviews(owner_id, created_at desc);

alter table public.eezicomply_moi_reviews enable row level security;

create policy "Owners can read their MOI reviews"
on public.eezicomply_moi_reviews for select to authenticated
using ((select auth.uid()) = owner_id);

create policy "Owners can create their MOI reviews"
on public.eezicomply_moi_reviews for insert to authenticated
with check ((select auth.uid()) = owner_id);

create policy "Owners can update their MOI reviews"
on public.eezicomply_moi_reviews for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "Owners can delete their MOI reviews"
on public.eezicomply_moi_reviews for delete to authenticated
using ((select auth.uid()) = owner_id);

grant select, insert, update, delete on public.eezicomply_moi_reviews to authenticated;

create table public.eezicomply_review_events (
  id bigint generated always as identity primary key,
  review_id uuid not null references public.eezicomply_moi_reviews(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.eezicomply_review_events enable row level security;

create policy "Owners can read their review events"
on public.eezicomply_review_events for select to authenticated
using ((select auth.uid()) = owner_id);

create policy "Owners can create their review events"
on public.eezicomply_review_events for insert to authenticated
with check ((select auth.uid()) = owner_id);

grant select, insert on public.eezicomply_review_events to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'eezicomply-moi','eezicomply-moi',false,20971520,
  array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']::text[]
)
on conflict (id) do nothing;

create policy "MOI owners can read files"
on storage.objects for select to authenticated
using (bucket_id='eezicomply-moi' and (storage.foldername(name))[1]=(select auth.uid())::text);

create policy "MOI owners can upload files"
on storage.objects for insert to authenticated
with check (bucket_id='eezicomply-moi' and (storage.foldername(name))[1]=(select auth.uid())::text);

create policy "MOI owners can update files"
on storage.objects for update to authenticated
using (bucket_id='eezicomply-moi' and (storage.foldername(name))[1]=(select auth.uid())::text)
with check (bucket_id='eezicomply-moi' and (storage.foldername(name))[1]=(select auth.uid())::text);

create policy "MOI owners can delete files"
on storage.objects for delete to authenticated
using (bucket_id='eezicomply-moi' and (storage.foldername(name))[1]=(select auth.uid())::text);
