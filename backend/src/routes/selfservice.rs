use axum::{
    extract::State,
    middleware,
    routing::{get, put},
    Extension, Json, Router,
};
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    auth::middleware::{require_auth, Claims},
    errors::AppResult,
    AppState,
};

// ── Structs ───────────────────────────────────────────────────────────────────

#[derive(Serialize, sqlx::FromRow)]
pub struct MemberProfile {
    pub id:                      Uuid,
    pub user_id:                 Uuid,
    pub phone:                   Option<String>,
    pub email_private:           Option<String>,
    pub address:                 Option<String>,
    pub emergency_contact_name:  Option<String>,
    pub emergency_contact_phone: Option<String>,
    pub updated_at:              DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct UpdateProfileBody {
    pub phone:                   Option<String>,
    pub email_private:           Option<String>,
    pub address:                 Option<String>,
    pub emergency_contact_name:  Option<String>,
    pub emergency_contact_phone: Option<String>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct Qualification {
    pub id:          Uuid,
    pub user_id:     Uuid,
    pub name:        String,
    pub acquired_at: Option<NaiveDate>,
    pub expires_at:  Option<NaiveDate>,
    pub notes:       Option<String>,
    pub created_at:  DateTime<Utc>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct Equipment {
    pub id:         Uuid,
    pub user_id:    Uuid,
    pub r#type:     String,
    pub identifier: Option<String>,
    pub issued_at:  Option<NaiveDate>,
    pub expires_at: Option<NaiveDate>,
    pub notes:      Option<String>,
    pub created_at: DateTime<Utc>,
}

// ── Profil lesen ──────────────────────────────────────────────────────────────

pub async fn get_profile(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<MemberProfile>> {
    let profile = sqlx::query_as::<_, MemberProfile>(
        "SELECT id, user_id, phone, email_private, address,
                emergency_contact_name, emergency_contact_phone, updated_at
         FROM member_profiles WHERE user_id = $1"
    )
    .bind(claims.sub)
    .fetch_optional(&state.db)
    .await?;

    if let Some(p) = profile {
        return Ok(Json(p));
    }

    // Profil noch nicht vorhanden → anlegen
    let new_profile = sqlx::query_as::<_, MemberProfile>(
        "INSERT INTO member_profiles (user_id)
         VALUES ($1)
         RETURNING id, user_id, phone, email_private, address,
                   emergency_contact_name, emergency_contact_phone, updated_at"
    )
    .bind(claims.sub)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(new_profile))
}

// ── Profil bearbeiten ─────────────────────────────────────────────────────────

pub async fn update_profile(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpdateProfileBody>,
) -> AppResult<Json<MemberProfile>> {
    let profile = sqlx::query_as::<_, MemberProfile>(
        "INSERT INTO member_profiles (user_id, phone, email_private, address,
             emergency_contact_name, emergency_contact_phone)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id) DO UPDATE SET
             phone                   = EXCLUDED.phone,
             email_private           = EXCLUDED.email_private,
             address                 = EXCLUDED.address,
             emergency_contact_name  = EXCLUDED.emergency_contact_name,
             emergency_contact_phone = EXCLUDED.emergency_contact_phone,
             updated_at              = NOW()
         RETURNING id, user_id, phone, email_private, address,
                   emergency_contact_name, emergency_contact_phone, updated_at"
    )
    .bind(claims.sub)
    .bind(body.phone.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .bind(body.email_private.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .bind(body.address.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .bind(body.emergency_contact_name.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .bind(body.emergency_contact_phone.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .fetch_one(&state.db)
    .await?;

    Ok(Json(profile))
}

// ── Qualifikationen lesen ─────────────────────────────────────────────────────

pub async fn get_qualifications(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<Vec<Qualification>>> {
    let qualifications = sqlx::query_as::<_, Qualification>(
        "SELECT id, user_id, name, acquired_at, expires_at, notes, created_at
         FROM qualifications
         WHERE user_id = $1
         ORDER BY expires_at ASC NULLS LAST, name ASC"
    )
    .bind(claims.sub)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(qualifications))
}

// ── Ausrüstung lesen ──────────────────────────────────────────────────────────

pub async fn get_equipment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<Vec<Equipment>>> {
    let equipment = sqlx::query_as::<_, Equipment>(
        "SELECT id, user_id, type, identifier, issued_at, expires_at, notes, created_at
         FROM member_equipment
         WHERE user_id = $1
         ORDER BY type ASC, created_at ASC"
    )
    .bind(claims.sub)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(equipment))
}

// ── Router ────────────────────────────────────────────────────────────────────

pub fn router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/profile",        get(get_profile).put(update_profile))
        .route("/qualifications", get(get_qualifications))
        .route("/equipment",      get(get_equipment))
        .route_layer(middleware::from_fn_with_state(state, require_auth))
}
