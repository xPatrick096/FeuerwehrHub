-- Dienstbeteiligung / Anwesenheit
CREATE TABLE IF NOT EXISTS service_attendance (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_date  DATE        NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'present'
                              CHECK (status IN ('present', 'absent', 'excused')),
    notes         TEXT,
    created_by_id UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_user    ON service_attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date    ON service_attendance(service_date);
