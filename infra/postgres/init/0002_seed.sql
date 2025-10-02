INSERT INTO tenants (name) VALUES ('DemoTenant');
WITH t AS (SELECT id FROM tenants WHERE name='DemoTenant' LIMIT 1)
INSERT INTO users (tenant_id, email, name, role)
SELECT id, 'admin@example.com', 'Admin Demo', 'admin' FROM t;
WITH t AS (SELECT id FROM tenants WHERE name='DemoTenant' LIMIT 1)
INSERT INTO clients (tenant_id, name)
SELECT id, unnest(ARRAY['Juan Pérez','Fulanito de Tal','Fulvio Andrade']) FROM t;
