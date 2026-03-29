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
    auth::middleware::{require_auth, require_module, Claims},
    errors::{AppError, AppResult},
    AppState,
};

// ── Structs ───────────────────────────────────────────────────────────────────

#[derive(Serialize, sqlx::FromRow)]
pub struct TerminTyp {
    pub id:         Uuid,
    pub name:       String,
    pub color:      String,
    pub is_default: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct TerminTypBody {
    pub name:  String,
    pub color: Option<String>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct Termin {
    pub id:               Uuid,
    pub title:            String,
    pub typ_id:           Option<Uuid>,
    pub typ_name:         Option<String>,
    pub typ_color:        Option<String>,
    pub start_at:         DateTime<Utc>,
    pub end_at:           Option<DateTime<Utc>>,
    pub location:         Option<String>,
    pub description:      Option<String>,
    pub created_by:       Uuid,
    pub created_by_name:  Option<String>,
    pub created_at:       DateTime<Utc>,
    pub updated_at:       DateTime<Utc>,
    pub assignment_count: i64,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct MyTermin {
    pub id:          Uuid,
    pub title:       String,
    pub typ_id:      Option<Uuid>,
    pub typ_name:    Option<String>,
    pub typ_color:   Option<String>,
    pub start_at:    DateTime<Utc>,
    pub end_at:      Option<DateTime<Utc>>,
    pub location:    Option<String>,
    pub description: Option<String>,
    pub created_at:  DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct TerminBody {
    pub title:       String,
    pub typ_id:      Option<Uuid>,
    pub start_at:    DateTime<Utc>,
    pub end_at:      Option<DateTime<Utc>>,
    pub location:    Option<String>,
    pub description: Option<String>,
}

#[derive(Deserialize)]
pub struct AssignBody {
    pub user_ids: Vec<Uuid>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct AssignedUser {
    pub user_id:      Uuid,
    pub display_name: Option<String>,
    pub username:     String,
}

// ── Termintypen ───────────────────────────────────────────────────────────────

pub async fn list_typen(
    State(state): State<AppState>,
) -> AppResult<Json<Vec<TerminTyp>>> {
    let typen = sqlx::query_as::<_, TerminTyp>(
        "SELECT id, name, color, is_default, created_at
         FROM termin_typen
         ORDER BY is_default DESC, name ASC"
    )
    .fetch_all(&state.db)
    .await?;
    Ok(Json(typen))
}

pub async fn create_typ(
    State(state): State<AppState>,
    Json(body): Json<TerminTypBody>,
) -> AppResult<Json<TerminTyp>> {
    let name = body.name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::BadRequest("Name darf nicht leer sein".into()));
    }
    let color = body.color
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("#6b7280")
        .to_string();

    let typ = sqlx::query_as::<_, TerminTyp>(
        "INSERT INTO termin_typen (name, color)
         VALUES ($1, $2)
         RETURNING id, name, color, is_default, created_at"
    )
    .bind(&name)
    .bind(&color)
    .fetch_one(&state.db)
    .await?;
    Ok(Json(typ))
}

pub async fn delete_typ(
    State(state): State<AppState>,
    Path(typ_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let is_default: bool = sqlx::query_scalar(
        "SELECT is_default FROM termin_typen WHERE id = $1"
    )
    .bind(typ_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    if is_default {
        return Err(AppError::BadRequest(
            "Standardtypen können nicht gelöscht werden".into(),
        ));
    }

    sqlx::query("DELETE FROM termin_typen WHERE id = $1")
        .bind(typ_id)
        .execute(&state.db)
        .await?;

    Ok(Json(serde_json::json!({ "message": "Typ gelöscht" })))
}

// ── Termine (Personal-Modul) ──────────────────────────────────────────────────

pub async fn list_termine(
    State(state): State<AppState>,
) -> AppResult<Json<Vec<Termin>>> {
    let termine = sqlx::query_as::<_, Termin>(
        "SELECT t.id, t.title, t.typ_id, tt.name AS typ_name, tt.color AS typ_color,
                t.start_at, t.end_at, t.location, t.description,
                t.created_by, u.display_name AS created_by_name,
                t.created_at, t.updated_at,
                COUNT(ta.user_id) AS assignment_count
         FROM termine t
         LEFT JOIN termin_typen tt ON tt.id = t.typ_id
         LEFT JOIN users u         ON u.id  = t.created_by
         LEFT JOIN termin_assignments ta ON ta.termin_id = t.id
         GROUP BY t.id, tt.name, tt.color, u.display_name
         ORDER BY t.start_at ASC"
    )
    .fetch_all(&state.db)
    .await?;
    Ok(Json(termine))
}

pub async fn create_termin(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<TerminBody>,
) -> AppResult<Json<Termin>> {
    let title = body.title.trim().to_string();
    if title.is_empty() {
        return Err(AppError::BadRequest("Titel darf nicht leer sein".into()));
    }

    let t = sqlx::query_as::<_, Termin>(
        "WITH ins AS (
             INSERT INTO termine (title, typ_id, start_at, end_at, location, description, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *
         )
         SELECT ins.id, ins.title, ins.typ_id,
                tt.name AS typ_name, tt.color AS typ_color,
                ins.start_at, ins.end_at, ins.location, ins.description,
                ins.created_by, u.display_name AS created_by_name,
                ins.created_at, ins.updated_at,
                0::bigint AS assignment_count
         FROM ins
         LEFT JOIN termin_typen tt ON tt.id = ins.typ_id
         LEFT JOIN users u         ON u.id  = ins.created_by"
    )
    .bind(&title)
    .bind(body.typ_id)
    .bind(body.start_at)
    .bind(body.end_at)
    .bind(body.location.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .bind(body.description.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .bind(claims.sub)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(t))
}

pub async fn update_termin(
    State(state): State<AppState>,
    Path(termin_id): Path<Uuid>,
    Json(body): Json<TerminBody>,
) -> AppResult<Json<Termin>> {
    let title = body.title.trim().to_string();
    if title.is_empty() {
        return Err(AppError::BadRequest("Titel darf nicht leer sein".into()));
    }

    let t = sqlx::query_as::<_, Termin>(
        "WITH upd AS (
             UPDATE termine
             SET title = $1, typ_id = $2, start_at = $3, end_at = $4,
                 location = $5, description = $6, updated_at = NOW()
             WHERE id = $7
             RETURNING *
         )
         SELECT upd.id, upd.title, upd.typ_id,
                tt.name AS typ_name, tt.color AS typ_color,
                upd.start_at, upd.end_at, upd.location, upd.description,
                upd.created_by, u.display_name AS created_by_name,
                upd.created_at, upd.updated_at,
                COUNT(ta.user_id) AS assignment_count
         FROM upd
         LEFT JOIN termin_typen tt ON tt.id = upd.typ_id
         LEFT JOIN users u         ON u.id  = upd.created_by
         LEFT JOIN termin_assignments ta ON ta.termin_id = upd.id
         GROUP BY upd.id, upd.title, upd.typ_id, tt.name, tt.color,
                  upd.start_at, upd.end_at, upd.location, upd.description,
                  upd.created_by, u.display_name, upd.created_at, upd.updated_at"
    )
    .bind(&title)
    .bind(body.typ_id)
    .bind(body.start_at)
    .bind(body.end_at)
    .bind(body.location.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .bind(body.description.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .bind(termin_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(t))
}

pub async fn delete_termin(
    State(state): State<AppState>,
    Path(termin_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let result = sqlx::query("DELETE FROM termine WHERE id = $1")
        .bind(termin_id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(Json(serde_json::json!({ "message": "Termin gelöscht" })))
}

// ── Zuweisungen ───────────────────────────────────────────────────────────────

pub async fn get_assignments(
    State(state): State<AppState>,
    Path(termin_id): Path<Uuid>,
) -> AppResult<Json<Vec<AssignedUser>>> {
    let users = sqlx::query_as::<_, AssignedUser>(
        "SELECT u.id AS user_id, u.display_name, u.username
         FROM termin_assignments ta
         JOIN users u ON u.id = ta.user_id
         WHERE ta.termin_id = $1
         ORDER BY u.display_name ASC, u.username ASC"
    )
    .bind(termin_id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(users))
}

pub async fn set_assignments(
    State(state): State<AppState>,
    Path(termin_id): Path<Uuid>,
    Json(body): Json<AssignBody>,
) -> AppResult<Json<Vec<AssignedUser>>> {
    let mut tx = state.db.begin().await?;

    sqlx::query("DELETE FROM termin_assignments WHERE termin_id = $1")
        .bind(termin_id)
        .execute(&mut *tx)
        .await?;

    for user_id in &body.user_ids {
        sqlx::query(
            "INSERT INTO termin_assignments (termin_id, user_id) VALUES ($1, $2)
             ON CONFLICT DO NOTHING"
        )
        .bind(termin_id)
        .bind(user_id)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    let users = sqlx::query_as::<_, AssignedUser>(
        "SELECT u.id AS user_id, u.display_name, u.username
         FROM termin_assignments ta
         JOIN users u ON u.id = ta.user_id
         WHERE ta.termin_id = $1
         ORDER BY u.display_name ASC, u.username ASC"
    )
    .bind(termin_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(users))
}

// ── Mein Bereich: meine Termine ───────────────────────────────────────────────

pub async fn get_my_termine(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<Vec<MyTermin>>> {
    let termine = sqlx::query_as::<_, MyTermin>(
        "SELECT t.id, t.title, t.typ_id,
                tt.name AS typ_name, tt.color AS typ_color,
                t.start_at, t.end_at, t.location, t.description, t.created_at
         FROM termine t
         LEFT JOIN termin_typen tt ON tt.id = t.typ_id
         WHERE
             NOT EXISTS (SELECT 1 FROM termin_assignments ta WHERE ta.termin_id = t.id)
             OR
             EXISTS (SELECT 1 FROM termin_assignments ta
                     WHERE ta.termin_id = t.id AND ta.user_id = $1)
         ORDER BY t.start_at ASC"
    )
    .bind(claims.sub)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(termine))
}

// ── Router ────────────────────────────────────────────────────────────────────

/// Routen unter /api/personal — benötigen Auth + Modul-Berechtigung "personal"
pub fn personal_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/termin-typen",            get(list_typen).post(create_typ))
        .route("/termin-typen/:id",        delete(delete_typ))
        .route("/termine",                 get(list_termine).post(create_termin))
        .route("/termine/:id",             put(update_termin).delete(delete_termin))
        .route("/termine/:id/assignments", get(get_assignments).post(set_assignments))
        .route_layer(middleware::from_fn_with_state(state.clone(), require_module("personal")))
        .route_layer(middleware::from_fn_with_state(state, require_auth))
}

/// Routen unter /api/me — benötigen nur Auth
pub fn me_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/termine", get(get_my_termine))
        .route_layer(middleware::from_fn_with_state(state, require_auth))
}
