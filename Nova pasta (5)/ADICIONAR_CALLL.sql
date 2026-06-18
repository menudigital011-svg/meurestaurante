-- Script para adicionar a coluna de Telefone para Chamada Direta
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS direct_call_phone TEXT;
