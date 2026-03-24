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
    audit,
    auth::middleware::{require_auth, Claims},
    errors::{AppError, AppResult},
    AppState,
};

// ── Structs ───────────────────────────────────────────────────────────────────

#[derive(Serialize, sqlx::FromRow)]
pub struct UserEntry {
    pub id: Uuid,
    pub username: String,
    pub role: String,
    pub is_admin: bool,
    pub totp_enabled: bool,
    pub permissions: Vec<String>,
    pub role_id: Option<Uuid>,
    pub assigned_role_name: Option<String>,
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

#[derive(Deserialize)]
pub struct UpdatePermissionsBody {
    pub permissions: Vec<String>,
}

#[derive(Deserialize)]
pub struct AssignRoleBody {
    pub role_id: Option<Uuid>,
}

// ── Handler: Alle User auflisten ─────────────────────────────────────────────

pub async fn list_users(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<Vec<UserEntry>>> {
    if !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }

    let users = sqlx::query_as::<_, UserEntry>(
        "SELECT u.id, u.username, u.role, u.is_admin, u.totp_enabled,
                u.permissions, u.role_id, r.name as assigned_role_name, u.created_at
         FROM users u
         LEFT JOIN roles r ON r.id = u.role_id
         ORDER BY u.created_at ASC"
    )
    .fetch_all(&state.db)
    .await?;

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

    let new_id: Uuid = sqlx::query_scalar(
        "INSERT INTO users (username, password_hash, is_admin, role)
         VALUES ($1, $2, $3, $4) RETURNING id"
    )
    .bind(body.username.trim())
    .bind(password_hash)
    .bind(is_admin)
    .bind(&body.role)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        if e.to_string().contains("unique") {
            AppError::BadRequest("Benutzername bereits vergeben".into())
        } else {
            AppError::Database(e)
        }
    })?;

    let row = sqlx::query_as::<_, UserEntry>(
        "SELECT u.id, u.username, u.role, u.is_admin, u.totp_enabled,
                u.permissions, u.role_id, r.name as assigned_role_name, u.created_at
         FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = $1"
    )
    .bind(new_id)
    .fetch_one(&state.db)
    .await?;

    audit::log(&state.db, Some(claims.sub), &claims.username, "USER_CREATED",
        Some("user"), Some(new_id), Some(&format!("Rolle: {}", body.role))).await;

    Ok(Json(row))
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

    let updated = sqlx::query_scalar::<_, Uuid>(
        "UPDATE users SET role = $1, is_admin = $2 WHERE id = $3 RETURNING id"
    )
    .bind(&body.role)
    .bind(is_admin)
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    let row = sqlx::query_as::<_, UserEntry>(
        "SELECT u.id, u.username, u.role, u.is_admin, u.totp_enabled,
                u.permissions, u.role_id, r.name as assigned_role_name, u.created_at
         FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = $1"
    )
    .bind(updated)
    .fetch_one(&state.db)
    .await?;

    audit::log(&state.db, Some(claims.sub), &claims.username, "ROLE_CHANGED",
        Some("user"), Some(id), Some(&format!("Neue Systemrolle: {}", body.role))).await;

    Ok(Json(row))
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

    audit::log(&state.db, Some(claims.sub), &claims.username, "PASSWORD_RESET",
        Some("user"), Some(id), None).await;

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

    let username_row = sqlx::query_as::<_, (String,)>("SELECT username FROM users WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)?;

    sqlx::query!("DELETE FROM users WHERE id = $1", id)
        .execute(&state.db)
        .await?;

    audit::log(&state.db, Some(claims.sub), &claims.username, "USER_DELETED",
        Some("user"), Some(id), Some(&format!("Gelöschter Benutzer: {}", username_row.0))).await;

    Ok(Json(serde_json::json!({ "message": "Benutzer gelöscht" })))
}

// ── Handler: Rolle zuweisen ───────────────────────────────────────────────────

pub async fn assign_role(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<AssignRoleBody>,
) -> AppResult<Json<serde_json::Value>> {
    if !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }

    let result = sqlx::query("UPDATE users SET role_id = $1 WHERE id = $2")
        .bind(body.role_id)
        .bind(id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(Json(serde_json::json!({ "message": "Rolle zugewiesen" })))
}

// ── Handler: Berechtigungen setzen ───────────────────────────────────────────

pub async fn update_permissions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdatePermissionsBody>,
) -> AppResult<Json<serde_json::Value>> {
    if !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }

    // Admins/Superuser brauchen keine expliziten Permissions
    let target = sqlx::query_as::<_, (String,)>("SELECT role FROM users WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)?;

    if target.0 == "admin" || target.0 == "superuser" {
        return Err(AppError::BadRequest(
            "Admins und Superuser haben immer Zugriff auf alle Module".into(),
        ));
    }

    // Nur bekannte Module erlauben
    let known: &[&str] = &["lager"];
    let permissions: Vec<String> = body.permissions
        .into_iter()
        .filter(|p| known.contains(&p.as_str()))
        .collect();

    sqlx::query("UPDATE users SET permissions = $1 WHERE id = $2")
        .bind(&permissions)
        .bind(id)
        .execute(&state.db)
        .await?;

    Ok(Json(serde_json::json!({ "permissions": permissions })))
}

// ── Handler: 2FA zurücksetzen (Admin) ─────────────────────────────────────────

pub async fn reset_totp(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    if !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }

    // Niemand kann eigene 2FA so zurücksetzen (dafür gibt es /auth/disable-totp)
    if id == claims.sub {
        return Err(AppError::BadRequest(
            "Eigene 2FA über Einstellungen deaktivieren".into(),
        ));
    }

    let target = sqlx::query_as::<_, (String,)>("SELECT role FROM users WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)?;

    // Admin darf keine anderen Admins/Superuser anfassen
    if !claims.is_superuser() && (target.0 == "admin" || target.0 == "superuser") {
        return Err(AppError::Forbidden);
    }

    let result = sqlx::query(
        "UPDATE users SET totp_enabled = FALSE, totp_secret = NULL WHERE id = $1"
    )
    .bind(id)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    audit::log(&state.db, Some(claims.sub), &claims.username, "TOTP_RESET_BY_ADMIN",
        Some("user"), Some(id), None).await;

    Ok(Json(serde_json::json!({ "message": "2FA zurückgesetzt" })))
}

// ── Handler: Audit-Log abrufen ────────────────────────────────────────────────

#[derive(Serialize, sqlx::FromRow)]
pub struct AuditEntry {
    pub id: Uuid,
    pub user_id: Option<Uuid>,
    pub username: String,
    pub action: String,
    pub entity: Option<String>,
    pub entity_id: Option<Uuid>,
    pub details: Option<String>,
    pub created_at: DateTime<Utc>,
}

pub async fn get_audit_log(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<Vec<AuditEntry>>> {
    if !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }

    let entries = sqlx::query_as::<_, AuditEntry>(
        "SELECT id, user_id, username, action, entity, entity_id, details, created_at
         FROM audit_log ORDER BY created_at DESC LIMIT 500"
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(entries))
}

// ── Router ────────────────────────────────────────────────────────────────────

pub fn router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/users", get(list_users).post(create_user))
        .route("/users/:id/role", put(update_role))
        .route("/users/:id/reset-password", post(reset_password))
        .route("/users/:id/permissions", put(update_permissions))
        .route("/users/:id/assign-role", put(assign_role))
        .route("/users/:id", delete(delete_user))
        .route("/users/:id/reset-totp", post(reset_totp))
        .route("/audit-log", get(get_audit_log))
        .route_layer(middleware::from_fn_with_state(state, require_auth))
}
