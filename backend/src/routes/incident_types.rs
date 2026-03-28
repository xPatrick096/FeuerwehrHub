use axum::{
    extract::{Path, State},
    middleware,
    routing::{delete, get, post, put},
    Extension, Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    auth::middleware::{require_auth, Claims},
    errors::{AppError, AppResult},
    AppState,
};

const VALID_CATEGORIES: &[&str] = &["brand", "thl", "gefahrgut", "fehlalarm", "sonstiges"];

#[derive(Serialize, sqlx::FromRow)]
pub struct IncidentType {
    pub id:         Uuid,
    pub key:        String,
    pub label:      String,
    pub category:   String,
    pub sort_order: i32,
    pub active:     bool,
    pub created_at: DateTime<Utc>,
    pub used_count: i64,
}

#[derive(Deserialize)]
pub struct IncidentTypeBody {
    pub key:        String,
    pub label:      String,
    pub category:   String,
    pub sort_order: Option<i32>,
    pub active:     Option<bool>,
}

// ── Alle Einsatzarten auflisten ───────────────────────────────────────────────
// Öffentlich für alle authentifizierten User (wird im Einsatzbericht-Formular gebraucht)

pub async fn list_incident_types(
    State(state): State<AppState>,
    _claims: Extension<Claims>,
) -> AppResult<Json<Vec<IncidentType>>> {
    let types = sqlx::query_as::<_, IncidentType>(
        "SELECT it.id, it.key, it.label, it.category, it.sort_order, it.active, it.created_at,
                COUNT(ir.id) AS used_count
         FROM incident_types it
         LEFT JOIN incident_reports ir ON ir.incident_type_key = it.key
         GROUP BY it.id
         ORDER BY it.category ASC, it.sort_order ASC, it.label ASC"
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(types))
}

// ── Neue Einsatzart anlegen (Admin+) ─────────────────────────────────────────

pub async fn create_incident_type(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<IncidentTypeBody>,
) -> AppResult<Json<IncidentType>> {
    if !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }

    let key = body.key.trim().to_lowercase();
    let label = body.label.trim().to_string();

    if key.is_empty() {
        return Err(AppError::BadRequest("Schlüssel darf nicht leer sein".into()));
    }
    if label.is_empty() {
        return Err(AppError::BadRequest("Bezeichnung darf nicht leer sein".into()));
    }
    if !VALID_CATEGORIES.contains(&body.category.as_str()) {
        return Err(AppError::BadRequest(format!(
            "Ungültige Kategorie '{}'. Erlaubt: brand, thl, gefahrgut, fehlalarm, sonstiges",
            body.category
        )));
    }

    let sort_order = body.sort_order.unwrap_or(50);
    let active = body.active.unwrap_or(true);

    let incident_type = sqlx::query_as::<_, IncidentType>(
        "INSERT INTO incident_types (key, label, category, sort_order, active)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, key, label, category, sort_order, active, created_at"
    )
    .bind(&key)
    .bind(&label)
    .bind(&body.category)
    .bind(sort_order)
    .bind(active)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        if e.to_string().contains("unique") {
            AppError::BadRequest(format!("Schlüssel '{}' ist bereits vergeben", key))
        } else {
            AppError::Database(e)
        }
    })?;

    Ok(Json(incident_type))
}

// ── Einsatzart bearbeiten (Admin+) ────────────────────────────────────────────

pub async fn update_incident_type(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<IncidentTypeBody>,
) -> AppResult<Json<IncidentType>> {
    if !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }

    let label = body.label.trim().to_string();
    if label.is_empty() {
        return Err(AppError::BadRequest("Bezeichnung darf nicht leer sein".into()));
    }
    if !VALID_CATEGORIES.contains(&body.category.as_str()) {
        return Err(AppError::BadRequest(format!(
            "Ungültige Kategorie '{}'. Erlaubt: brand, thl, gefahrgut, fehlalarm, sonstiges",
            body.category
        )));
    }

    let sort_order = body.sort_order.unwrap_or(50);
    let active = body.active.unwrap_or(true);

    // key ist nach Anlage nicht mehr änderbar (Snapshots in Einsatzberichten würden inkonsistent)
    let incident_type = sqlx::query_as::<_, IncidentType>(
        "UPDATE incident_types
         SET label = $1, category = $2, sort_order = $3, active = $4
         WHERE id = $5
         RETURNING id, key, label, category, sort_order, active, created_at"
    )
    .bind(&label)
    .bind(&body.category)
    .bind(sort_order)
    .bind(active)
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(incident_type))
}

// ── Einsatzart löschen (Admin+) ───────────────────────────────────────────────
// Nur möglich wenn kein Einsatzbericht diesen Typ referenziert.

pub async fn delete_incident_type(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    if !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }

    let result = sqlx::query("DELETE FROM incident_types WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(Json(serde_json::json!({ "message": "Einsatzart gelöscht" })))
}

// ── Router ────────────────────────────────────────────────────────────────────

pub fn router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/", get(list_incident_types).post(create_incident_type))
        .route("/:id", put(update_incident_type).delete(delete_incident_type))
        .route_layer(middleware::from_fn_with_state(state, require_auth))
}
