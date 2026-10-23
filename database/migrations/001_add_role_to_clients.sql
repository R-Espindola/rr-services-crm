-- Migração: Adiciona coluna de role à tabela clients para controlo de acesso baseado em funções
-- Data: 2026-10-22
-- Projeto: R&R Services
--
-- Esta migração adiciona uma coluna 'role' à tabela clients existente.
-- Valores possíveis: 'admin' ou 'client'
-- Valor por defeito: 'client'
--
-- NENHUMA alteração destrutiva. Dados existentes são preservados.
-- Após aplicar esta migração, é necessário atribuir manualmente o role 'admin'
-- aos utilizadores que devem ter acesso ao painel administrativo (/admin).
--
-- Exemplo de atribuição de admin:
--   UPDATE clients SET role = 'admin' WHERE email = 'admin@rrservices.pt';

ALTER TABLE clients
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'client' CHECK (role IN ('admin', 'client'));

CREATE INDEX IF NOT EXISTS idx_clients_role ON clients(role);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
