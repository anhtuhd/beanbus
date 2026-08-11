do $$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid
    from cron.job
    where jobname in (
      'beanbus-clear-stale-phone-changes',
      'beanbus-refresh-zalo-token'
    )
  loop
    perform cron.unschedule(v_job_id);
  end loop;
end;
$$;
