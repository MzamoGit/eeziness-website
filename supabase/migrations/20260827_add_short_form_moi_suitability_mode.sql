-- Extend EeziComply MOI Review for standard short-form MOI suitability mode
alter table public.eezicomply_moi_reviews
  add column if not exists review_mode text not null default 'customised_moi_review',
  add column if not exists detected_form text,
  add column if not exists form_detection_confidence numeric,
  add column if not exists short_form_answers jsonb,
  add column if not exists short_form_assessment_json jsonb,
  add column if not exists retain_standard_moi boolean;

alter table public.eezicomply_moi_reviews
  drop constraint if exists eezicomply_moi_reviews_review_mode_check;

alter table public.eezicomply_moi_reviews
  add constraint eezicomply_moi_reviews_review_mode_check
  check (review_mode in ('customised_moi_review','short_form_suitability'));
