use axum::{
    middleware,
    routing::{get, post, put},
    Router,
};

use crate::{
    auth::{
        handlers::{
            change_password, confirm_totp, disable_totp, initial_setup, login, me, setup_status,
            setup_totp, update_profile, verify_totp,
        },
        middleware::{require_auth, require_partial_auth},
        rate_limit::{login_rate_limit, LoginRateLimiter},
    },
    AppState,
};

pub fn router(state: AppState) -> Router<AppState> {
    let rate_limiter = LoginRateLimiter::new();

    // Öffentliche Routen ohne Rate-Limiting
    let public_open = Router::new()
        .route("/setup-status", get(setup_status));

    // Routen ohne Auth, aber mit Rate-Limiting
    let public = Router::new()
        .route("/login", post(login))
        .route("/setup", post(initial_setup))
        .route_layer(middleware::from_fn_with_state(rate_limiter, login_rate_limit));

    // Routen mit partiellem Auth (JWT gültig, TOTP noch nicht nötig)
    let partial_auth = Router::new()
        .route("/verify-totp", post(verify_totp))
        .route("/setup-totp", post(setup_totp))
        .route("/confirm-totp", post(confirm_totp))
        .route_layer(middleware::from_fn_with_state(state.clone(), require_partial_auth));

    // Vollständig authentifizierte Routen
    let protected = Router::new()
        .route("/me", get(me))
        .route("/profile", put(update_profile))
        .route("/change-password", post(change_password))
        .route("/disable-totp", post(disable_totp))
        .route_layer(middleware::from_fn_with_state(state, require_auth));

    Router::new()
        .merge(public_open)
        .merge(public)
        .merge(partial_auth)
        .merge(protected)
}
