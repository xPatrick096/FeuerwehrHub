use axum::{extract::State, Extension, Json};
use bcrypt::{hash, verify, DEFAULT_COST};
use chrono::{Duration, Utc};
use jsonwebtoken::{encode, EncodingKey, Header};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    audit,
    auth::{middleware::Claims, totp},
    errors::{AppError, AppResult},
    AppState,
};

// ── Login ────────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub requires_totp: bool,
    pub totp_setup_required: bool,
}

#[derive(sqlx::FromRow)]
struct LoginUserRow {
    id: Uuid,
    username: String,
    password_hash: String,
    totp_secret: Option<String>,
    totp_enabled: bool,
    is_admin: bool,
    role: String,
    failed_login_attempts: i32,
    locked_until: Option<chrono::DateTime<Utc>>,
}

pub async fn login(
    State(state): State<AppState>,
    Json(body): Json<LoginRequest>,
) -> AppResult<Json<LoginResponse>> {
    let user = sqlx::query_as::<_, LoginUserRow>(
        "SELECT id, username, password_hash, totp_secret, totp_enabled, is_admin, role,
                failed_login_attempts, locked_until
         FROM users WHERE username = $1"
    )
    .bind(&body.username)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::Unauthorized)?;

    // Account-Lockout prüfen
    if let Some(locked_until) = user.locked_until {
        if locked_until > Utc::now() {
            return Err(AppError::BadRequest(
                "Account vorübergehend gesperrt. Bitte später erneut versuchen.".into(),
            ));
        }
    }

    if !verify(&body.password, &user.password_hash)
        .map_err(|e| AppError::Internal(e.into()))?
    {
        // Fehlversuch zählen
        let new_attempts = user.failed_login_attempts + 1;
        let locked_until = if new_attempts >= state.config.login_max_attempts as i32 {
            tracing::warn!(
                "Account gesperrt nach {} Fehlversuchen: {}",
                new_attempts,
                user.username
            );
            Some(Utc::now() + Duration::minutes(state.config.lockout_minutes))
        } else {
            None
        };

        sqlx::query(
            "UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3"
        )
        .bind(new_attempts)
        .bind(locked_until)
        .bind(user.id)
        .execute(&state.db)
        .await?;

        let action = if locked_until.is_some() { "ACCOUNT_LOCKED" } else { "LOGIN_FAILED" };
        audit::log(&state.db, Some(user.id), &user.username, action, Some("user"), Some(user.id), None).await;

        return Err(AppError::Unauthorized);
    }

    // Erfolgreicher Login → Zähler zurücksetzen
    sqlx::query(
        "UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1"
    )
    .bind(user.id)
    .execute(&state.db)
    .await?;

    audit::log(&state.db, Some(user.id), &user.username, "LOGIN_SUCCESS", Some("user"), Some(user.id), None).await;

    // TOTP nicht aktiv → direkt vollen Token ausgeben
    if !user.totp_enabled {
        let token = make_jwt(&state, user.id, &user.username, user.is_admin, &user.role, true)?;
        return Ok(Json(LoginResponse {
            token,
            requires_totp: false,
            totp_setup_required: false,
        }));
    }

    // TOTP aktiv → Partial-Token, Frontend muss Code nachliefern
    let token = make_jwt(&state, user.id, &user.username, user.is_admin, &user.role, false)?;
    Ok(Json(LoginResponse {
        token,
        requires_totp: true,
        totp_setup_required: false,
    }))
}

// ── TOTP verifizieren ────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct VerifyTotpRequest {
    pub code: String,
}

#[derive(Serialize)]
pub struct TokenResponse {
    pub token: String,
}

pub async fn verify_totp(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<VerifyTotpRequest>,
) -> AppResult<Json<TokenResponse>> {
    let user = sqlx::query!(
        "SELECT totp_secret FROM users WHERE id = $1",
        claims.sub
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::Unauthorized)?;

    let secret = user.totp_secret.ok_or(AppError::BadRequest(
        "Kein TOTP-Secret vorhanden".into(),
    ))?;

    let valid = totp::verify_code(&secret, &body.code)
        .map_err(|e| AppError::Internal(e))?;

    if !valid {
        return Err(AppError::InvalidTotp);
    }

    let token = make_jwt(&state, claims.sub, &claims.username, claims.is_admin, &claims.role, true)?;
    Ok(Json(TokenResponse { token }))
}

// ── TOTP Setup ───────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct TotpSetupResponse {
    pub secret: String,
    pub uri: String,
}

pub async fn setup_totp(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<TotpSetupResponse>> {
    let secret = totp::generate_secret();
    let ff_name = state.config.ff_name.clone();

    let uri = totp::generate_qr_uri(&secret, &claims.username, &ff_name)
        .map_err(|e| AppError::Internal(e))?;

    // Secret temporär speichern (noch nicht aktiviert)
    sqlx::query!(
        "UPDATE users SET totp_secret = $1 WHERE id = $2",
        secret,
        claims.sub
    )
    .execute(&state.db)
    .await?;

    Ok(Json(TotpSetupResponse { secret, uri }))
}

#[derive(Deserialize)]
pub struct ConfirmTotpRequest {
    pub code: String,
}

pub async fn confirm_totp(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ConfirmTotpRequest>,
) -> AppResult<Json<TokenResponse>> {
    let user = sqlx::query!(
        "SELECT totp_secret FROM users WHERE id = $1",
        claims.sub
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::Unauthorized)?;

    let secret = user.totp_secret.ok_or(AppError::BadRequest(
        "Kein TOTP-Secret vorhanden. Bitte zuerst /setup-totp aufrufen.".into(),
    ))?;

    let valid = totp::verify_code(&secret, &body.code)
        .map_err(|e| AppError::Internal(e))?;

    if !valid {
        return Err(AppError::InvalidTotp);
    }

    sqlx::query!(
        "UPDATE users SET totp_enabled = TRUE WHERE id = $1",
        claims.sub
    )
    .execute(&state.db)
    .await?;

    let token = make_jwt(&state, claims.sub, &claims.username, claims.is_admin, &claims.role, true)?;
    Ok(Json(TokenResponse { token }))
}

// ── Eigenes Profil ───────────────────────────────────────────────────────────

#[derive(sqlx::FromRow)]
struct UserProfileRow {
    id: Uuid,
    username: String,
    is_admin: bool,
    role: String,
    totp_enabled: bool,
    display_name: Option<String>,
    permissions: Vec<String>,
    role_permissions: Option<Vec<String>>,
    assigned_role_id: Option<Uuid>,
    assigned_role_name: Option<String>,
}

#[derive(Serialize)]
pub struct MeResponse {
    pub id: Uuid,
    pub username: String,
    pub is_admin: bool,
    pub role: String,
    pub totp_enabled: bool,
    pub display_name: Option<String>,
    pub permissions: Vec<String>,
    pub assigned_role_id: Option<Uuid>,
    pub assigned_role_name: Option<String>,
}

pub async fn me(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<MeResponse>> {
    let user = sqlx::query_as::<_, UserProfileRow>(
        "SELECT u.id, u.username, u.is_admin, u.role, u.totp_enabled, u.display_name,
                u.permissions, r.permissions as role_permissions,
                u.role_id as assigned_role_id, r.name as assigned_role_name
         FROM users u
         LEFT JOIN roles r ON r.id = u.role_id
         WHERE u.id = $1"
    )
    .bind(claims.sub)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    // Effektive Permissions = Rolle + individuelle (dedupliziert)
    let mut perms = user.role_permissions.unwrap_or_default();
    for p in &user.permissions {
        if !perms.contains(p) {
            perms.push(p.clone());
        }
    }

    Ok(Json(MeResponse {
        id: user.id,
        username: user.username,
        is_admin: user.is_admin,
        role: user.role,
        totp_enabled: user.totp_enabled,
        display_name: user.display_name,
        permissions: perms,
        assigned_role_id: user.assigned_role_id,
        assigned_role_name: user.assigned_role_name,
    }))
}

// ── Profil aktualisieren ─────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct UpdateProfileBody {
    pub display_name: Option<String>,
}

pub async fn update_profile(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpdateProfileBody>,
) -> AppResult<Json<serde_json::Value>> {
    let display_name = body.display_name.map(|s| {
        let s = s.trim().to_string();
        if s.is_empty() { None } else { Some(s) }
    }).flatten();

    sqlx::query(
        "UPDATE users SET display_name = $1 WHERE id = $2"
    )
    .bind(display_name)
    .bind(claims.sub)
    .execute(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "message": "Profil gespeichert" })))
}

// ── Setup (erster Admin-Account) ─────────────────────────────────────────────

#[derive(Deserialize)]
pub struct SetupRequest {
    pub username: String,
    pub password: String,
    pub ff_name: String,
}

pub async fn initial_setup(
    State(state): State<AppState>,
    Json(body): Json<SetupRequest>,
) -> AppResult<Json<serde_json::Value>> {
    // Nur ausführbar wenn noch kein User existiert
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
        .fetch_one(&state.db)
        .await?;

    if count > 0 {
        return Err(AppError::Forbidden);
    }

    if body.password.len() < 8 {
        return Err(AppError::BadRequest(
            "Passwort muss mindestens 8 Zeichen haben".into(),
        ));
    }

    let password_hash = hash(&body.password, DEFAULT_COST)
        .map_err(|e| AppError::Internal(e.into()))?;

    sqlx::query!(
        "INSERT INTO users (username, password_hash, is_admin, role) VALUES ($1, $2, TRUE, 'superuser')",
        body.username,
        password_hash
    )
    .execute(&state.db)
    .await?;

    sqlx::query!(
        "UPDATE settings SET value = $1 WHERE key = 'ff_name'",
        body.ff_name
    )
    .execute(&state.db)
    .await?;

    sqlx::query!(
        "UPDATE settings SET value = 'true' WHERE key = 'setup_complete'"
    )
    .execute(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "message": "Setup abgeschlossen" })))
}

// ── Passwort ändern ──────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct ChangePasswordRequest {
    pub current_password: String,
    pub new_password: String,
}

pub async fn change_password(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ChangePasswordRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let user = sqlx::query!(
        "SELECT password_hash FROM users WHERE id = $1",
        claims.sub
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    if !verify(&body.current_password, &user.password_hash)
        .map_err(|e| AppError::Internal(e.into()))?
    {
        return Err(AppError::Unauthorized);
    }

    if body.new_password.len() < 8 {
        return Err(AppError::BadRequest(
            "Neues Passwort muss mindestens 8 Zeichen haben".into(),
        ));
    }

    let new_hash = hash(&body.new_password, DEFAULT_COST)
        .map_err(|e| AppError::Internal(e.into()))?;

    sqlx::query!(
        "UPDATE users SET password_hash = $1 WHERE id = $2",
        new_hash,
        claims.sub
    )
    .execute(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "message": "Passwort geändert" })))
}

// ── Hilfsfunktion JWT ────────────────────────────────────────────────────────

fn make_jwt(
    state: &AppState,
    user_id: Uuid,
    username: &str,
    is_admin: bool,
    role: &str,
    totp_verified: bool,
) -> AppResult<String> {
    let exp = Utc::now()
        .checked_add_signed(Duration::hours(state.config.jwt_expiry_hours))
        .unwrap()
        .timestamp() as usize;

    let claims = Claims {
        sub: user_id,
        username: username.to_string(),
        is_admin,
        role: role.to_string(),
        totp_verified,
        exp,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(state.config.jwt_secret.as_bytes()),
    )
    .map_err(|e| AppError::Internal(e.into()))
}
