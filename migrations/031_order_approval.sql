-- Freigabe-Workflow für Beschaffungsaufträge
-- approval_status ist bewusst getrennt vom delivery-status (order_status enum)
-- Existierende Bestellungen erhalten DEFAULT 'genehmigt' → bleiben voll funktionsfähig

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS approval_status  TEXT NOT NULL DEFAULT 'genehmigt'
        CHECK (approval_status IN ('entwurf', 'ausstehend', 'genehmigt', 'abgelehnt')),
    ADD COLUMN IF NOT EXISTS approved_by_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS approved_by_name TEXT,
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
    ADD COLUMN IF NOT EXISTS approved_at      TIMESTAMPTZ;
