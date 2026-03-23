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

#[derive(Serialize, sqlx::FromRow)]
pub struct Announcement {
    pub id: Uuid,
    pub title: String,
    pub content: String,
    pub pinned: bool,
    pub created_by: Option<Uuid>,
    pub created_by_name: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct AnnouncementBody {
    pub title: String,
    pub content: String,
    pub pinned: Option<bool>,
}

// ── GET /api/announcements — alle eingeloggten User ───────────────────────────

pub async fn list_announcements(
    State(state): State<AppState>,
) -> AppResult<Json<Vec<Announcement>>> {
    let rows = sqlx::query_as::<_, Announcement>(
        "SELECT id, title, content, pinned, created_by, created_by_name, created_at, updated_at
         FROM announcements
         ORDER BY pinned DESC, created_at DESC"
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(rows))
}

// ── POST /api/announcements — nur Admin ───────────────────────────────────────

pub async fn create_announcement(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<AnnouncementBody>,
) -> AppResult<Json<Announcement>> {
    if !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }

    if body.title.trim().is_empty() {
        return Err(AppError::BadRequest("Titel darf nicht leer sein".into()));
    }
    if body.content.trim().is_empty() {
        return Err(AppError::BadRequest("Inhalt darf nicht leer sein".into()));
    }

    let display_name: Option<String> = sqlx::query_scalar(
        "SELECT display_name FROM users WHERE id = $1"
    )
    .bind(claims.sub)
    .fetch_optional(&state.db)
    .await?
    .flatten();

    let author = display_name.unwrap_or_else(|| claims.username.clone());
    let pinned = body.pinned.unwrap_or(false);

    let row = sqlx::query_as::<_, Announcement>(
        "INSERT INTO announcements (title, content, pinned, created_by, created_by_name)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, title, content, pinned, created_by, created_by_name, created_at, updated_at"
    )
    .bind(body.title.trim())
    .bind(body.content.trim())
    .bind(pinned)
    .bind(claims.sub)
    .bind(&author)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(row))
}

// ── PUT /api/announcements/:id — nur Admin ────────────────────────────────────

pub async fn update_announcement(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<AnnouncementBody>,
) -> AppResult<Json<Announcement>> {
    if !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }

    if body.title.trim().is_empty() {
        return Err(AppError::BadRequest("Titel darf nicht leer sein".into()));
    }

    let pinned = body.pinned.unwrap_or(false);

    let row = sqlx::query_as::<_, Announcement>(
        "UPDATE announcements
         SET title = $1, content = $2, pinned = $3
         WHERE id = $4
         RETURNING id, title, content, pinned, created_by, created_by_name, created_at, updated_at"
    )
    .bind(body.title.trim())
    .bind(body.content.trim())
    .bind(pinned)
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(row))
}

// ── DELETE /api/announcements/:id — nur Admin ─────────────────────────────────

pub async fn delete_announcement(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    if !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }

    let result = sqlx::query("DELETE FROM announcements WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(Json(serde_json::json!({ "message": "Ankündigung gelöscht" })))
}

// ── Router ────────────────────────────────────────────────────────────────────

pub fn router(state: AppState) -> Router<AppState> {
    let protected = Router::new()
        .route("/", post(create_announcement))
        .route("/:id", put(update_announcement).delete(delete_announcement))
        .route_layer(middleware::from_fn_with_state(state.clone(), require_auth));

    Router::new()
        .route("/", get(list_announcements))
        .merge(protected)
        .route_layer(middleware::from_fn_with_state(state, require_auth))
}
