-- Session 7's J-000 read-back of one BNBC project (psql against cubit_e2e; :pid is the project).
-- The run file that names the project is deleted by the next Playwright lane, so the project is
-- found by name, newest first: select project_id, created_at from projects
--   where name = 'Bashundhara G+6' order by created_at desc;
set cubit.system_reason = 'read back a J-000 BNBC project';
with campaign as (
  select campaign_id from quantity_lines where project_id = :'pid'
  order by published_at desc limit 1
)
select q.class, q.kind, q.coverage, count(*) as lines, sum(q.value) as total, min(q.unit) as unit
from quantity_lines q join campaign c using (campaign_id)
where q.project_id = :'pid'
group by q.class, q.kind, q.coverage
order by q.class, q.kind, q.coverage;
select element_type, count(*) as objects, count(*) filter (where level_id is null) as unlevelled
from register_objects where project_id = :'pid' and element_type in ('beam', 'column', 'pile', 'pile_cap')
group by element_type order by element_type;
-- I-368's invariant: no quantity line of the newest campaign without its register object, and none
-- keyed on a placeholder. Both counts read 0 since 2846dcc7; a campaign measured before it reads 50
-- (S-14's typical beams, x concrete and formwork).
with campaign as (
  select campaign_id from quantity_lines where project_id = :'pid'
  order by published_at desc limit 1
)
select
  count(*) filter (where not exists (
    select 1 from register_objects r
    where r.tenant_id = q.tenant_id and r.set_revision_id = q.set_revision_id and r.object_key = q.object_key)) as orphan_lines,
  count(*) filter (where q.object_key like '%@UNRESOLVED' or q.object_key like '%@unregistered:%') as placeholder_lines
from quantity_lines q join campaign c using (campaign_id)
where q.project_id = :'pid';
