-- Link governance reviews and outputs to EeziComply company records
alter table public.eezicomply_moi_reviews
  add column if not exists company_id uuid references public.eezicomply_companies(id) on delete set null;
alter table public.eezicomply_sha_reviews
  add column if not exists company_id uuid references public.eezicomply_companies(id) on delete set null;
alter table public.eezicomply_alignment_reviews
  add column if not exists company_id uuid references public.eezicomply_companies(id) on delete set null;
alter table public.eezicomply_governance_outputs
  add column if not exists company_id uuid references public.eezicomply_companies(id) on delete set null;

create index if not exists eezicomply_moi_reviews_company_idx on public.eezicomply_moi_reviews(company_id,created_at desc);
create index if not exists eezicomply_sha_reviews_company_idx on public.eezicomply_sha_reviews(company_id,created_at desc);
create index if not exists eezicomply_alignment_reviews_company_idx on public.eezicomply_alignment_reviews(company_id,created_at desc);
create index if not exists eezicomply_governance_outputs_company_idx on public.eezicomply_governance_outputs(company_id,created_at desc);
