-- The full-text document for one item, weighted: title and tags (A), the
-- generated wording (B), the verbatim excerpts (C). The library writes it into
-- item_search whenever an item is approved; keeping the formula here means the
-- application and this backfill can never disagree.
CREATE OR REPLACE FUNCTION item_search_document(target uuid) RETURNS tsvector
LANGUAGE sql STABLE AS $$
  SELECT
    setweight(to_tsvector('english', i.title), 'A') ||
    setweight(to_tsvector('english', array_to_string(i.tags, ' ')), 'A') ||
    setweight(to_tsvector('english', concat_ws(' ', i.summary, i.question, i.answer)), 'B') ||
    setweight(to_tsvector('english', coalesce((SELECT string_agg(e.text, ' ' ORDER BY e.position) FROM item_excerpts e WHERE e.item_id = i.id), '')), 'C')
  FROM items i
  WHERE i.id = target
$$;
--> statement-breakpoint
INSERT INTO item_search (item_id, document, updated_at)
SELECT id, item_search_document(id), now() FROM items WHERE status = 'approved'
ON CONFLICT (item_id) DO UPDATE SET document = excluded.document, updated_at = excluded.updated_at;
