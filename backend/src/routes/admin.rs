use axum::{
    extract::{Path, State},
    middleware,
    routing::{delete, get, post, put},
    Extension, Json, Router,
};
use bcrypt::{hash, DEFAULT_COST};
use chrono::DateTime;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    auth::middleware::{require_auth, Claims},
    errors::{AppError, AppResult},
    AppState,
};

// ── Structs ───────────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct UserEntry {
    pub id: Uuid,
    pub username: String,
    pub role: String,
    pub is_admin: bool,
    pub totp_enabled: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct CreateUserBody {
    pub username: String,
    pub password: String,
    pub role: String,
}

#[derive(Deserialize)]
pub struct UpdateRoleBody {
    pub role: String,
}

#[derive(Deserialize)]
pub struct ResetPasswordBody {
    pub new_password: String,
}

// ── Handler: Alle User auflisten ─────────────────────────────────────────────

pub async fn list_users(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<Vec<UserEntry>>> {
    if !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }

    let rows = sqlx::query!(
        "SELECT id, username, role, is_admin, totp_enabled, created_at FROM users ORDER BY created_at ASC"
    )
    .fetch_all(&state.db)
    .await?;

    let users = rows
        .into_iter()
        .map(|r| UserEntry {
            id: r.id,
            username: r.username,
            role: r.role,
            is_admin: r.is_admin,
            totp_enabled: r.totp_enabled,
            created_at: r.created_at,
        })
        .collect();

    Ok(Json(users))
}

// ── Handler: Neuen User anlegen ───────────────────────────────────────────────

pub async fn create_user(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateUserBody>,
) -> AppResult<Json<UserEntry>> {
    if !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }

    // Nur Superuser darf Admins anlegen
    if body.role == "admin" && !claims.is_superuser() {
        return Err(AppError::Forbidden);
    }

    // Superuser kann nicht manuell angelegt werden
    if body.role == "superuser" {
        return Err(AppError::BadRequest("Superuser-Rolle kann nicht vergeben werden".into()));
    }

    if body.username.trim().is_empty() {
        return Err(AppError::BadRequest("Benutzername darf nicht leer sein".into()));
    }
    if body.password.len() < 8 {
        return Err(AppError::BadRequest("Passwort muss mindestens 8 Zeichen haben".into()));
    }

    let valid_roles = ["admin", "user"];
    if !valid_roles.contains(&body.role.as_str()) {
        return Err(AppError::BadRequest("Ungültige Rolle".into()));
    }

    let password_hash = hash(&body.password, DEFAULT_COST)
        .map_err(|e| AppError::Internal(e.into()))?;

    let is_admin = body.role == "admin";

    let row = sqlx::query!(
        "INSERT INTO users (username, password_hash, is_admin, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id, username, role, is_admin, totp_enabled, created_at",
        body.username.trim(),
        password_hash,
        is_admin,
        body.role,
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        if e.to_string().contains("unique") {
            AppError::BadRequest("Benutzername bereits vergeben".into())
        } else {
            AppError::Database(e)
        }
    })?;

    Ok(Json(UserEntry {
        id: row.id,
        username: row.username,
        role: row.role,
        is_admin: row.is_admin,
        totp_enabled: row.totp_enabled,
        created_at: row.created_at,
    }))
}

// ── Handler: Rolle ändern ─────────────────────────────────────────────────────

pub async fn update_role(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateRoleBody>,
) -> AppResult<Json<UserEntry>> {
    if !claims.is_superuser() {
        return Err(AppError::Forbidden);
    }

    // Superuser kann seine eigene Rolle nicht ändern
    if id == claims.sub {
        return Err(AppError::BadRequest("Eigene Rolle kann nicht geändert werden".into()));
    }

    // Superuser-Rolle kann nicht vergeben werden
    if body.role == "superuser" {
        return Err(AppError::BadRequest("Superuser-Rolle kann nicht vergeben werden".into()));
    }

    let valid_roles = ["admin", "user"];
    if !valid_roles.contains(&body.role.as_str()) {
        return Err(AppError::BadRequest("Ungültige Rolle".into()));
    }

    let is_admin = body.role == "admin";

    let row = sqlx::query!(
        "UPDATE users SET role = $1, is_admin = $2 WHERE id = $3
         RETURNING id, username, role, is_admin, totp_enabled, created_at",
        body.role,
        is_admin,
        id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(UserEntry {
        id: row.id,
        username: row.username,
        role: row.role,
        is_admin: row.is_admin,
        totp_enabled: row.totp_enabled,
        created_at: row.created_at,
    }))
}

// ── Handler: Passwort zurücksetzen ────────────────────────────────────────────

pub async fn reset_password(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ResetPasswordBody>,
) -> AppResult<Json<serde_json::Value>> {
    if !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }

    if body.new_password.len() < 8 {
        return Err(AppError::BadRequest("Passwort muss mindestens 8 Zeichen haben".into()));
    }

    // Admin darf keine anderen Admins/Superuser resetten
    if !claims.is_superuser() {
        let target = sqlx::query!("SELECT role FROM users WHERE id = $1", id)
            .fetch_optional(&state.db)
            .await?
            .ok_or(AppError::NotFound)?;
        if target.role == "admin" || target.role == "superuser" {
            return Err(AppError::Forbidden);
        }
    }

    let new_hash = hash(&body.new_password, DEFAULT_COST)
        .map_err(|e| AppError::Internal(e.into()))?;

    let result = sqlx::query!(
        "UPDATE users SET password_hash = $1 WHERE id = $2",
        new_hash,
        id
    )
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(Json(serde_json::json!({ "message": "Passwort zurückgesetzt" })))
}

// ── Handler: User löschen ─────────────────────────────────────────────────────

pub async fn delete_user(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    if !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }

    // Niemand kann sich selbst löschen
    if id == claims.sub {
        return Err(AppError::BadRequest("Eigener Account kann nicht gelöscht werden".into()));
    }

    // Superuser kann nicht gelöscht werden
    let target = sqlx::query!("SELECT role FROM users WHERE id = $1", id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)?;

    if target.role == "superuser" {
        return Err(AppError::BadRequest("Superuser kann nicht gelöscht werden".into()));
    }

    // Admin darf nur normale User löschen
    if !claims.is_superuser() && target.role == "admin" {
        return Err(AppError::Forbidden);
    }

    sqlx::query!("DELETE FROM users WHERE id = $1", id)
        .execute(&state.db)
        .await?;

    Ok(Json(serde_json::json!({ "message": "Benutzer gelöscht" })))
}

// ── Router ────────────────────────────────────────────────────────────────────

pub fn router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/users", get(list_users).post(create_user))
        .route("/users/:id/role", put(update_role))
        .route("/users/:id/reset-password", post(reset_password))
        .route("/users/:id", delete(delete_user))
        .route_layer(middleware::from_fn_with_state(state, require_auth))
}
