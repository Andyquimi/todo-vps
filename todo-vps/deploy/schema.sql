-- Ejecutar como el usuario postgres o con psql -U todo_user -d todo_db -f schema.sql

CREATE TABLE IF NOT EXISTS tasks (
    id          SERIAL PRIMARY KEY,
    title       VARCHAR(200) NOT NULL,
    completed   BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_title ON tasks USING gin (title gin_trgm_ops);
-- Si el índice gin_trgm_ops falla, ejecutar antes: CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Datos de ejemplo (opcional)
INSERT INTO tasks (title, completed) VALUES
  ('Configurar el VPS', true),
  ('Instalar Nginx y PostgreSQL', true),
  ('Configurar el pipeline CI/CD', false)
ON CONFLICT DO NOTHING;
