use axum::{
    extract::State,
    middleware,
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::{
    auth::middleware::require_auth,
    errors::AppResult,
    AppState,
};

#[derive(Serialize)]
pub struct Settings {
    pub ff_name: String,
    pub ff_strasse: String,
    pub ff_ort: String,
    pub setup_complete: bool,
}

#[derive(Deserialize)]
pub struct UpdateSettings {
    pub ff_name: Option<String>,
    pub ff_strasse: Option<String>,
    pub ff_ort: Option<String>,
}

pub async fn get_settings(State(state): State<AppState>) -> AppResult<Json<Settings>> {
    let rows = sqlx::query!("SELECT key, value FROM settings")
        .fetch_all(&state.db)
        .await?;

    let map: HashMap<String, String> = rows.into_iter().map(|r| (r.key, r.value)).collect();

    Ok(Json(Settings {
        ff_name: map.get("ff_name").cloned().unwrap_or_default(),
        ff_strasse: map.get("ff_strasse").cloned().unwrap_or_default(),
        ff_ort: map.get("ff_ort").cloned().unwrap_or_default(),
        setup_complete: map.get("setup_complete").map(|v| v == "true").unwrap_or(false),
    }))
}

pub async fn update_settings(
    State(state): State<AppState>,
    Json(body): Json<UpdateSettings>,
) -> AppResult<Json<Settings>> {
    if let Some(name) = &body.ff_name {
        sqlx::query!(
            "INSERT INTO settings (key, value) VALUES ('ff_name', $1)
             ON CONFLICT (key) DO UPDATE SET value = $1",
            name
        )
        .execute(&state.db)
        .await?;
    }

    if let Some(strasse) = &body.ff_strasse {
        sqlx::query!(
            "INSERT INTO settings (key, value) VALUES ('ff_strasse', $1)
             ON CONFLICT (key) DO UPDATE SET value = $1",
            strasse
        )
        .execute(&state.db)
        .await?;
    }

    if let Some(ort) = &body.ff_ort {
        sqlx::query!(
            "INSERT INTO settings (key, value) VALUES ('ff_ort', $1)
             ON CONFLICT (key) DO UPDATE SET value = $1",
            ort
        )
        .execute(&state.db)
        .await?;
    }

    get_settings(State(state)).await
}

pub fn router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/", get(get_settings).put(update_settings))
        .route_layer(middleware::from_fn_with_state(state, require_auth))
}
