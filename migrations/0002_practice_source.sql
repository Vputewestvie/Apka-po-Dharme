-- Практика, созданная из AI-плана, помечается source="ai" (в отличие от "manual").
ALTER TABLE practices ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';
