mod audit;
mod auth;
mod config;
mod errors;
mod log_buffer;
mod routes;
mod updater;

use axum::{
    http::{HeaderValue, Method},
    Router,
};
use sqlx::PgPool;
use tower_http::{
    cors::CorsLayer,
    set_header::SetResponseHeaderLayer,
    trace::TraceLayer,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use config::Config;
use log_buffer::{LogBuffer, LogBufferLayer};
use updater::UpdateState;

#[derive(Clone)]
pub struct AppState {
    pub db:           PgPool,
    pub config:       Config,
    pub log_buffer:   LogBuffer,
    pub update_state: UpdateState,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let log_buffer = LogBuffer::new();

    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .with(LogBufferLayer::new(log_buffer.clone()))
        .init();

    let config = Config::from_env()?;
    tracing::info!("Starte FeuerwehrHub für: {}", config.ff_name);

    let pool = PgPool::connect(&config.database_url()).await?;
    tracing::info!("Datenbankverbindung hergestellt");

    sqlx::migrate!("../migrations").run(&pool).await?;
    tracing::info!("Migrationen abgeschlossen");

    let state = AppState {
        db:           pool,
        config:       config.clone(),
        log_buffer,
        update_state: UpdateState::new(),
    };

    let origin: HeaderValue = config.frontend_url
        .parse()
        .expect("FRONTEND_URL ist keine gültige Origin");

    let cors = CorsLayer::new()
        .allow_origin(origin)
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
        .allow_headers([
            axum::http::header::AUTHORIZATION,
            axum::http::header::CONTENT_TYPE,
        ]);

    let app = Router::new()
        .nest("/api/auth",          routes::auth::router(state.clone()))
        .nest("/api/admin",         routes::admin::router(state.clone()))
        .nest("/api/roles",         routes::roles::router(state.clone()))
        .nest("/api/orders",        routes::orders::router(state.clone()))
        .nest("/api/articles",      routes::articles::router(state.clone()))
        .nest("/api/settings",      routes::settings::router(state.clone()))
        .nest("/api/announcements", routes::announcements::router(state.clone()))
        .nest("/api/me",            routes::selfservice::router(state.clone()))
        .nest("/api/personal",      routes::personal::router(state.clone()))
        .nest("/api/vehicles",           routes::vehicles::router(state.clone()))
        .nest("/api/incident-types",     routes::incident_types::router(state.clone()))
        .nest("/api/einsatzberichte",    routes::incidents::router(state.clone()))
        .with_state(state)
        .layer(cors)
        .layer(SetResponseHeaderLayer::if_not_present(
            axum::http::header::HeaderName::from_static("x-content-type-options"),
            HeaderValue::from_static("nosniff"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            axum::http::header::HeaderName::from_static("x-frame-options"),
            HeaderValue::from_static("DENY"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            axum::http::header::HeaderName::from_static("referrer-policy"),
            HeaderValue::from_static("strict-origin-when-cross-origin"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            axum::http::header::HeaderName::from_static("content-security-policy"),
            HeaderValue::from_static(
                "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; frame-ancestors 'none'",
            ),
        ))
        .layer(TraceLayer::new_for_http());

    let addr = format!("{}:{}", config.app_host, config.app_port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    tracing::info!("Server läuft auf http://{}", addr);

    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<std::net::SocketAddr>(),
    )
    .await?;

    Ok(())
}
