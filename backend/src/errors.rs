use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Nicht authentifiziert")]
    Unauthorized,

    #[error("Zugriff verweigert")]
    Forbidden,

    #[error("Nicht gefunden")]
    NotFound,

    #[error("Ungültige Eingabe: {0}")]
    BadRequest(String),

    #[error("2FA erforderlich")]
    TotpRequired,

    #[error("Ungültiger 2FA-Code")]
    InvalidTotp,

    #[error("Datenbankfehler: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Interner Fehler: {0}")]
    Internal(#[from] anyhow::Error),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match &self {
            AppError::Unauthorized => (StatusCode::UNAUTHORIZED, self.to_string()),
            AppError::Forbidden => (StatusCode::FORBIDDEN, self.to_string()),
            AppError::NotFound => (StatusCode::NOT_FOUND, self.to_string()),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg.clone()),
            AppError::TotpRequired => (StatusCode::UNAUTHORIZED, self.to_string()),
            AppError::InvalidTotp => (StatusCode::UNAUTHORIZED, self.to_string()),
            AppError::Database(e) => {
                tracing::error!("DB error: {:?}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, "Datenbankfehler".into())
            }
            AppError::Internal(e) => {
                tracing::error!("Internal error: {:?}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, "Interner Fehler".into())
            }
        };

        let body = Json(json!({ "error": message }));
        (status, body).into_response()
    }
}

pub type AppResult<T> = Result<T, AppError>;
