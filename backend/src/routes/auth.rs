use axum::{
    middleware,
    routing::{get, post},
    Router,
};

use crate::{
    auth::{
        handlers::{
            change_password, confirm_totp, initial_setup, login, me, setup_totp, verify_totp,
        },
        middleware::require_auth,
    },
    AppState,
};

pub fn router(state: AppState) -> Router<AppState> {
    // Routen ohne Auth
    let public = Router::new()
        .route("/login", post(login))
        .route("/setup", post(initial_setup));

    // Routen mit Auth (TOTP noch nicht zwingend)
    let partial_auth = Router::new()
        .route("/verify-totp", post(verify_totp))
        .route("/setup-totp", post(setup_totp))
        .route("/confirm-totp", post(confirm_totp))
        .route_layer(middleware::from_fn_with_state(state.clone(), require_auth));

    // Vollständig authentifizierte Routen
    let protected = Router::new()
        .route("/me", get(me))
        .route("/change-password", post(change_password))
        .route_layer(middleware::from_fn_with_state(state, require_auth));

    Router::new()
        .merge(public)
        .merge(partial_auth)
        .merge(protected)
}
