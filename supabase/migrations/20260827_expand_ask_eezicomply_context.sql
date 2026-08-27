-- Expand Ask EeziComply interaction context
alter table public.eezicomply_ai_interactions
  add column if not exists company_id uuid references public.eezicomply_companies(id) on delete set null,
  add column if not exists review_type text,
  add column if not exists review_id uuid,
  add column if not exists context_type text,
  add column if not exists professional_review_recommendation text;

create index if not exists eezicomply_ai_interactions_company_idx
  on public.eezicomply_ai_interactions(company_id,created_at desc);
create index if not exists eezicomply_ai_interactions_review_idx
  on public.eezicomply_ai_interactions(review_type,review_id,created_at desc);
