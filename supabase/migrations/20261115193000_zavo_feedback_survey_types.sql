alter table public.app_feedback_campaigns
  add column if not exists response_type text not null default 'combined',
  add column if not exists response_options jsonb not null default '[]'::jsonb;

alter table public.app_feedback_campaigns
  drop constraint if exists app_feedback_campaigns_response_type_check;
alter table public.app_feedback_campaigns
  add constraint app_feedback_campaigns_response_type_check
  check (response_type in ('text','choice','rating','combined'));

alter table public.app_feedback_campaigns
  drop constraint if exists app_feedback_campaigns_response_options_check;
alter table public.app_feedback_campaigns
  add constraint app_feedback_campaigns_response_options_check
  check (jsonb_typeof(response_options) = 'array');

alter table public.app_feedback_responses
  alter column rating drop not null;
alter table public.app_feedback_responses
  drop constraint if exists app_feedback_responses_rating_check;
alter table public.app_feedback_responses
  add constraint app_feedback_responses_rating_check
  check (rating is null or (rating >= 1 and rating <= 5));