use axum::{
    body::Body,
    extract::{Multipart, Path, State},
    http::header,
    middleware,
    response::Response,
    routing::{delete, get, post, put},
    Extension, Json, Router,
};
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use std::path::Path as FilePath;
use tokio::fs;
use uuid::Uuid;

use crate::{
    audit,
    auth::middleware::{require_auth, Claims},
    errors::{AppError, AppResult},
    AppState,
};

// ── Briefkopf ────────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct Briefkopf {
    pub ff_name:    String,
    pub ff_strasse: String,
    pub ff_ort:     String,
    pub ff_email:   String,
    pub ff_phone:   String,
    pub ff_website: String,
    pub has_logo:   bool,
}

#[derive(Deserialize)]
pub struct UpdateBriefkopf {
    pub ff_email:   Option<String>,
    pub ff_phone:   Option<String>,
    pub ff_website: Option<String>,
}

pub async fn get_briefkopf(State(state): State<AppState>) -> AppResult<Json<Briefkopf>> {
    let rows = sqlx::query!("SELECT key, value FROM settings")
        .fetch_all(&state.db)
        .await?;
    let map: std::collections::HashMap<String, String> =
        rows.into_iter().map(|r| (r.key, r.value)).collect();

    let logo_path = FilePath::new(&state.config.data_dir).join("verein").join("logo");
    let has_logo = logo_path.with_extension("png").exists()
        || logo_path.with_extension("jpg").exists()
        || logo_path.with_extension("webp").exists();

    Ok(Json(Briefkopf {
        ff_name:    map.get("ff_name").cloned().unwrap_or_default(),
        ff_strasse: map.get("ff_strasse").cloned().unwrap_or_default(),
        ff_ort:     map.get("ff_ort").cloned().unwrap_or_default(),
        ff_email:   map.get("ff_email").cloned().unwrap_or_default(),
        ff_phone:   map.get("ff_phone").cloned().unwrap_or_default(),
        ff_website: map.get("ff_website").cloned().unwrap_or_default(),
        has_logo,
    }))
}

pub async fn update_briefkopf(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpdateBriefkopf>,
) -> AppResult<Json<Briefkopf>> {
    if !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }

    for (key, val) in [
        ("ff_email",   body.ff_email.as_deref().unwrap_or("")),
        ("ff_phone",   body.ff_phone.as_deref().unwrap_or("")),
        ("ff_website", body.ff_website.as_deref().unwrap_or("")),
    ] {
        sqlx::query(
            "INSERT INTO settings (key, value) VALUES ($1, $2)
             ON CONFLICT (key) DO UPDATE SET value = $2",
        )
        .bind(key)
        .bind(val)
        .execute(&state.db)
        .await?;
    }

    audit::log(&state.db, Some(claims.sub), &claims.username,
        "BRIEFKOPF_UPDATED", Some("settings"), None, None).await;

    get_briefkopf(State(state)).await
}

pub async fn get_logo(State(state): State<AppState>) -> Response {
    let base = FilePath::new(&state.config.data_dir).join("verein").join("logo");
    for (ext, mime) in [("png", "image/png"), ("jpg", "image/jpeg"), ("webp", "image/webp")] {
        let path = base.with_extension(ext);
        if let Ok(bytes) = fs::read(&path).await {
            return Response::builder()
                .header(header::CONTENT_TYPE, mime)
                .body(Body::from(bytes))
                .unwrap();
        }
    }
    Response::builder()
        .status(404)
        .body(Body::empty())
        .unwrap()
}

pub async fn upload_logo(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    mut multipart: Multipart,
) -> AppResult<Json<serde_json::Value>> {
    if !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }

    while let Some(field) = multipart.next_field().await
        .map_err(|e| AppError::BadRequest(e.to_string()))? {
        if field.name() == Some("file") {
            let ct = field.content_type().unwrap_or("").to_string();
            let ext = match ct.as_str() {
                "image/png"  => "png",
                "image/jpeg" => "jpg",
                "image/webp" => "webp",
                _ => return Err(AppError::BadRequest("Nur PNG, JPG oder WebP erlaubt".into())),
            };

            let data = field.bytes().await.map_err(|e| AppError::BadRequest(e.to_string()))?;
            if data.len() > 2 * 1024 * 1024 {
                return Err(AppError::BadRequest("Logo zu groß (max. 2 MB)".into()));
            }

            let dir = FilePath::new(&state.config.data_dir).join("verein");
            fs::create_dir_all(&dir).await.map_err(|e| AppError::Internal(e.into()))?;

            // Alte Logo-Dateien löschen
            for old_ext in ["png", "jpg", "webp"] {
                let _ = fs::remove_file(dir.join("logo").with_extension(old_ext)).await;
            }

            fs::write(dir.join("logo").with_extension(ext), &data)
                .await.map_err(|e| AppError::Internal(e.into()))?;

            audit::log(&state.db, Some(claims.sub), &claims.username,
                "LOGO_UPLOADED", Some("settings"), None, None).await;

            return Ok(Json(serde_json::json!({ "ok": true })));
        }
    }
    Err(AppError::BadRequest("Keine Bilddatei im Request".into()))
}

pub async fn delete_logo(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<serde_json::Value>> {
    if !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }
    let dir = FilePath::new(&state.config.data_dir).join("verein");
    let mut deleted = false;
    for ext in ["png", "jpg", "webp"] {
        if fs::remove_file(dir.join("logo").with_extension(ext)).await.is_ok() {
            deleted = true;
        }
    }
    if !deleted {
        return Err(AppError::NotFound);
    }
    Ok(Json(serde_json::json!({ "ok": true })))
}

// ── Vorstandsverwaltung ───────────────────────────────────────────────────────

#[derive(Serialize, sqlx::FromRow)]
pub struct Vorstand {
    pub id:         Uuid,
    pub name:       String,
    pub funktion:   String,
    pub seit:       Option<NaiveDate>,
    pub bis:        Option<NaiveDate>,
    pub sort_order: i32,
}

#[derive(Deserialize)]
pub struct VorstandBody {
    pub name:       String,
    pub funktion:   String,
    pub seit:       Option<NaiveDate>,
    pub bis:        Option<NaiveDate>,
    pub sort_order: Option<i32>,
}

pub async fn list_vorstand(State(state): State<AppState>) -> AppResult<Json<Vec<Vorstand>>> {
    let rows = sqlx::query_as::<_, Vorstand>(
        "SELECT id, name, funktion, seit, bis, sort_order
         FROM verein_vorstand ORDER BY sort_order, name"
    )
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows))
}

pub async fn create_vorstand(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<VorstandBody>,
) -> AppResult<Json<Vorstand>> {
    if !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }
    if body.name.trim().is_empty() || body.funktion.trim().is_empty() {
        return Err(AppError::BadRequest("Name und Funktion sind erforderlich".into()));
    }
    let row = sqlx::query_as::<_, Vorstand>(
        "INSERT INTO verein_vorstand (name, funktion, seit, bis, sort_order)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, funktion, seit, bis, sort_order"
    )
    .bind(body.name.trim())
    .bind(body.funktion.trim())
    .bind(body.seit)
    .bind(body.bis)
    .bind(body.sort_order.unwrap_or(0))
    .fetch_one(&state.db)
    .await?;
    Ok(Json(row))
}

pub async fn update_vorstand(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<VorstandBody>,
) -> AppResult<Json<Vorstand>> {
    if !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }
    let row = sqlx::query_as::<_, Vorstand>(
        "UPDATE verein_vorstand SET name=$1, funktion=$2, seit=$3, bis=$4, sort_order=$5
         WHERE id=$6
         RETURNING id, name, funktion, seit, bis, sort_order"
    )
    .bind(body.name.trim())
    .bind(body.funktion.trim())
    .bind(body.seit)
    .bind(body.bis)
    .bind(body.sort_order.unwrap_or(0))
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;
    Ok(Json(row))
}

pub async fn delete_vorstand(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    if !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }
    let res = sqlx::query("DELETE FROM verein_vorstand WHERE id=$1")
        .bind(id).execute(&state.db).await?;
    if res.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(Json(serde_json::json!({ "ok": true })))
}

// ── Schwarzes Brett ───────────────────────────────────────────────────────────

#[derive(Serialize, sqlx::FromRow)]
pub struct VereinPost {
    pub id:              Uuid,
    pub title:           String,
    pub content:         String,
    pub pinned:          bool,
    pub expires_at:      Option<NaiveDate>,
    pub visibility:      String,
    pub created_by:      Option<Uuid>,
    pub created_by_name: String,
    pub created_at:      DateTime<Utc>,
    pub updated_at:      DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct VereinPostBody {
    pub title:      String,
    pub content:    String,
    pub pinned:     Option<bool>,
    pub expires_at: Option<NaiveDate>,
    pub visibility: Option<String>,
}

pub async fn list_posts(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<Vec<VereinPost>>> {
    let is_admin = claims.is_admin_or_above();
    let rows = sqlx::query_as::<_, VereinPost>(
        "SELECT id, title, content, pinned, expires_at, visibility,
                created_by, created_by_name, created_at, updated_at
         FROM verein_posts
         WHERE (expires_at IS NULL OR expires_at >= CURRENT_DATE)
           AND ($1 = true OR visibility = 'all')
         ORDER BY pinned DESC, created_at DESC"
    )
    .bind(is_admin)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows))
}

pub async fn create_post(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<VereinPostBody>,
) -> AppResult<Json<VereinPost>> {
    if !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }
    if body.title.trim().is_empty() {
        return Err(AppError::BadRequest("Titel darf nicht leer sein".into()));
    }
    let visibility = body.visibility.as_deref().unwrap_or("all");
    if !["all", "vorstand"].contains(&visibility) {
        return Err(AppError::BadRequest("Ungültige Sichtbarkeit".into()));
    }
    let display_name: Option<String> = sqlx::query_scalar(
        "SELECT display_name FROM users WHERE id=$1"
    )
    .bind(claims.sub).fetch_optional(&state.db).await?.flatten();
    let author = display_name.unwrap_or_else(|| claims.username.clone());

    let row = sqlx::query_as::<_, VereinPost>(
        "INSERT INTO verein_posts (title, content, pinned, expires_at, visibility, created_by, created_by_name)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING id, title, content, pinned, expires_at, visibility,
                   created_by, created_by_name, created_at, updated_at"
    )
    .bind(body.title.trim())
    .bind(body.content.trim())
    .bind(body.pinned.unwrap_or(false))
    .bind(body.expires_at)
    .bind(visibility)
    .bind(claims.sub)
    .bind(&author)
    .fetch_one(&state.db)
    .await?;
    Ok(Json(row))
}

pub async fn update_post(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<VereinPostBody>,
) -> AppResult<Json<VereinPost>> {
    if !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }
    let visibility = body.visibility.as_deref().unwrap_or("all");
    let row = sqlx::query_as::<_, VereinPost>(
        "UPDATE verein_posts
         SET title=$1, content=$2, pinned=$3, expires_at=$4, visibility=$5
         WHERE id=$6
         RETURNING id, title, content, pinned, expires_at, visibility,
                   created_by, created_by_name, created_at, updated_at"
    )
    .bind(body.title.trim())
    .bind(body.content.trim())
    .bind(body.pinned.unwrap_or(false))
    .bind(body.expires_at)
    .bind(visibility)
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;
    Ok(Json(row))
}

pub async fn delete_post(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    if !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }
    let res = sqlx::query("DELETE FROM verein_posts WHERE id=$1")
        .bind(id).execute(&state.db).await?;
    if res.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(Json(serde_json::json!({ "ok": true })))
}

// ── Dokumentenablage ──────────────────────────────────────────────────────────

#[derive(Serialize, sqlx::FromRow)]
pub struct VereinDocument {
    pub id:               Uuid,
    pub name:             String,
    pub category:         String,
    pub access_level:     String,
    pub file_size:        i64,
    pub mime_type:        Option<String>,
    pub uploaded_by:      Option<Uuid>,
    pub uploaded_by_name: String,
    pub uploaded_at:      DateTime<Utc>,
}

pub async fn list_documents(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<Vec<VereinDocument>>> {
    let is_admin = claims.is_admin_or_above();
    let rows = sqlx::query_as::<_, VereinDocument>(
        "SELECT id, name, category, access_level, file_size, mime_type,
                uploaded_by, uploaded_by_name, uploaded_at
         FROM verein_documents
         WHERE $1 = true OR access_level = 'all'
         ORDER BY category, name"
    )
    .bind(is_admin)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows))
}

pub async fn upload_document(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    mut multipart: Multipart,
) -> AppResult<Json<VereinDocument>> {
    if !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }

    let mut file_data: Option<(Vec<u8>, String, String)> = None; // (bytes, filename, mime)
    let mut category     = "Allgemein".to_string();
    let mut access_level = "all".to_string();

    while let Some(field) = multipart.next_field().await
        .map_err(|e| AppError::BadRequest(e.to_string()))? {
        match field.name() {
            Some("category")     => { category = field.text().await.unwrap_or_default(); }
            Some("access_level") => { access_level = field.text().await.unwrap_or_default(); }
            Some("file") => {
                let filename = field.file_name().unwrap_or("dokument").to_string();
                let mime = field.content_type().unwrap_or("application/octet-stream").to_string();
                let bytes = field.bytes().await.map_err(|e| AppError::BadRequest(e.to_string()))?;
                if bytes.len() > 50 * 1024 * 1024 {
                    return Err(AppError::BadRequest("Datei zu groß (max. 50 MB)".into()));
                }
                file_data = Some((bytes.to_vec(), filename, mime));
            }
            _ => {}
        }
    }

    let (bytes, filename, mime) = file_data.ok_or_else(|| AppError::BadRequest("Keine Datei".into()))?;

    if !["all", "vorstand"].contains(&access_level.as_str()) {
        return Err(AppError::BadRequest("Ungültige Zugriffsebene".into()));
    }

    let doc_id = Uuid::new_v4();
    let dir = FilePath::new(&state.config.data_dir).join("verein").join("dokumente");
    fs::create_dir_all(&dir).await.map_err(|e| AppError::Internal(e.into()))?;

    let ext = FilePath::new(&filename)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("bin");
    let stored_name = format!("{}.{}", doc_id, ext);
    let file_path = dir.join(&stored_name);
    let file_size = bytes.len() as i64;

    fs::write(&file_path, &bytes).await.map_err(|e| AppError::Internal(e.into()))?;

    let display_name: Option<String> = sqlx::query_scalar(
        "SELECT display_name FROM users WHERE id=$1"
    )
    .bind(claims.sub).fetch_optional(&state.db).await?.flatten();
    let author = display_name.unwrap_or_else(|| claims.username.clone());

    let row = sqlx::query_as::<_, VereinDocument>(
        "INSERT INTO verein_documents (id, name, category, access_level, file_path, file_size, mime_type, uploaded_by, uploaded_by_name)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING id, name, category, access_level, file_size, mime_type, uploaded_by, uploaded_by_name, uploaded_at"
    )
    .bind(doc_id)
    .bind(&filename)
    .bind(&category)
    .bind(&access_level)
    .bind(stored_name)
    .bind(file_size)
    .bind(&mime)
    .bind(claims.sub)
    .bind(&author)
    .fetch_one(&state.db)
    .await?;

    audit::log(&state.db, Some(claims.sub), &claims.username,
        "DOCUMENT_UPLOADED", Some("verein_documents"), Some(doc_id), None).await;

    Ok(Json(row))
}

#[derive(sqlx::FromRow)]
struct DocInfo {
    name:         String,
    file_path:    String,
    mime_type:    Option<String>,
    access_level: String,
}

#[derive(sqlx::FromRow)]
struct DeletedPath {
    file_path: String,
}

pub async fn download_document(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Response> {
    let is_admin = claims.is_admin_or_above();
    let row = sqlx::query_as::<_, DocInfo>(
        "SELECT name, file_path, mime_type, access_level FROM verein_documents WHERE id=$1"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    if !is_admin && row.access_level == "vorstand" {
        return Err(AppError::Forbidden);
    }

    let path = FilePath::new(&state.config.data_dir)
        .join("verein").join("dokumente").join(&row.file_path);
    let bytes = fs::read(&path).await.map_err(|_| AppError::NotFound)?;
    let mime = row.mime_type.unwrap_or_else(|| "application/octet-stream".into());
    let filename = row.name;

    Ok(Response::builder()
        .header(header::CONTENT_TYPE, &mime)
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{}\"", filename.replace('"', "")),
        )
        .body(Body::from(bytes))
        .unwrap())
}

pub async fn delete_document(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    if !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }
    let row = sqlx::query_as::<_, DeletedPath>(
        "DELETE FROM verein_documents WHERE id=$1 RETURNING file_path"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    let path = FilePath::new(&state.config.data_dir)
        .join("verein").join("dokumente").join(&row.file_path);
    let _ = fs::remove_file(path).await;

    audit::log(&state.db, Some(claims.sub), &claims.username,
        "DOCUMENT_DELETED", Some("verein_documents"), Some(id), None).await;

    Ok(Json(serde_json::json!({ "ok": true })))
}

// ── Router ────────────────────────────────────────────────────────────────────

pub fn router(state: AppState) -> Router<AppState> {
    let protected = Router::new()
        // Briefkopf
        .route("/briefkopf",       put(update_briefkopf))
        .route("/logo",            post(upload_logo).delete(delete_logo))
        // Vorstand
        .route("/vorstand",        post(create_vorstand))
        .route("/vorstand/:id",    put(update_vorstand).delete(delete_vorstand))
        // Schwarzes Brett
        .route("/posts",           post(create_post))
        .route("/posts/:id",       put(update_post).delete(delete_post))
        // Dokumente
        .route("/dokumente",       post(upload_document))
        .route("/dokumente/:id",   delete(delete_document))
        .route_layer(middleware::from_fn_with_state(state.clone(), require_auth));

    Router::new()
        // Öffentlich (mit Auth)
        .route("/briefkopf",             get(get_briefkopf))
        .route("/logo",                  get(get_logo))
        .route("/vorstand",              get(list_vorstand))
        .route("/posts",                 get(list_posts))
        .route("/dokumente",             get(list_documents))
        .route("/dokumente/:id/download",get(download_document))
        .merge(protected)
        .route_layer(middleware::from_fn_with_state(state, require_auth))
}
