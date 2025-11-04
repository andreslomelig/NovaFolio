-- Extensiones (idempotentes)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tabla de páginas por documento
CREATE TABLE IF NOT EXISTS doc_pages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id     uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  page       int  NOT NULL,
  text       text NOT NULL,
  tsv        tsvector GENERATED ALWAYS AS (to_tsvector('english', text)) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS doc_pages_doc_page_uq ON doc_pages(doc_id, page);
CREATE INDEX IF NOT EXISTS doc_pages_text_trgm_idx ON doc_pages USING gin (text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS doc_pages_tsv_idx      ON doc_pages USING gin (tsv);
