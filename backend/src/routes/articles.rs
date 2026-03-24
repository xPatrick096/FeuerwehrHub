use axum::{
    extract::{Path, State},
    middleware,
    routing::{delete, get, post, put},
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::{
    auth::middleware::{require_auth, require_module},
    errors::{AppError, AppResult},
    AppState,
};

#[derive(Serialize, FromRow)]
pub struct Article {
    pub id:            Uuid,
    pub name:          String,
    pub category:      Option<String>,
    pub unit:          String,
    pub min_stock:     i32,
    pub current_stock: i32,
    pub notes:         Option<String>,
    pub created_at:    DateTime<Utc>,
    pub updated_at:    DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct ArticleBody {
    pub name:          String,
    pub category:      Option<String>,
    pub unit:          String,
    pub min_stock:     Option<i32>,
    pub current_stock: Option<i32>,
    pub notes:         Option<String>,
}

pub async fn list_articles(
    State(state): State<AppState>,
) -> AppResult<Json<Vec<Article>>> {
    let rows = sqlx::query_as::<_, Article>(
        "SELECT id, name, category, unit, min_stock, current_stock, notes, created_at, updated_at
         FROM articles ORDER BY name ASC"
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(rows))
}

pub async fn get_article(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<Article>> {
    let row = sqlx::query_as::<_, Article>(
        "SELECT id, name, category, unit, min_stock, current_stock, notes, created_at, updated_at
         FROM articles WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(row))
}

pub async fn create_article(
    State(state): State<AppState>,
    Json(body): Json<ArticleBody>,
) -> AppResult<Json<Article>> {
    if body.name.trim().is_empty() {
        return Err(AppError::BadRequest("Name darf nicht leer sein".into()));
    }

    let row = sqlx::query_as::<_, Article>(
        "INSERT INTO articles (name, category, unit, min_stock, current_stock, notes)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, name, category, unit, min_stock, current_stock, notes, created_at, updated_at"
    )
    .bind(body.name.trim())
    .bind(body.category)
    .bind(body.unit)
    .bind(body.min_stock.unwrap_or(0))
    .bind(body.current_stock.unwrap_or(0))
    .bind(body.notes)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(row))
}

pub async fn update_article(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<ArticleBody>,
) -> AppResult<Json<Article>> {
    if body.name.trim().is_empty() {
        return Err(AppError::BadRequest("Name darf nicht leer sein".into()));
    }

    let row = sqlx::query_as::<_, Article>(
        "UPDATE articles SET name=$1, category=$2, unit=$3, min_stock=$4, current_stock=$5, notes=$6
         WHERE id = $7
         RETURNING id, name, category, unit, min_stock, current_stock, notes, created_at, updated_at"
    )
    .bind(body.name.trim())
    .bind(body.category)
    .bind(body.unit)
    .bind(body.min_stock.unwrap_or(0))
    .bind(body.current_stock.unwrap_or(0))
    .bind(body.notes)
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(row))
}

pub async fn delete_article(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let result = sqlx::query("DELETE FROM articles WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(Json(serde_json::json!({ "message": "Artikel gelöscht" })))
}

#[derive(Serialize, FromRow)]
pub struct Unit {
    pub id:    i32,
    pub label: String,
}

pub async fn list_units(State(state): State<AppState>) -> AppResult<Json<Vec<Unit>>> {
    let rows = sqlx::query_as::<_, Unit>("SELECT id, label FROM units ORDER BY id ASC")
        .fetch_all(&state.db)
        .await?;

    Ok(Json(rows))
}

pub fn router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/", get(list_articles).post(create_article))
        .route("/:id", get(get_article).put(update_article).delete(delete_article))
        .route("/units", get(list_units))
        .route_layer(middleware::from_fn_with_state(state.clone(), require_module("lager")))
        .route_layer(middleware::from_fn_with_state(state, require_auth))
}
