ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_kind_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_kind_check
  CHECK (kind = ANY (ARRAY[
    'like'::text,
    'comment'::text,
    'comment_like'::text,
    'follow'::text,
    'message'::text,
    'campaign'::text,
    'system'::text,
    'moderation'::text,
    'mention'::text,
    'new_video'::text,
    'view_milestone'::text
  ]));
