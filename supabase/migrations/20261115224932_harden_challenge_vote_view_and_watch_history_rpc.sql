ALTER VIEW public.zavo_challenge_vote_counts
  SET (security_invoker = true);

ALTER FUNCTION public.zavo_record_watch_history(uuid, integer, boolean)
  SET search_path = pg_catalog, public, private;
