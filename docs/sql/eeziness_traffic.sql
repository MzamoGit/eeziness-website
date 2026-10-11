begin;
create extension if not exists pg_cron;
create table public.eeziness_traffic_admins (user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.eeziness_traffic_admins enable row level security;
revoke all on public.eeziness_traffic_admins from public,anon,authenticated;
grant select on public.eeziness_traffic_admins to service_role;
insert into public.eeziness_traffic_admins(user_id) select id from auth.users where lower(email)='mzamok@naselacapital.com' and email_confirmed_at is not null;
create table public.eeziness_traffic_events (
 event_id uuid primary key, created_at timestamptz not null default now(),
 visitor_hash text not null check(length(visitor_hash)=64),
 kind text not null check(kind in ('pageview','product_click')),
 path text not null check(path in ('/','/privacy','/terms','/eezicomply/sample')),
 product text not null default '' check(product in ('','eezifinance','eezicomply','eezifund','eezibid','eezinpo','eezidebt','eezirisk')),
 referrer text not null default '', source text not null default '', medium text not null default '', campaign text not null default '',
 device text not null check(device in ('mobile','tablet','desktop')), is_test boolean not null default false
);
create index eeziness_traffic_created_idx on public.eeziness_traffic_events(created_at);
create index eeziness_traffic_visitor_idx on public.eeziness_traffic_events(visitor_hash,created_at);
alter table public.eeziness_traffic_events enable row level security;
revoke all on public.eeziness_traffic_events from public,anon,authenticated;
grant select,insert,delete on public.eeziness_traffic_events to service_role;
create function public.eeziness_record_traffic(p_event jsonb) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_event->>'visitor_hash',0));
 if (select count(*) from public.eeziness_traffic_events where visitor_hash=p_event->>'visitor_hash' and created_at>now()-interval '1 minute')>=120 then return false; end if;
 insert into public.eeziness_traffic_events(event_id,visitor_hash,kind,path,product,referrer,source,medium,campaign,device,is_test)
 values((p_event->>'event_id')::uuid,p_event->>'visitor_hash',p_event->>'kind',p_event->>'path',p_event->>'product',p_event->>'referrer',p_event->>'source',p_event->>'medium',p_event->>'campaign',p_event->>'device',coalesce((p_event->>'is_test')::boolean,false))
 on conflict(event_id) do nothing;
 return true;
end $$;
revoke all on function public.eeziness_record_traffic(jsonb) from public,anon,authenticated;
grant execute on function public.eeziness_record_traffic(jsonb) to service_role;
create function public.eeziness_traffic_report(p_days integer default 7) returns jsonb language sql stable security invoker set search_path='' as $$
with bounds as (
 select (now() at time zone 'Africa/Johannesburg')::date as today, greatest(1,least(90,p_days)) as days
), events as (
 select e.*, (created_at at time zone 'Africa/Johannesburg')::date as day,
 coalesce(nullif(source,''),nullif(referrer,''),'Direct / unknown') as traffic_source
 from public.eeziness_traffic_events e,bounds b
 where not is_test and created_at >= ((b.today-b.days+1)::timestamp at time zone 'Africa/Johannesburg')
), daily as (
 select d::date as day,count(e.event_id) filter(where kind='pageview') as views,
 count(distinct e.visitor_hash) filter(where kind='pageview') as visitors,
 count(e.event_id) filter(where kind='product_click') as clicks
 from bounds b cross join generate_series(b.today-b.days+1,b.today,interval '1 day') d
 left join events e on e.day=d::date group by d
), previous as (
 select count(*) filter(where kind='pageview') as views,count(*) filter(where kind='product_click') as clicks
 from public.eeziness_traffic_events e,bounds b where not is_test
 and created_at >= ((b.today-2*b.days+1)::timestamp at time zone 'Africa/Johannesburg')
 and created_at < ((b.today-b.days+1)::timestamp at time zone 'Africa/Johannesburg')
)
select jsonb_build_object(
 'days',(select days from bounds),'timezone','Africa/Johannesburg','generated_at',now(),
 'summary',jsonb_build_object('pageviews',(select coalesce(sum(views),0) from daily),'daily_visitors',(select coalesce(sum(visitors),0) from daily),'product_clicks',(select coalesce(sum(clicks),0) from daily),'previous_pageviews',(select views from previous),'previous_clicks',(select clicks from previous)),
 'daily',(select coalesce(jsonb_agg(to_jsonb(daily) order by day),'[]') from daily),
 'pages',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (select path,count(*) as views from events where kind='pageview' group by path order by views desc) t),
 'sources',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (select traffic_source as source,count(*) as views from events where kind='pageview' group by traffic_source order by views desc limit 25) t),
 'campaigns',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (select source,medium,campaign,count(*) filter(where kind='pageview') as views,count(*) filter(where kind='product_click') as clicks from events where campaign<>'' group by source,medium,campaign order by views desc limit 25) t),
 'products',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (select product,count(*) as clicks from events where kind='product_click' group by product order by clicks desc) t),
 'devices',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (select device,count(*) as views from events where kind='pageview' group by device order by views desc) t),
 'tracking_started',(select min(created_at) from public.eeziness_traffic_events where not is_test)
) $$;
revoke all on function public.eeziness_traffic_report(integer) from public,anon,authenticated;
grant execute on function public.eeziness_traffic_report(integer) to service_role;
select cron.schedule('eeziness-traffic-retention','15 2 * * *', $job$delete from public.eeziness_traffic_events where created_at < now()-interval '90 days';$job$);
commit;
