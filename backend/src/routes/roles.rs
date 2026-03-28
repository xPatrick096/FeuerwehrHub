use axum::{
    extract::{Path, State},
    middleware,
    routing::{delete, get, post, put},
    Extension, Json, Router,
};
use chrono::DateTime;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    auth::middleware::{require_auth, Claims},
    errors::{AppError, AppResult},
    AppState,
};

const KNOWN_MODULES: &[&str] = &["lager", "personal", "fahrzeuge", "einsatzberichte"];

#[derive(Serialize, sqlx::FromRow)]
pub struct Role {
    pub id:          Uuid,
    pub name:        String,
    pub permissions: Vec<String>,
    pub r#type:      String,
    pub level:       Option<i32>,
    pub created_at:  DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct RoleBody {
    pub name:        String,
    pub permissions: Vec<String>,
    pub r#type:      Option<String>,
    pub level:       Option<i32>,
}

// ── Alle Rollen auflisten ─────────────────────────────────────────────────────

pub async fn list_roles(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<Vec<Role>>> {
    if !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }

    let roles = sqlx::query_as::<_, Role>(
        "SELECT id, name, permissions, type, level, created_at FROM roles ORDER BY type ASC, level ASC NULLS LAST, name ASC"
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(roles))
}

// ── Neue Rolle anlegen ────────────────────────────────────────────────────────

pub async fn create_role(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<RoleBody>,
) -> AppResult<Json<Role>> {
    if !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }

    let name = body.name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::BadRequest("Rollenname darf nicht leer sein".into()));
    }

    let permissions = filter_permissions(body.permissions);
    let role_type = match body.r#type.as_deref() {
        Some("funktion") => "funktion",
        _ => "dienstgrad",
    };
    // Funktionen haben kein Hierarchielevel
    let level = if role_type == "funktion" { None } else { body.level };

    let role = sqlx::query_as::<_, Role>(
        "INSERT INTO roles (name, permissions, type, level) VALUES ($1, $2, $3, $4)
         RETURNING id, name, permissions, type, level, created_at"
    )
    .bind(&name)
    .bind(&permissions)
    .bind(role_type)
    .bind(level)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        if e.to_string().contains("unique") {
            AppError::BadRequest("Rollenname bereits vergeben".into())
        } else {
            AppError::Database(e)
        }
    })?;

    Ok(Json(role))
}

// ── Rolle bearbeiten ──────────────────────────────────────────────────────────

pub async fn update_role(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<RoleBody>,
) -> AppResult<Json<Role>> {
    if !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }

    let name = body.name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::BadRequest("Rollenname darf nicht leer sein".into()));
    }

    let permissions = filter_permissions(body.permissions);
    let role_type = match body.r#type.as_deref() {
        Some("funktion") => "funktion",
        _ => "dienstgrad",
    };
    let level = if role_type == "funktion" { None } else { body.level };

    let role = sqlx::query_as::<_, Role>(
        "UPDATE roles SET name = $1, permissions = $2, type = $3, level = $4 WHERE id = $5
         RETURNING id, name, permissions, type, level, created_at"
    )
    .bind(&name)
    .bind(&permissions)
    .bind(role_type)
    .bind(level)
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(role))
}

// ── Rolle löschen ─────────────────────────────────────────────────────────────

pub async fn delete_role(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    if !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }

    // Zugewiesene Benutzer prüfen (Dienstgrad + Zusatzfunktion)
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM users WHERE role_id = $1"
    )
    .bind(id)
    .fetch_one(&state.db)
    .await?;

    let func_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM user_functions WHERE role_id = $1"
    )
    .bind(id)
    .fetch_one(&state.db)
    .await?;

    let total = count + func_count;
    if total > 0 {
        return Err(AppError::BadRequest(format!(
            "Rolle wird noch von {} Benutzer(n) verwendet", total
        )));
    }

    let result = sqlx::query("DELETE FROM roles WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(Json(serde_json::json!({ "message": "Rolle gelöscht" })))
}

fn filter_permissions(perms: Vec<String>) -> Vec<String> {
    perms.into_iter()
        .filter(|p| KNOWN_MODULES.contains(&p.as_str()))
        .collect()
}

// ── Router ────────────────────────────────────────────────────────────────────

pub fn router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/", get(list_roles).post(create_role))
        .route("/:id", put(update_role).delete(delete_role))
        .route_layer(middleware::from_fn_with_state(state, require_auth))
}
