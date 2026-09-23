-- The read-back tests/ai/ask/fixtures/bnbc-readback.json was taken with (ASK-1a): one F-RCC6-BNBC
-- project a J-000 run stored in cubit_e2e, its newest campaign, read READ ONLY with the system reason
-- set, exactly as the `cubit` MCP tool db_read reads (`:'pid'` is the project). Every figure the ask
-- engine's unit tests state is read off that document, never spelled a second time.
with campaign as (
  select campaign_id, set_revision_id from campaigns where project_id = :'pid' order by opened_at desc, campaign_id desc limit 1
),
stack as (
  select l.level_id, l.label, l.ordinal from levels l where l.project_id = :'pid' and l.repudiated_act_id is null
)
select json_build_object(
  'readBack', json_build_object(
    'database', 'cubit_e2e',
    'projectId', :'pid',
    'campaignId', (select campaign_id from campaign),
    'setRevisionId', (select set_revision_id from campaign),
    'query', 'tests/ai/ask/fixtures/bnbc-readback.sql'
  ),
  'levels', (
    select json_agg(json_build_object(
      'levelId', s.level_id, 'label', s.label, 'ordinal', s.ordinal,
      'readings', coalesce((
        select json_agg(json_build_object(
          'readingKey', r.reading_key, 'basis', r.basis, 'sourceKey', r.source_key,
          'valueAsWritten', r.value_as_written, 'unitAsWritten', r.unit_as_written, 'canonicalMetres', r.canonical_metres::text
        ) order by r.append_seq)
        from storey_height_readings r where r.project_id = :'pid' and r.level_id = s.level_id), '[]'::json)
    ) order by s.ordinal, s.level_id) from stack s
  ),
  'objects', (
    select json_agg(json_build_object(
      'objectKey', o.object_key, 'class', o.element_type, 'mark', o.mark,
      'level', coalesce(s.label, o.level_slot, o.level_label, ''), 'sourceKey', o.placement_key, 'role', o.standing
    ) order by o.registered_at, o.object_key)
    from register_objects o join campaign c on c.set_revision_id = o.set_revision_id
    left join stack s on s.level_id = o.level_id
    where o.project_id = :'pid'
  ),
  'lines', (
    select json_agg(json_build_object(
      'lineId', q.line_id, 'objectKey', q.object_key, 'class', q.class, 'kind', q.kind,
      'value', q.value::text, 'unit', q.unit, 'coverage', q.coverage, 'omitted', q.omitted,
      'drawingId', q.drawing_id, 'viewKey', q.view_key
    ) order by q.published_at, q.line_id)
    from quantity_lines q join campaign c on c.campaign_id = q.campaign_id
  ),
  'refusals', coalesce((
    select json_agg(x.item order by x.at nulls last, x.id) from (
      select json_build_object('code', i.cause, 'objectKey', i.object_key, 'kind', i.kind) as item, i.queued_at as at, i.queue_item_id::text as id
        from queue_items i join campaign c on c.campaign_id = i.campaign_id
      union all
      select json_build_object('code', f.refusal, 'objectKey', f.object_key, 'kind', null), null, f.refused_sighting_id::text
        from refused_sightings f join campaign c on c.set_revision_id = f.set_revision_id
    ) x
  ), '[]'::json),
  'repudiated', coalesce((
    select json_agg(r.object_key order by r.object_key) from repudiated_objects r join campaign c on c.set_revision_id = r.set_revision_id
  ), '[]'::json),
  'notes', coalesce((
    select json_agg(json_build_object(
      'readingKey', n.reading_key, 'drawingId', n.drawing_id, 'layoutName', n.layout_name, 'kind', n.kind, 'sourceKey', n.source_key,
      'valueAsWritten', n.value_as_written, 'unitAsWritten', n.unit_as_written, 'canonical', n.canonical
    ) order by n.layout_name, n.source_key, n.kind)
    from notes_readings n where n.project_id = :'pid'
  ), '[]'::json),
  'schedules', coalesce((
    select json_agg(json_build_object(
      'scheduleKey', s.schedule_key, 'viewKey', s.view_key, 'title', s.title, 'drawingId', s.drawing_id,
      'cells', (select json_agg(json_build_array(c.row_index, c.column_index, c.text, c.source_keys) order by c.row_index, c.column_index)
                from schedule_cells c where c.project_id = :'pid' and c.ingest_id = s.ingest_id and c.schedule_key = s.schedule_key)
    ) order by s.schedule_key)
    from schedules s where s.project_id = :'pid'
      and s.ingest_id = (select s2.ingest_id from schedules s2 where s2.project_id = :'pid' order by s2.created_at desc limit 1)
  ), '[]'::json)
);
