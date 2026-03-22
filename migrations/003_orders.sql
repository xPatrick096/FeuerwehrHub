CREATE TYPE order_status AS ENUM ('offen', 'teillieferung', 'vollstaendig', 'storniert');

CREATE TABLE orders (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id      UUID REFERENCES articles(id) ON DELETE SET NULL,
    article_name    VARCHAR(256) NOT NULL,  -- Snapshot bei Bestellung
    quantity        NUMERIC(10,2) NOT NULL,
    unit            VARCHAR(32) NOT NULL,
    status          order_status NOT NULL DEFAULT 'offen',
    supplier        VARCHAR(256),
    order_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    notes           TEXT,
    ordered_by_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    ordered_by_name VARCHAR(128),           -- Snapshot
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE deliveries (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id            UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    quantity_delivered  NUMERIC(10,2) NOT NULL,
    delivery_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    notes               TEXT,
    received_by_id      UUID REFERENCES users(id) ON DELETE SET NULL,
    received_by_name    VARCHAR(128),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index für häufige Abfragen
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_order_date ON orders(order_date);
CREATE INDEX idx_deliveries_order_id ON deliveries(order_id);
