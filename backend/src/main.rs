mod auth;
mod config;
mod errors;
mod routes;

use axum::{
    http::{HeaderValue, Method},
    Router,
};
use sqlx::PgPool;
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use config::Config;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub config: Config,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = Config::from_env()?;
    tracing::info!("Starte FF-Druckerverwaltung für: {}", config.ff_name);

    let pool = PgPool::connect(&config.database_url()).await?;
    tracing::info!("Datenbankverbindung hergestellt");

    let state = AppState {
        db: pool,
        config: config.clone(),
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
        .allow_headers(Any);

    let app = Router::new()
        .nest("/api/auth", routes::auth::router(state.clone()))
        .nest("/api/orders", routes::orders::router(state.clone()))
        .nest("/api/articles", routes::articles::router(state.clone()))
        .nest("/api/settings", routes::settings::router(state.clone()))
        .with_state(state)
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    let addr = format!("{}:{}", config.app_host, config.app_port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    tracing::info!("Server läuft auf http://{}", addr);

    axum::serve(listener, app).await?;

    Ok(())
}
