use sqlx::PgPool;
use uuid::Uuid;

pub async fn log(
    db: &PgPool,
    user_id: Option<Uuid>,
    username: &str,
    action: &str,
    entity: Option<&str>,
    entity_id: Option<Uuid>,
    details: Option<&str>,
) {
    let result = sqlx::query(
        "INSERT INTO audit_log (user_id, username, action, entity, entity_id, details)
         VALUES ($1, $2, $3, $4, $5, $6)"
    )
    .bind(user_id)
    .bind(username)
    .bind(action)
    .bind(entity)
    .bind(entity_id)
    .bind(details)
    .execute(db)
    .await;

    if let Err(e) = result {
        tracing::error!("Audit-Log Fehler: {}", e);
    }
}
