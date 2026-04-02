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
    pub beschreibung:     Option<String>,
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
        "SELECT id, name, category, beschreibung, access_level, file_size, mime_type,
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
    let mut category     = "Sonstiges".to_string();
    let mut beschreibung: Option<String> = None;
    let mut access_level = "all".to_string();

    while let Some(field) = multipart.next_field().await
        .map_err(|e| AppError::BadRequest(e.to_string()))? {
        match field.name() {
            Some("category")     => { category = field.text().await.unwrap_or_default(); }
            Some("beschreibung") => { let t = field.text().await.unwrap_or_default(); if !t.is_empty() { beschreibung = Some(t); } }
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
        "INSERT INTO verein_documents (id, name, category, beschreibung, access_level, file_path, file_size, mime_type, uploaded_by, uploaded_by_name)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING id, name, category, beschreibung, access_level, file_size, mime_type, uploaded_by, uploaded_by_name, uploaded_at"
    )
    .bind(doc_id)
    .bind(&filename)
    .bind(&category)
    .bind(&beschreibung)
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

// ── Mitglieder ────────────────────────────────────────────────────────────────

#[derive(Serialize, sqlx::FromRow)]
pub struct Mitglied {
    pub id:                  Uuid,
    pub mitgliedsnummer:     String,
    pub vorname:             String,
    pub nachname:            String,
    pub email:               Option<String>,
    pub telefon:             Option<String>,
    pub geburtsdatum:        Option<NaiveDate>,
    pub eintrittsdatum:      NaiveDate,
    pub status:              String,
    pub user_id:             Option<Uuid>,
    pub austritt_datum:      Option<NaiveDate>,
    pub austritt_grund:      Option<String>,
    pub bemerkung:           Option<String>,
    pub kleidung_oberteil:   Option<String>,
    pub kleidung_hose:       Option<String>,
    pub kleidung_schuhe:     Option<String>,
    pub archiviert:          bool,
    pub created_at:          DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct CreateMitglied {
    pub vorname:             String,
    pub nachname:            String,
    pub email:               Option<String>,
    pub telefon:             Option<String>,
    pub geburtsdatum:        Option<NaiveDate>,
    pub eintrittsdatum:      NaiveDate,
    pub status:              Option<String>,
    pub user_id:             Option<Uuid>,
    pub bemerkung:           Option<String>,
    pub kleidung_oberteil:   Option<String>,
    pub kleidung_hose:       Option<String>,
    pub kleidung_schuhe:     Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateMitglied {
    pub vorname:             Option<String>,
    pub nachname:            Option<String>,
    pub email:               Option<String>,
    pub telefon:             Option<String>,
    pub geburtsdatum:        Option<NaiveDate>,
    pub eintrittsdatum:      Option<NaiveDate>,
    pub status:              Option<String>,
    pub user_id:             Option<Uuid>,
    pub austritt_datum:      Option<NaiveDate>,
    pub austritt_grund:      Option<String>,
    pub bemerkung:           Option<String>,
    pub kleidung_oberteil:   Option<String>,
    pub kleidung_hose:       Option<String>,
    pub kleidung_schuhe:     Option<String>,
    pub archiviert:          Option<bool>,
}

async fn next_mitgliedsnummer(db: &sqlx::PgPool) -> AppResult<String> {
    let max: Option<i32> = sqlx::query_scalar(
        "SELECT MAX(CAST(SPLIT_PART(mitgliedsnummer, '-', 2) AS INTEGER))
         FROM verein_mitglieder WHERE mitgliedsnummer LIKE 'M-%'"
    )
    .fetch_one(db)
    .await?;
    Ok(format!("M-{:04}", max.unwrap_or(0) + 1))
}

pub async fn list_mitglieder(
    State(state): State<AppState>,
) -> AppResult<Json<Vec<Mitglied>>> {
    let rows = sqlx::query_as::<_, Mitglied>(
        "SELECT id, mitgliedsnummer, vorname, nachname, email, telefon, geburtsdatum,
                eintrittsdatum, status, user_id, austritt_datum, austritt_grund,
                bemerkung, kleidung_oberteil, kleidung_hose, kleidung_schuhe,
                archiviert, created_at
         FROM verein_mitglieder
         ORDER BY archiviert, nachname, vorname"
    )
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows))
}

pub async fn create_mitglied(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateMitglied>,
) -> AppResult<Json<Mitglied>> {
    if body.vorname.trim().is_empty() || body.nachname.trim().is_empty() {
        return Err(AppError::BadRequest("Vor- und Nachname erforderlich".into()));
    }
    let nr = next_mitgliedsnummer(&state.db).await?;
    let status = body.status.unwrap_or_else(|| "aktiv".into());

    let row = sqlx::query_as::<_, Mitglied>(
        "INSERT INTO verein_mitglieder
            (mitgliedsnummer, vorname, nachname, email, telefon, geburtsdatum,
             eintrittsdatum, status, user_id, bemerkung,
             kleidung_oberteil, kleidung_hose, kleidung_schuhe)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING id, mitgliedsnummer, vorname, nachname, email, telefon, geburtsdatum,
                   eintrittsdatum, status, user_id, austritt_datum, austritt_grund,
                   bemerkung, kleidung_oberteil, kleidung_hose, kleidung_schuhe,
                   archiviert, created_at"
    )
    .bind(&nr)
    .bind(&body.vorname)
    .bind(&body.nachname)
    .bind(&body.email)
    .bind(&body.telefon)
    .bind(body.geburtsdatum)
    .bind(body.eintrittsdatum)
    .bind(&status)
    .bind(body.user_id)
    .bind(&body.bemerkung)
    .bind(&body.kleidung_oberteil)
    .bind(&body.kleidung_hose)
    .bind(&body.kleidung_schuhe)
    .fetch_one(&state.db)
    .await?;

    audit::log(&state.db, Some(claims.sub), &claims.username,
        "MITGLIED_CREATED", Some("verein_mitglieder"), Some(row.id), None).await;
    Ok(Json(row))
}

pub async fn update_mitglied(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateMitglied>,
) -> AppResult<Json<Mitglied>> {
    let row = sqlx::query_as::<_, Mitglied>(
        "UPDATE verein_mitglieder SET
            vorname           = COALESCE($1, vorname),
            nachname          = COALESCE($2, nachname),
            email             = $3,
            telefon           = $4,
            geburtsdatum      = $5,
            eintrittsdatum    = COALESCE($6, eintrittsdatum),
            status            = COALESCE($7, status),
            user_id           = $8,
            austritt_datum    = $9,
            austritt_grund    = $10,
            bemerkung         = $11,
            kleidung_oberteil = $12,
            kleidung_hose     = $13,
            kleidung_schuhe   = $14,
            archiviert        = COALESCE($15, archiviert)
         WHERE id = $16
         RETURNING id, mitgliedsnummer, vorname, nachname, email, telefon, geburtsdatum,
                   eintrittsdatum, status, user_id, austritt_datum, austritt_grund,
                   bemerkung, kleidung_oberteil, kleidung_hose, kleidung_schuhe,
                   archiviert, created_at"
    )
    .bind(body.vorname)
    .bind(body.nachname)
    .bind(body.email)
    .bind(body.telefon)
    .bind(body.geburtsdatum)
    .bind(body.eintrittsdatum)
    .bind(body.status)
    .bind(body.user_id)
    .bind(body.austritt_datum)
    .bind(body.austritt_grund)
    .bind(body.bemerkung)
    .bind(body.kleidung_oberteil)
    .bind(body.kleidung_hose)
    .bind(body.kleidung_schuhe)
    .bind(body.archiviert)
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    audit::log(&state.db, Some(claims.sub), &claims.username,
        "MITGLIED_UPDATED", Some("verein_mitglieder"), Some(id), None).await;
    Ok(Json(row))
}

pub async fn delete_mitglied(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let affected = sqlx::query(
        "UPDATE verein_mitglieder SET archiviert = TRUE WHERE id = $1"
    )
    .bind(id)
    .execute(&state.db)
    .await?
    .rows_affected();

    if affected == 0 {
        return Err(AppError::NotFound);
    }
    audit::log(&state.db, Some(claims.sub), &claims.username,
        "MITGLIED_ARCHIVED", Some("verein_mitglieder"), Some(id), None).await;
    Ok(Json(serde_json::json!({ "ok": true })))
}

// ── Qualifikationen ───────────────────────────────────────────────────────────

#[derive(Serialize, sqlx::FromRow)]
pub struct Qualifikation {
    pub id:          Uuid,
    pub mitglied_id: Uuid,
    pub bezeichnung: String,
    pub erworben_am: Option<NaiveDate>,
    pub gueltig_bis: Option<NaiveDate>,
    pub bemerkung:   Option<String>,
    pub created_at:  DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct CreateQualifikation {
    pub bezeichnung: String,
    pub erworben_am: Option<NaiveDate>,
    pub gueltig_bis: Option<NaiveDate>,
    pub bemerkung:   Option<String>,
}

pub async fn list_qualifikationen(
    State(state): State<AppState>,
    Path(mitglied_id): Path<Uuid>,
) -> AppResult<Json<Vec<Qualifikation>>> {
    let rows = sqlx::query_as::<_, Qualifikation>(
        "SELECT id, mitglied_id, bezeichnung, erworben_am, gueltig_bis, bemerkung, created_at
         FROM verein_qualifikationen
         WHERE mitglied_id = $1
         ORDER BY erworben_am DESC NULLS LAST"
    )
    .bind(mitglied_id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows))
}

pub async fn create_qualifikation(
    State(state): State<AppState>,
    Path(mitglied_id): Path<Uuid>,
    Json(body): Json<CreateQualifikation>,
) -> AppResult<Json<Qualifikation>> {
    if body.bezeichnung.trim().is_empty() {
        return Err(AppError::BadRequest("Bezeichnung erforderlich".into()));
    }
    let row = sqlx::query_as::<_, Qualifikation>(
        "INSERT INTO verein_qualifikationen (mitglied_id, bezeichnung, erworben_am, gueltig_bis, bemerkung)
         VALUES ($1,$2,$3,$4,$5)
         RETURNING id, mitglied_id, bezeichnung, erworben_am, gueltig_bis, bemerkung, created_at"
    )
    .bind(mitglied_id)
    .bind(&body.bezeichnung)
    .bind(body.erworben_am)
    .bind(body.gueltig_bis)
    .bind(&body.bemerkung)
    .fetch_one(&state.db)
    .await?;
    Ok(Json(row))
}

pub async fn delete_qualifikation(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    sqlx::query("DELETE FROM verein_qualifikationen WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

// ── Auszeichnungen ────────────────────────────────────────────────────────────

#[derive(Serialize, sqlx::FromRow)]
pub struct Auszeichnung {
    pub id:          Uuid,
    pub mitglied_id: Uuid,
    pub bezeichnung: String,
    pub verliehen_am: Option<NaiveDate>,
    pub begruendung: Option<String>,
    pub created_at:  DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct CreateAuszeichnung {
    pub bezeichnung:  String,
    pub verliehen_am: Option<NaiveDate>,
    pub begruendung:  Option<String>,
}

pub async fn list_auszeichnungen(
    State(state): State<AppState>,
    Path(mitglied_id): Path<Uuid>,
) -> AppResult<Json<Vec<Auszeichnung>>> {
    let rows = sqlx::query_as::<_, Auszeichnung>(
        "SELECT id, mitglied_id, bezeichnung, verliehen_am, begruendung, created_at
         FROM verein_auszeichnungen
         WHERE mitglied_id = $1
         ORDER BY verliehen_am DESC NULLS LAST"
    )
    .bind(mitglied_id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows))
}

pub async fn create_auszeichnung(
    State(state): State<AppState>,
    Path(mitglied_id): Path<Uuid>,
    Json(body): Json<CreateAuszeichnung>,
) -> AppResult<Json<Auszeichnung>> {
    if body.bezeichnung.trim().is_empty() {
        return Err(AppError::BadRequest("Bezeichnung erforderlich".into()));
    }
    let row = sqlx::query_as::<_, Auszeichnung>(
        "INSERT INTO verein_auszeichnungen (mitglied_id, bezeichnung, verliehen_am, begruendung)
         VALUES ($1,$2,$3,$4)
         RETURNING id, mitglied_id, bezeichnung, verliehen_am, begruendung, created_at"
    )
    .bind(mitglied_id)
    .bind(&body.bezeichnung)
    .bind(body.verliehen_am)
    .bind(&body.begruendung)
    .fetch_one(&state.db)
    .await?;
    Ok(Json(row))
}

pub async fn delete_auszeichnung(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    sqlx::query("DELETE FROM verein_auszeichnungen WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

// ── Ehrungen-Übersicht ────────────────────────────────────────────────────────

#[derive(Serialize, sqlx::FromRow)]
pub struct Jubilar {
    pub id:                  Uuid,
    pub name:                String,
    pub eintrittsdatum:      NaiveDate,
    pub dienstjahre:         i32,
    pub naechstes_jubilaeum: i32,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct AblaufendeQualifikation {
    pub id:              Uuid,
    pub mitglied_name:   String,
    pub bezeichnung:     String,
    pub gueltig_bis:     NaiveDate,
    pub tage_verbleibend: i64,
}

pub async fn get_ehrungen(
    State(state): State<AppState>,
) -> AppResult<Json<serde_json::Value>> {
    let jubilare = sqlx::query_as::<_, Jubilar>(
        "SELECT
            id,
            vorname || ' ' || nachname AS name,
            eintrittsdatum,
            EXTRACT(YEAR FROM AGE(NOW(), eintrittsdatum))::int AS dienstjahre,
            CASE
                WHEN EXTRACT(YEAR FROM AGE(NOW(), eintrittsdatum))::int < 10  THEN 10
                WHEN EXTRACT(YEAR FROM AGE(NOW(), eintrittsdatum))::int < 25  THEN 25
                WHEN EXTRACT(YEAR FROM AGE(NOW(), eintrittsdatum))::int < 40  THEN 40
                WHEN EXTRACT(YEAR FROM AGE(NOW(), eintrittsdatum))::int < 50  THEN 50
                ELSE 0
            END AS naechstes_jubilaeum
         FROM verein_mitglieder
         WHERE archiviert = FALSE
           AND status IN ('aktiv','ehren')
           AND EXTRACT(YEAR FROM AGE(NOW(), eintrittsdatum))::int >= 9
           AND EXTRACT(YEAR FROM AGE(NOW(), eintrittsdatum))::int < 50
         ORDER BY dienstjahre DESC"
    )
    .fetch_all(&state.db)
    .await?;

    let ablaufend = sqlx::query_as::<_, AblaufendeQualifikation>(
        "SELECT
            q.id,
            m.vorname || ' ' || m.nachname AS mitglied_name,
            q.bezeichnung,
            q.gueltig_bis,
            (q.gueltig_bis - CURRENT_DATE)::bigint AS tage_verbleibend
         FROM verein_qualifikationen q
         JOIN verein_mitglieder m ON m.id = q.mitglied_id
         WHERE q.gueltig_bis IS NOT NULL
           AND q.gueltig_bis <= CURRENT_DATE + INTERVAL '90 days'
           AND m.archiviert = FALSE
         ORDER BY q.gueltig_bis"
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(serde_json::json!({
        "jubilare": jubilare,
        "ablaufende_qualifikationen": ablaufend,
    })))
}

// ── Inventar ──────────────────────────────────────────────────────────────────

#[derive(Serialize, sqlx::FromRow)]
pub struct InventarItem {
    pub id:           Uuid,
    pub name:         String,
    pub kategorie:    String,
    pub seriennummer: Option<String>,
    pub zustand:      String,
    pub standort:     Option<String>,
    pub bemerkung:    Option<String>,
    pub archiviert:   bool,
    pub ausgeliehen:  bool,
    pub created_at:   DateTime<Utc>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct Inventar {
    pub id:           Uuid,
    pub name:         String,
    pub kategorie:    String,
    pub seriennummer: Option<String>,
    pub zustand:      String,
    pub standort:     Option<String>,
    pub bemerkung:    Option<String>,
    pub archiviert:   bool,
    pub created_at:   DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct CreateInventar {
    pub name:         String,
    pub kategorie:    Option<String>,
    pub seriennummer: Option<String>,
    pub zustand:      Option<String>,
    pub standort:     Option<String>,
    pub bemerkung:    Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateInventar {
    pub name:         Option<String>,
    pub kategorie:    Option<String>,
    pub seriennummer: Option<String>,
    pub zustand:      Option<String>,
    pub standort:     Option<String>,
    pub bemerkung:    Option<String>,
    pub archiviert:   Option<bool>,
}

pub async fn list_inventar(State(state): State<AppState>) -> AppResult<Json<Vec<InventarItem>>> {
    let rows = sqlx::query_as::<_, InventarItem>(
        "SELECT i.id, i.name, i.kategorie, i.seriennummer, i.zustand, i.standort, i.bemerkung,
                i.archiviert, i.created_at,
                EXISTS(SELECT 1 FROM verein_ausleihen a
                       WHERE a.inventar_id = i.id AND a.rueckgabe_ist IS NULL) AS ausgeliehen
         FROM verein_inventar i
         ORDER BY i.archiviert, i.kategorie, i.name"
    )
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows))
}

pub async fn create_inventar(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateInventar>,
) -> AppResult<Json<Inventar>> {
    if !claims.is_admin_or_above() { return Err(AppError::Forbidden); }
    let row = sqlx::query_as::<_, Inventar>(
        "INSERT INTO verein_inventar (name, kategorie, seriennummer, zustand, standort, bemerkung)
         VALUES ($1, COALESCE($2,'sonstige'), $3, COALESCE($4,'gut'), $5, $6)
         RETURNING id, name, kategorie, seriennummer, zustand, standort, bemerkung, archiviert, created_at"
    )
    .bind(&body.name).bind(&body.kategorie).bind(&body.seriennummer)
    .bind(&body.zustand).bind(&body.standort).bind(&body.bemerkung)
    .fetch_one(&state.db).await?;
    audit::log(&state.db, Some(claims.sub), &claims.username,
        "INVENTAR_CREATED", Some("verein_inventar"), Some(row.id), None).await;
    Ok(Json(row))
}

pub async fn update_inventar(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateInventar>,
) -> AppResult<Json<Inventar>> {
    if !claims.is_admin_or_above() { return Err(AppError::Forbidden); }
    let row = sqlx::query_as::<_, Inventar>(
        "UPDATE verein_inventar SET
            name         = COALESCE($1, name),
            kategorie    = COALESCE($2, kategorie),
            seriennummer = $3,
            zustand      = COALESCE($4, zustand),
            standort     = $5,
            bemerkung    = $6,
            archiviert   = COALESCE($7, archiviert)
         WHERE id = $8
         RETURNING id, name, kategorie, seriennummer, zustand, standort, bemerkung, archiviert, created_at"
    )
    .bind(body.name).bind(body.kategorie).bind(body.seriennummer)
    .bind(body.zustand).bind(body.standort).bind(body.bemerkung)
    .bind(body.archiviert).bind(id)
    .fetch_optional(&state.db).await?.ok_or(AppError::NotFound)?;
    audit::log(&state.db, Some(claims.sub), &claims.username,
        "INVENTAR_UPDATED", Some("verein_inventar"), Some(id), None).await;
    Ok(Json(row))
}

pub async fn delete_inventar(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    if !claims.is_admin_or_above() { return Err(AppError::Forbidden); }
    let n = sqlx::query("UPDATE verein_inventar SET archiviert = TRUE WHERE id = $1")
        .bind(id).execute(&state.db).await?.rows_affected();
    if n == 0 { return Err(AppError::NotFound); }
    audit::log(&state.db, Some(claims.sub), &claims.username,
        "INVENTAR_ARCHIVED", Some("verein_inventar"), Some(id), None).await;
    Ok(Json(serde_json::json!({ "ok": true })))
}

// ── Ausleihen ─────────────────────────────────────────────────────────────────

#[derive(Serialize, sqlx::FromRow)]
pub struct Ausleihe {
    pub id:             Uuid,
    pub inventar_id:    Uuid,
    pub inventar_name:  String,
    pub ausgeliehen_an: String,
    pub ausgabe_datum:  NaiveDate,
    pub rueckgabe_soll: Option<NaiveDate>,
    pub rueckgabe_ist:  Option<NaiveDate>,
    pub bemerkung:      Option<String>,
    pub created_at:     DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct CreateAusleihe {
    pub ausgeliehen_an: String,
    pub ausgabe_datum:  Option<NaiveDate>,
    pub rueckgabe_soll: Option<NaiveDate>,
    pub bemerkung:      Option<String>,
}

#[derive(Deserialize)]
pub struct ReturnAusleihe {
    pub rueckgabe_ist: NaiveDate,
    pub bemerkung:     Option<String>,
}

pub async fn list_inventar_ausleihen(
    State(state): State<AppState>,
    Path(inventar_id): Path<Uuid>,
) -> AppResult<Json<Vec<Ausleihe>>> {
    let rows = sqlx::query_as::<_, Ausleihe>(
        "SELECT a.id, a.inventar_id, i.name AS inventar_name, a.ausgeliehen_an,
                a.ausgabe_datum, a.rueckgabe_soll, a.rueckgabe_ist, a.bemerkung, a.created_at
         FROM verein_ausleihen a JOIN verein_inventar i ON i.id = a.inventar_id
         WHERE a.inventar_id = $1 ORDER BY a.ausgabe_datum DESC"
    )
    .bind(inventar_id).fetch_all(&state.db).await?;
    Ok(Json(rows))
}

pub async fn create_ausleihe(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(inventar_id): Path<Uuid>,
    Json(body): Json<CreateAusleihe>,
) -> AppResult<Json<Ausleihe>> {
    let already = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM verein_ausleihen WHERE inventar_id = $1 AND rueckgabe_ist IS NULL"
    )
    .bind(inventar_id).fetch_one(&state.db).await?;
    if already > 0 {
        return Err(AppError::BadRequest("Gegenstand ist bereits ausgeliehen".into()));
    }
    let row = sqlx::query_as::<_, Ausleihe>(
        "INSERT INTO verein_ausleihen (inventar_id, ausgeliehen_an, ausgabe_datum, rueckgabe_soll, bemerkung)
         VALUES ($1,$2,COALESCE($3,CURRENT_DATE),$4,$5)
         RETURNING id, inventar_id,
             (SELECT name FROM verein_inventar WHERE id = $1) AS inventar_name,
             ausgeliehen_an, ausgabe_datum, rueckgabe_soll, rueckgabe_ist, bemerkung, created_at"
    )
    .bind(inventar_id).bind(&body.ausgeliehen_an).bind(body.ausgabe_datum)
    .bind(body.rueckgabe_soll).bind(&body.bemerkung)
    .fetch_one(&state.db).await?;
    audit::log(&state.db, Some(claims.sub), &claims.username,
        "AUSLEIHE_CREATED", Some("verein_ausleihen"), Some(row.id), None).await;
    Ok(Json(row))
}

pub async fn return_ausleihe(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ReturnAusleihe>,
) -> AppResult<Json<Ausleihe>> {
    let row = sqlx::query_as::<_, Ausleihe>(
        "UPDATE verein_ausleihen SET rueckgabe_ist = $1, bemerkung = COALESCE($2, bemerkung)
         WHERE id = $3
         RETURNING id, inventar_id,
             (SELECT name FROM verein_inventar WHERE id = inventar_id) AS inventar_name,
             ausgeliehen_an, ausgabe_datum, rueckgabe_soll, rueckgabe_ist, bemerkung, created_at"
    )
    .bind(body.rueckgabe_ist).bind(body.bemerkung).bind(id)
    .fetch_optional(&state.db).await?.ok_or(AppError::NotFound)?;
    audit::log(&state.db, Some(claims.sub), &claims.username,
        "AUSLEIHE_RETURNED", Some("verein_ausleihen"), Some(id), None).await;
    Ok(Json(row))
}

pub async fn delete_ausleihe(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    if !claims.is_admin_or_above() { return Err(AppError::Forbidden); }
    sqlx::query("DELETE FROM verein_ausleihen WHERE id = $1")
        .bind(id).execute(&state.db).await?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

// ── Schlüsselverwaltung ───────────────────────────────────────────────────────

#[derive(Serialize, sqlx::FromRow)]
pub struct SchluesselItem {
    pub id:              Uuid,
    pub bezeichnung:     String,
    pub schloss_bereich: Option<String>,
    pub kopien_anzahl:   i32,
    pub bemerkung:       Option<String>,
    pub ausgegeben:      i64,
    pub created_at:      DateTime<Utc>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct Schluessel {
    pub id:              Uuid,
    pub bezeichnung:     String,
    pub schloss_bereich: Option<String>,
    pub kopien_anzahl:   i32,
    pub bemerkung:       Option<String>,
    pub created_at:      DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct CreateSchluessel {
    pub bezeichnung:     String,
    pub schloss_bereich: Option<String>,
    pub kopien_anzahl:   Option<i32>,
    pub bemerkung:       Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateSchluessel {
    pub bezeichnung:     Option<String>,
    pub schloss_bereich: Option<String>,
    pub kopien_anzahl:   Option<i32>,
    pub bemerkung:       Option<String>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct SchluesselAusgabe {
    pub id:              Uuid,
    pub schluessel_id:   Uuid,
    pub inhaber_name:    String,
    pub ausgabe_datum:   NaiveDate,
    pub rueckgabe_datum: Option<NaiveDate>,
    pub bemerkung:       Option<String>,
    pub created_at:      DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct CreateSchluesselAusgabe {
    pub inhaber_name:  String,
    pub ausgabe_datum: Option<NaiveDate>,
    pub bemerkung:     Option<String>,
}

#[derive(Deserialize)]
pub struct ReturnSchluessel {
    pub rueckgabe_datum: NaiveDate,
    pub bemerkung:       Option<String>,
}

pub async fn list_schluessel(State(state): State<AppState>) -> AppResult<Json<Vec<SchluesselItem>>> {
    let rows = sqlx::query_as::<_, SchluesselItem>(
        "SELECT s.id, s.bezeichnung, s.schloss_bereich, s.kopien_anzahl, s.bemerkung, s.created_at,
                (SELECT COUNT(*) FROM verein_schluessel_ausgabe a
                 WHERE a.schluessel_id = s.id AND a.rueckgabe_datum IS NULL) AS ausgegeben
         FROM verein_schluessel s ORDER BY s.bezeichnung"
    )
    .fetch_all(&state.db).await?;
    Ok(Json(rows))
}

pub async fn create_schluessel(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateSchluessel>,
) -> AppResult<Json<Schluessel>> {
    if !claims.is_admin_or_above() { return Err(AppError::Forbidden); }
    let row = sqlx::query_as::<_, Schluessel>(
        "INSERT INTO verein_schluessel (bezeichnung, schloss_bereich, kopien_anzahl, bemerkung)
         VALUES ($1,$2,COALESCE($3,1),$4)
         RETURNING id, bezeichnung, schloss_bereich, kopien_anzahl, bemerkung, created_at"
    )
    .bind(&body.bezeichnung).bind(&body.schloss_bereich)
    .bind(body.kopien_anzahl).bind(&body.bemerkung)
    .fetch_one(&state.db).await?;
    audit::log(&state.db, Some(claims.sub), &claims.username,
        "SCHLUESSEL_CREATED", Some("verein_schluessel"), Some(row.id), None).await;
    Ok(Json(row))
}

pub async fn update_schluessel(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateSchluessel>,
) -> AppResult<Json<Schluessel>> {
    if !claims.is_admin_or_above() { return Err(AppError::Forbidden); }
    let row = sqlx::query_as::<_, Schluessel>(
        "UPDATE verein_schluessel SET
            bezeichnung     = COALESCE($1, bezeichnung),
            schloss_bereich = $2,
            kopien_anzahl   = COALESCE($3, kopien_anzahl),
            bemerkung       = $4
         WHERE id = $5
         RETURNING id, bezeichnung, schloss_bereich, kopien_anzahl, bemerkung, created_at"
    )
    .bind(body.bezeichnung).bind(body.schloss_bereich)
    .bind(body.kopien_anzahl).bind(body.bemerkung).bind(id)
    .fetch_optional(&state.db).await?.ok_or(AppError::NotFound)?;
    Ok(Json(row))
}

pub async fn delete_schluessel(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    if !claims.is_admin_or_above() { return Err(AppError::Forbidden); }
    let n = sqlx::query("DELETE FROM verein_schluessel WHERE id = $1")
        .bind(id).execute(&state.db).await?.rows_affected();
    if n == 0 { return Err(AppError::NotFound); }
    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn list_schluessel_ausgaben(
    State(state): State<AppState>,
    Path(schluessel_id): Path<Uuid>,
) -> AppResult<Json<Vec<SchluesselAusgabe>>> {
    let rows = sqlx::query_as::<_, SchluesselAusgabe>(
        "SELECT id, schluessel_id, inhaber_name, ausgabe_datum, rueckgabe_datum, bemerkung, created_at
         FROM verein_schluessel_ausgabe WHERE schluessel_id = $1 ORDER BY ausgabe_datum DESC"
    )
    .bind(schluessel_id).fetch_all(&state.db).await?;
    Ok(Json(rows))
}

pub async fn create_schluessel_ausgabe(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(schluessel_id): Path<Uuid>,
    Json(body): Json<CreateSchluesselAusgabe>,
) -> AppResult<Json<SchluesselAusgabe>> {
    let key = sqlx::query_as::<_, Schluessel>(
        "SELECT id, bezeichnung, schloss_bereich, kopien_anzahl, bemerkung, created_at
         FROM verein_schluessel WHERE id = $1"
    )
    .bind(schluessel_id).fetch_optional(&state.db).await?.ok_or(AppError::NotFound)?;

    let ausgegeben = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM verein_schluessel_ausgabe WHERE schluessel_id = $1 AND rueckgabe_datum IS NULL"
    )
    .bind(schluessel_id).fetch_one(&state.db).await?;

    if ausgegeben >= key.kopien_anzahl as i64 {
        return Err(AppError::BadRequest(format!("Alle {} Kopie(n) sind vergeben", key.kopien_anzahl)));
    }

    let row = sqlx::query_as::<_, SchluesselAusgabe>(
        "INSERT INTO verein_schluessel_ausgabe (schluessel_id, inhaber_name, ausgabe_datum, bemerkung)
         VALUES ($1,$2,COALESCE($3,CURRENT_DATE),$4)
         RETURNING id, schluessel_id, inhaber_name, ausgabe_datum, rueckgabe_datum, bemerkung, created_at"
    )
    .bind(schluessel_id).bind(&body.inhaber_name)
    .bind(body.ausgabe_datum).bind(&body.bemerkung)
    .fetch_one(&state.db).await?;
    audit::log(&state.db, Some(claims.sub), &claims.username,
        "SCHLUESSEL_AUSGEGEBEN", Some("verein_schluessel_ausgabe"), Some(row.id), None).await;
    Ok(Json(row))
}

pub async fn return_schluessel_ausgabe(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ReturnSchluessel>,
) -> AppResult<Json<SchluesselAusgabe>> {
    let row = sqlx::query_as::<_, SchluesselAusgabe>(
        "UPDATE verein_schluessel_ausgabe
         SET rueckgabe_datum = $1, bemerkung = COALESCE($2, bemerkung)
         WHERE id = $3
         RETURNING id, schluessel_id, inhaber_name, ausgabe_datum, rueckgabe_datum, bemerkung, created_at"
    )
    .bind(body.rueckgabe_datum).bind(body.bemerkung).bind(id)
    .fetch_optional(&state.db).await?.ok_or(AppError::NotFound)?;
    audit::log(&state.db, Some(claims.sub), &claims.username,
        "SCHLUESSEL_ZURUECK", Some("verein_schluessel_ausgabe"), Some(id), None).await;
    Ok(Json(row))
}

// ── Aufgaben ──────────────────────────────────────────────────────────────────

#[derive(Serialize, sqlx::FromRow)]
pub struct Aufgabe {
    pub id:              Uuid,
    pub titel:           String,
    pub beschreibung:    Option<String>,
    pub zugewiesen_an:   Option<Uuid>,
    pub zugewiesen_name: Option<String>,
    pub faellig_am:      Option<NaiveDate>,
    pub prioritaet:      String,
    pub status:          String,
    pub erstellt_von:    Option<Uuid>,
    pub created_at:      DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct CreateAufgabe {
    pub titel:         String,
    pub beschreibung:  Option<String>,
    pub zugewiesen_an: Option<Uuid>,
    pub faellig_am:    Option<NaiveDate>,
    pub prioritaet:    Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateAufgabe {
    pub titel:         Option<String>,
    pub beschreibung:  Option<String>,
    pub zugewiesen_an: Option<Uuid>,
    pub faellig_am:    Option<NaiveDate>,
    pub prioritaet:    Option<String>,
    pub status:        Option<String>,
}

pub async fn list_aufgaben(State(state): State<AppState>) -> AppResult<Json<Vec<Aufgabe>>> {
    let rows = sqlx::query_as::<_, Aufgabe>(
        "SELECT a.id, a.titel, a.beschreibung, a.zugewiesen_an,
                m.vorname || ' ' || m.nachname AS zugewiesen_name,
                a.faellig_am, a.prioritaet, a.status, a.erstellt_von, a.created_at
         FROM verein_aufgaben a
         LEFT JOIN verein_mitglieder m ON m.id = a.zugewiesen_an
         ORDER BY
             CASE a.status WHEN 'erledigt' THEN 1 ELSE 0 END,
             CASE a.prioritaet WHEN 'dringend' THEN 0 WHEN 'hoch' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
             a.faellig_am NULLS LAST"
    )
    .fetch_all(&state.db).await?;
    Ok(Json(rows))
}

pub async fn create_aufgabe(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateAufgabe>,
) -> AppResult<Json<Aufgabe>> {
    let row = sqlx::query_as::<_, Aufgabe>(
        "INSERT INTO verein_aufgaben (titel, beschreibung, zugewiesen_an, faellig_am, prioritaet, erstellt_von)
         VALUES ($1,$2,$3,$4,COALESCE($5,'normal'),$6)
         RETURNING id, titel, beschreibung, zugewiesen_an,
             (SELECT vorname || ' ' || nachname FROM verein_mitglieder WHERE id = $3) AS zugewiesen_name,
             faellig_am, prioritaet, status, erstellt_von, created_at"
    )
    .bind(&body.titel).bind(&body.beschreibung).bind(body.zugewiesen_an)
    .bind(body.faellig_am).bind(&body.prioritaet).bind(claims.sub)
    .fetch_one(&state.db).await?;
    audit::log(&state.db, Some(claims.sub), &claims.username,
        "AUFGABE_CREATED", Some("verein_aufgaben"), Some(row.id), None).await;
    Ok(Json(row))
}

pub async fn update_aufgabe(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateAufgabe>,
) -> AppResult<Json<Aufgabe>> {
    let row = sqlx::query_as::<_, Aufgabe>(
        "UPDATE verein_aufgaben SET
            titel         = COALESCE($1, titel),
            beschreibung  = $2,
            zugewiesen_an = $3,
            faellig_am    = $4,
            prioritaet    = COALESCE($5, prioritaet),
            status        = COALESCE($6, status)
         WHERE id = $7
         RETURNING id, titel, beschreibung, zugewiesen_an,
             (SELECT vorname || ' ' || nachname FROM verein_mitglieder WHERE id = zugewiesen_an) AS zugewiesen_name,
             faellig_am, prioritaet, status, erstellt_von, created_at"
    )
    .bind(body.titel).bind(body.beschreibung).bind(body.zugewiesen_an)
    .bind(body.faellig_am).bind(body.prioritaet).bind(body.status).bind(id)
    .fetch_optional(&state.db).await?.ok_or(AppError::NotFound)?;
    audit::log(&state.db, Some(claims.sub), &claims.username,
        "AUFGABE_UPDATED", Some("verein_aufgaben"), Some(id), None).await;
    Ok(Json(row))
}

pub async fn delete_aufgabe(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    if !claims.is_admin_or_above() { return Err(AppError::Forbidden); }
    let n = sqlx::query("DELETE FROM verein_aufgaben WHERE id = $1")
        .bind(id).execute(&state.db).await?.rows_affected();
    if n == 0 { return Err(AppError::NotFound); }
    Ok(Json(serde_json::json!({ "ok": true })))
}

// ── Vereinsveranstaltungen ────────────────────────────────────────────────────

#[derive(Serialize, sqlx::FromRow)]
pub struct VereinEvent {
    pub id:              Uuid,
    pub titel:           String,
    pub typ:             String,
    pub datum_von:       DateTime<Utc>,
    pub datum_bis:       Option<DateTime<Utc>>,
    pub ort:             Option<String>,
    pub beschreibung:    Option<String>,
    pub erstellt_von:    Option<Uuid>,
    pub created_at:      DateTime<Utc>,
    pub antworten_ja:    i64,
    pub antworten_nein:  i64,
    pub antworten_vllt:  i64,
}

#[derive(Deserialize)]
pub struct CreateEvent {
    pub titel:        String,
    pub typ:          Option<String>,
    pub datum_von:    DateTime<Utc>,
    pub datum_bis:    Option<DateTime<Utc>>,
    pub ort:          Option<String>,
    pub beschreibung: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateEvent {
    pub titel:        Option<String>,
    pub typ:          Option<String>,
    pub datum_von:    Option<DateTime<Utc>>,
    pub datum_bis:    Option<DateTime<Utc>>,
    pub ort:          Option<String>,
    pub beschreibung: Option<String>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct EventAntwort {
    pub id:           Uuid,
    pub event_id:     Uuid,
    pub mitglied_id:  Uuid,
    pub mitglied_name: String,
    pub antwort:      String,
    pub kommentar:    Option<String>,
    pub updated_at:   DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct SetAntwort {
    pub antwort:   String,
    pub kommentar: Option<String>,
}

pub async fn list_events(State(state): State<AppState>) -> AppResult<Json<Vec<VereinEvent>>> {
    let rows = sqlx::query_as::<_, VereinEvent>(
        "SELECT e.id, e.titel, e.typ, e.datum_von, e.datum_bis, e.ort, e.beschreibung,
                e.erstellt_von, e.created_at,
                COUNT(a.id) FILTER (WHERE a.antwort = 'ja')         AS antworten_ja,
                COUNT(a.id) FILTER (WHERE a.antwort = 'nein')       AS antworten_nein,
                COUNT(a.id) FILTER (WHERE a.antwort = 'vielleicht') AS antworten_vllt
         FROM verein_events e
         LEFT JOIN verein_event_antworten a ON a.event_id = e.id
         GROUP BY e.id
         ORDER BY e.datum_von DESC"
    )
    .fetch_all(&state.db).await?;
    Ok(Json(rows))
}

pub async fn create_event(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateEvent>,
) -> AppResult<Json<VereinEvent>> {
    if !claims.is_admin_or_above() { return Err(AppError::Forbidden); }
    let row = sqlx::query_as::<_, VereinEvent>(
        "INSERT INTO verein_events (titel, typ, datum_von, datum_bis, ort, beschreibung, erstellt_von)
         VALUES ($1, COALESCE($2,'sonstiges'), $3, $4, $5, $6, $7)
         RETURNING id, titel, typ, datum_von, datum_bis, ort, beschreibung, erstellt_von, created_at,
             0::bigint AS antworten_ja, 0::bigint AS antworten_nein, 0::bigint AS antworten_vllt"
    )
    .bind(&body.titel).bind(&body.typ).bind(body.datum_von).bind(body.datum_bis)
    .bind(&body.ort).bind(&body.beschreibung).bind(claims.sub)
    .fetch_one(&state.db).await?;
    audit::log(&state.db, Some(claims.sub), &claims.username,
        "EVENT_CREATED", Some("verein_events"), Some(row.id), None).await;
    Ok(Json(row))
}

pub async fn update_event(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateEvent>,
) -> AppResult<Json<VereinEvent>> {
    if !claims.is_admin_or_above() { return Err(AppError::Forbidden); }
    let row = sqlx::query_as::<_, VereinEvent>(
        "UPDATE verein_events SET
            titel        = COALESCE($1, titel),
            typ          = COALESCE($2, typ),
            datum_von    = COALESCE($3, datum_von),
            datum_bis    = $4,
            ort          = $5,
            beschreibung = $6
         WHERE id = $7
         RETURNING id, titel, typ, datum_von, datum_bis, ort, beschreibung, erstellt_von, created_at,
             (SELECT COUNT(*) FROM verein_event_antworten WHERE event_id = $7 AND antwort='ja')         AS antworten_ja,
             (SELECT COUNT(*) FROM verein_event_antworten WHERE event_id = $7 AND antwort='nein')       AS antworten_nein,
             (SELECT COUNT(*) FROM verein_event_antworten WHERE event_id = $7 AND antwort='vielleicht') AS antworten_vllt"
    )
    .bind(body.titel).bind(body.typ).bind(body.datum_von).bind(body.datum_bis)
    .bind(body.ort).bind(body.beschreibung).bind(id)
    .fetch_optional(&state.db).await?.ok_or(AppError::NotFound)?;
    Ok(Json(row))
}

pub async fn delete_event(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    if !claims.is_admin_or_above() { return Err(AppError::Forbidden); }
    let n = sqlx::query("DELETE FROM verein_events WHERE id = $1")
        .bind(id).execute(&state.db).await?.rows_affected();
    if n == 0 { return Err(AppError::NotFound); }
    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn list_event_antworten(
    State(state): State<AppState>,
    Path(event_id): Path<Uuid>,
) -> AppResult<Json<Vec<EventAntwort>>> {
    let rows = sqlx::query_as::<_, EventAntwort>(
        "SELECT a.id, a.event_id, a.mitglied_id,
                m.vorname || ' ' || m.nachname AS mitglied_name,
                a.antwort, a.kommentar, a.updated_at
         FROM verein_event_antworten a
         JOIN verein_mitglieder m ON m.id = a.mitglied_id
         ORDER BY a.antwort, m.nachname, m.vorname"
    )
    .bind(event_id)
    .fetch_all(&state.db).await?;
    Ok(Json(rows))
}

pub async fn set_meine_antwort(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
    Json(body): Json<SetAntwort>,
) -> AppResult<Json<EventAntwort>> {
    let mitglied_id: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM verein_mitglieder WHERE user_id = $1 AND archiviert = FALSE LIMIT 1"
    )
    .bind(claims.sub).fetch_optional(&state.db).await?;

    let mid = mitglied_id.ok_or_else(|| AppError::BadRequest(
        "Kein verknüpftes Vereinsmitglied für diesen Account".into()
    ))?;

    set_antwort_for_mitglied(&state.db, event_id, mid, &body.antwort, body.kommentar.as_deref()).await
}

pub async fn set_antwort_admin(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((event_id, mitglied_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<SetAntwort>,
) -> AppResult<Json<EventAntwort>> {
    if !claims.is_admin_or_above() { return Err(AppError::Forbidden); }
    set_antwort_for_mitglied(&state.db, event_id, mitglied_id, &body.antwort, body.kommentar.as_deref()).await
}

async fn set_antwort_for_mitglied(
    db: &sqlx::PgPool,
    event_id: Uuid,
    mitglied_id: Uuid,
    antwort: &str,
    kommentar: Option<&str>,
) -> AppResult<Json<EventAntwort>> {
    let row = sqlx::query_as::<_, EventAntwort>(
        "INSERT INTO verein_event_antworten (event_id, mitglied_id, antwort, kommentar)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (event_id, mitglied_id) DO UPDATE
             SET antwort = EXCLUDED.antwort, kommentar = EXCLUDED.kommentar, updated_at = NOW()
         RETURNING id, event_id, mitglied_id,
             (SELECT vorname || ' ' || nachname FROM verein_mitglieder WHERE id = $2) AS mitglied_name,
             antwort, kommentar, updated_at"
    )
    .bind(event_id).bind(mitglied_id).bind(antwort).bind(kommentar)
    .fetch_one(db).await?;
    Ok(Json(row))
}

pub async fn export_event_csv(
    State(state): State<AppState>,
    Path(event_id): Path<Uuid>,
) -> Result<Response, AppError> {
    let event = sqlx::query_as::<_, (String, DateTime<Utc>)>(
        "SELECT titel, datum_von FROM verein_events WHERE id = $1"
    )
    .bind(event_id).fetch_optional(&state.db).await?
    .ok_or(AppError::NotFound)?;

    let antworten = sqlx::query_as::<_, EventAntwort>(
        "SELECT a.id, a.event_id, a.mitglied_id,
                m.vorname || ' ' || m.nachname AS mitglied_name,
                a.antwort, a.kommentar, a.updated_at
         FROM verein_event_antworten a
         JOIN verein_mitglieder m ON m.id = a.mitglied_id
         ORDER BY a.antwort, m.nachname"
    )
    .bind(event_id).fetch_all(&state.db).await?;

    let mut csv = String::from("Name;Antwort;Kommentar\n");
    for a in &antworten {
        let antwort_de = match a.antwort.as_str() {
            "ja" => "Zusage", "nein" => "Absage", _ => "Vielleicht"
        };
        csv.push_str(&format!("{};{};{}\n",
            a.mitglied_name,
            antwort_de,
            a.kommentar.as_deref().unwrap_or("")
        ));
    }

    let filename = format!("anwesenheit_{}.csv",
        event.0.replace(' ', "_").to_lowercase());

    Ok(Response::builder()
        .header(header::CONTENT_TYPE, "text/csv; charset=utf-8")
        .header(header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{}\"", filename))
        .body(Body::from(csv))
        .unwrap())
}

// ── Protokollverwaltung ───────────────────────────────────────────────────────

#[derive(Serialize, sqlx::FromRow)]
pub struct Protokoll {
    pub id:           Uuid,
    pub titel:        String,
    pub datum:        NaiveDate,
    pub ort:          Option<String>,
    pub event_id:     Option<Uuid>,
    pub protokollant: Option<String>,
    pub anwesende:    Option<i32>,
    pub status:       String,
    pub erstellt_von: Option<Uuid>,
    pub created_at:   DateTime<Utc>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct ProtokollTop {
    pub id:           Uuid,
    pub protokoll_id: Uuid,
    pub position:     i32,
    pub titel:        String,
    pub inhalt:       Option<String>,
    pub beschluss:    Option<String>,
    pub created_at:   DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct CreateProtokoll {
    pub titel:        String,
    pub datum:        NaiveDate,
    pub ort:          Option<String>,
    pub event_id:     Option<Uuid>,
    pub protokollant: Option<String>,
    pub anwesende:    Option<i32>,
}

#[derive(Deserialize)]
pub struct UpdateProtokoll {
    pub titel:        Option<String>,
    pub datum:        Option<NaiveDate>,
    pub ort:          Option<String>,
    pub event_id:     Option<Uuid>,
    pub protokollant: Option<String>,
    pub anwesende:    Option<i32>,
    pub status:       Option<String>,
}

#[derive(Deserialize)]
pub struct CreateTop {
    pub titel:     String,
    pub inhalt:    Option<String>,
    pub beschluss: Option<String>,
    pub position:  Option<i32>,
}

#[derive(Deserialize)]
pub struct UpdateTop {
    pub titel:     Option<String>,
    pub inhalt:    Option<String>,
    pub beschluss: Option<String>,
    pub position:  Option<i32>,
}

pub async fn list_protokolle(State(state): State<AppState>) -> AppResult<Json<Vec<Protokoll>>> {
    let rows = sqlx::query_as::<_, Protokoll>(
        "SELECT id, titel, datum, ort, event_id, protokollant, anwesende, status, erstellt_von, created_at
         FROM verein_protokolle ORDER BY datum DESC"
    )
    .fetch_all(&state.db).await?;
    Ok(Json(rows))
}

pub async fn get_protokoll(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let protokoll = sqlx::query_as::<_, Protokoll>(
        "SELECT id, titel, datum, ort, event_id, protokollant, anwesende, status, erstellt_von, created_at
         FROM verein_protokolle WHERE id = $1"
    )
    .bind(id).fetch_optional(&state.db).await?.ok_or(AppError::NotFound)?;

    let tops = sqlx::query_as::<_, ProtokollTop>(
        "SELECT id, protokoll_id, position, titel, inhalt, beschluss, created_at
         FROM verein_protokoll_tops WHERE protokoll_id = $1 ORDER BY position, created_at"
    )
    .bind(id).fetch_all(&state.db).await?;

    Ok(Json(serde_json::json!({ "protokoll": protokoll, "tops": tops })))
}

pub async fn create_protokoll(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateProtokoll>,
) -> AppResult<Json<Protokoll>> {
    if !claims.is_admin_or_above() { return Err(AppError::Forbidden); }
    let row = sqlx::query_as::<_, Protokoll>(
        "INSERT INTO verein_protokolle (titel, datum, ort, event_id, protokollant, anwesende, erstellt_von)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING id, titel, datum, ort, event_id, protokollant, anwesende, status, erstellt_von, created_at"
    )
    .bind(&body.titel).bind(body.datum).bind(&body.ort).bind(body.event_id)
    .bind(&body.protokollant).bind(body.anwesende).bind(claims.sub)
    .fetch_one(&state.db).await?;
    audit::log(&state.db, Some(claims.sub), &claims.username,
        "PROTOKOLL_CREATED", Some("verein_protokolle"), Some(row.id), None).await;
    Ok(Json(row))
}

pub async fn update_protokoll(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateProtokoll>,
) -> AppResult<Json<Protokoll>> {
    if !claims.is_admin_or_above() { return Err(AppError::Forbidden); }
    let row = sqlx::query_as::<_, Protokoll>(
        "UPDATE verein_protokolle SET
            titel        = COALESCE($1, titel),
            datum        = COALESCE($2, datum),
            ort          = $3,
            event_id     = $4,
            protokollant = $5,
            anwesende    = $6,
            status       = COALESCE($7, status)
         WHERE id = $8
         RETURNING id, titel, datum, ort, event_id, protokollant, anwesende, status, erstellt_von, created_at"
    )
    .bind(body.titel).bind(body.datum).bind(body.ort).bind(body.event_id)
    .bind(body.protokollant).bind(body.anwesende).bind(body.status).bind(id)
    .fetch_optional(&state.db).await?.ok_or(AppError::NotFound)?;
    Ok(Json(row))
}

pub async fn delete_protokoll(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    if !claims.is_admin_or_above() { return Err(AppError::Forbidden); }
    let n = sqlx::query("DELETE FROM verein_protokolle WHERE id = $1")
        .bind(id).execute(&state.db).await?.rows_affected();
    if n == 0 { return Err(AppError::NotFound); }
    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn create_top(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(protokoll_id): Path<Uuid>,
    Json(body): Json<CreateTop>,
) -> AppResult<Json<ProtokollTop>> {
    if !claims.is_admin_or_above() { return Err(AppError::Forbidden); }
    let next_pos: i64 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(position), 0) + 1 FROM verein_protokoll_tops WHERE protokoll_id = $1"
    )
    .bind(protokoll_id).fetch_one(&state.db).await?;

    let row = sqlx::query_as::<_, ProtokollTop>(
        "INSERT INTO verein_protokoll_tops (protokoll_id, position, titel, inhalt, beschluss)
         VALUES ($1, COALESCE($2, $3), $4, $5, $6)
         RETURNING id, protokoll_id, position, titel, inhalt, beschluss, created_at"
    )
    .bind(protokoll_id).bind(body.position).bind(next_pos as i32)
    .bind(&body.titel).bind(&body.inhalt).bind(&body.beschluss)
    .fetch_one(&state.db).await?;
    Ok(Json(row))
}

pub async fn update_top(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateTop>,
) -> AppResult<Json<ProtokollTop>> {
    if !claims.is_admin_or_above() { return Err(AppError::Forbidden); }
    let row = sqlx::query_as::<_, ProtokollTop>(
        "UPDATE verein_protokoll_tops SET
            titel     = COALESCE($1, titel),
            inhalt    = $2,
            beschluss = $3,
            position  = COALESCE($4, position)
         WHERE id = $5
         RETURNING id, protokoll_id, position, titel, inhalt, beschluss, created_at"
    )
    .bind(body.titel).bind(body.inhalt).bind(body.beschluss).bind(body.position).bind(id)
    .fetch_optional(&state.db).await?.ok_or(AppError::NotFound)?;
    Ok(Json(row))
}

pub async fn delete_top(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    if !claims.is_admin_or_above() { return Err(AppError::Forbidden); }
    sqlx::query("DELETE FROM verein_protokoll_tops WHERE id = $1")
        .bind(id).execute(&state.db).await?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

// ── Finanzen ─────────────────────────────────────────────────────────────────

#[derive(Serialize, sqlx::FromRow)]
pub struct FinanzKategorie {
    pub id:         Uuid,
    pub name:       String,
    pub typ:        String,
    pub created_at: DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct CreateKategorie {
    pub name: String,
    pub typ:  Option<String>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct Buchung {
    pub id:             Uuid,
    pub datum:          NaiveDate,
    pub bezeichnung:    String,
    pub betrag:         f64,
    pub typ:            String,
    pub kategorie_id:   Option<Uuid>,
    pub kategorie_name: Option<String>,
    pub mitglied_id:    Option<Uuid>,
    pub mitglied_name:  Option<String>,
    pub beleg_nr:       Option<String>,
    pub notiz:          Option<String>,
    pub erstellt_von:   Option<Uuid>,
    pub created_at:     DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct CreateBuchung {
    pub datum:        Option<NaiveDate>,
    pub bezeichnung:  String,
    pub betrag:       f64,
    pub typ:          String,
    pub kategorie_id: Option<Uuid>,
    pub mitglied_id:  Option<Uuid>,
    pub beleg_nr:     Option<String>,
    pub notiz:        Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateBuchung {
    pub datum:        Option<NaiveDate>,
    pub bezeichnung:  Option<String>,
    pub betrag:       Option<f64>,
    pub typ:          Option<String>,
    pub kategorie_id: Option<Uuid>,
    pub mitglied_id:  Option<Uuid>,
    pub beleg_nr:     Option<String>,
    pub notiz:        Option<String>,
}

#[derive(Deserialize)]
pub struct BuchungFilter {
    pub jahr:         Option<i32>,
    pub typ:          Option<String>,
    pub kategorie_id: Option<Uuid>,
}

#[derive(Serialize)]
pub struct FinanzSummary {
    pub einnahmen: f64,
    pub ausgaben:  f64,
    pub saldo:     f64,
    pub jahr:      Option<i32>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct Beitrag {
    pub id:            Uuid,
    pub mitglied_id:   Uuid,
    pub mitglied_name: String,
    pub mitglied_nr:   Option<String>,
    pub jahr:          i32,
    pub betrag:        f64,
    pub bezahlt_am:    Option<NaiveDate>,
    pub status:        String,
    pub notiz:         Option<String>,
    pub created_at:    DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct CreateBeitrag {
    pub mitglied_id: Uuid,
    pub jahr:        i32,
    pub betrag:      f64,
    pub bezahlt_am:  Option<NaiveDate>,
    pub status:      Option<String>,
    pub notiz:       Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateBeitrag {
    pub betrag:     Option<f64>,
    pub bezahlt_am: Option<NaiveDate>,
    pub status:     Option<String>,
    pub notiz:      Option<String>,
}

#[derive(Deserialize)]
pub struct GenerateBeitraegeBody {
    pub jahr:   i32,
    pub betrag: f64,
}

pub async fn list_finanz_kategorien(
    State(state): State<AppState>,
) -> AppResult<Json<Vec<FinanzKategorie>>> {
    let rows = sqlx::query_as::<_, FinanzKategorie>(
        "SELECT id, name, typ, created_at FROM verein_finanz_kategorien ORDER BY name"
    )
    .fetch_all(&state.db).await?;
    Ok(Json(rows))
}

pub async fn create_finanz_kategorie(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateKategorie>,
) -> AppResult<Json<FinanzKategorie>> {
    if !claims.is_admin_or_above() { return Err(AppError::Forbidden); }
    let row = sqlx::query_as::<_, FinanzKategorie>(
        "INSERT INTO verein_finanz_kategorien (name, typ) VALUES ($1, $2)
         RETURNING id, name, typ, created_at"
    )
    .bind(&body.name)
    .bind(body.typ.as_deref().unwrap_or("ausgabe"))
    .fetch_one(&state.db).await?;
    Ok(Json(row))
}

pub async fn delete_finanz_kategorie(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    if !claims.is_admin_or_above() { return Err(AppError::Forbidden); }
    let n = sqlx::query("DELETE FROM verein_finanz_kategorien WHERE id = $1")
        .bind(id).execute(&state.db).await?.rows_affected();
    if n == 0 { return Err(AppError::NotFound); }
    Ok(Json(serde_json::json!({ "deleted": id })))
}

pub async fn list_buchungen(
    State(state): State<AppState>,
    axum::extract::Query(filter): axum::extract::Query<BuchungFilter>,
) -> AppResult<Json<Vec<Buchung>>> {
    let rows = sqlx::query_as::<_, Buchung>(
        "SELECT b.id, b.datum, b.bezeichnung, b.betrag, b.typ,
                b.kategorie_id, k.name AS kategorie_name,
                b.mitglied_id,
                CONCAT(m.vorname, ' ', m.nachname) AS mitglied_name,
                b.beleg_nr, b.notiz, b.erstellt_von, b.created_at
         FROM verein_buchungen b
         LEFT JOIN verein_finanz_kategorien k ON k.id = b.kategorie_id
         LEFT JOIN verein_mitglieder m ON m.id = b.mitglied_id
         WHERE ($1::int IS NULL OR EXTRACT(YEAR FROM b.datum) = $1)
           AND ($2::text IS NULL OR b.typ = $2)
           AND ($3::uuid IS NULL OR b.kategorie_id = $3)
         ORDER BY b.datum DESC, b.created_at DESC"
    )
    .bind(filter.jahr)
    .bind(&filter.typ)
    .bind(filter.kategorie_id)
    .fetch_all(&state.db).await?;
    Ok(Json(rows))
}

pub async fn create_buchung(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateBuchung>,
) -> AppResult<Json<Buchung>> {
    if !claims.is_admin_or_above() { return Err(AppError::Forbidden); }
    if body.bezeichnung.trim().is_empty() {
        return Err(AppError::BadRequest("Bezeichnung erforderlich".into()));
    }
    let row = sqlx::query_as::<_, Buchung>(
        "INSERT INTO verein_buchungen (datum, bezeichnung, betrag, typ, kategorie_id, mitglied_id, beleg_nr, notiz, erstellt_von)
         VALUES (COALESCE($1, CURRENT_DATE), $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, datum, bezeichnung, betrag, typ,
                   kategorie_id,
                   (SELECT name FROM verein_finanz_kategorien WHERE id = $5) AS kategorie_name,
                   mitglied_id,
                   (SELECT CONCAT(vorname, ' ', nachname) FROM verein_mitglieder WHERE id = $6) AS mitglied_name,
                   beleg_nr, notiz, erstellt_von, created_at"
    )
    .bind(body.datum)
    .bind(&body.bezeichnung)
    .bind(body.betrag)
    .bind(&body.typ)
    .bind(body.kategorie_id)
    .bind(body.mitglied_id)
    .bind(&body.beleg_nr)
    .bind(&body.notiz)
    .bind(claims.sub)
    .fetch_one(&state.db).await?;
    audit::log(&state.db, claims.sub,
        "BUCHUNG_CREATED", Some("verein_buchungen"), Some(row.id), None).await;
    Ok(Json(row))
}

pub async fn update_buchung(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateBuchung>,
) -> AppResult<Json<Buchung>> {
    if !claims.is_admin_or_above() { return Err(AppError::Forbidden); }
    let row = sqlx::query_as::<_, Buchung>(
        "UPDATE verein_buchungen SET
             datum        = COALESCE($1, datum),
             bezeichnung  = COALESCE($2, bezeichnung),
             betrag       = COALESCE($3, betrag),
             typ          = COALESCE($4, typ),
             kategorie_id = $5,
             mitglied_id  = $6,
             beleg_nr     = $7,
             notiz        = $8
         WHERE id = $9
         RETURNING id, datum, bezeichnung, betrag, typ,
                   kategorie_id,
                   (SELECT name FROM verein_finanz_kategorien WHERE id = $5) AS kategorie_name,
                   mitglied_id,
                   (SELECT CONCAT(vorname, ' ', nachname) FROM verein_mitglieder WHERE id = $6) AS mitglied_name,
                   beleg_nr, notiz, erstellt_von, created_at"
    )
    .bind(body.datum)
    .bind(&body.bezeichnung)
    .bind(body.betrag)
    .bind(&body.typ)
    .bind(body.kategorie_id)
    .bind(body.mitglied_id)
    .bind(&body.beleg_nr)
    .bind(&body.notiz)
    .bind(id)
    .fetch_optional(&state.db).await?
    .ok_or(AppError::NotFound)?;
    Ok(Json(row))
}

pub async fn delete_buchung(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    if !claims.is_admin_or_above() { return Err(AppError::Forbidden); }
    let n = sqlx::query("DELETE FROM verein_buchungen WHERE id = $1")
        .bind(id).execute(&state.db).await?.rows_affected();
    if n == 0 { return Err(AppError::NotFound); }
    Ok(Json(serde_json::json!({ "deleted": id })))
}

pub async fn get_finanz_summary(
    State(state): State<AppState>,
    axum::extract::Query(filter): axum::extract::Query<BuchungFilter>,
) -> AppResult<Json<FinanzSummary>> {
    let (einnahmen, ausgaben): (f64, f64) = sqlx::query_as::<_, (f64, f64)>(
        "SELECT
             COALESCE(SUM(betrag) FILTER (WHERE typ = 'einnahme'), 0.0),
             COALESCE(SUM(betrag) FILTER (WHERE typ = 'ausgabe'),  0.0)
         FROM verein_buchungen
         WHERE ($1::int IS NULL OR EXTRACT(YEAR FROM datum) = $1)"
    )
    .bind(filter.jahr)
    .fetch_one(&state.db).await?;
    Ok(Json(FinanzSummary {
        einnahmen,
        ausgaben,
        saldo: einnahmen - ausgaben,
        jahr: filter.jahr,
    }))
}

pub async fn list_beitraege(
    State(state): State<AppState>,
    axum::extract::Query(filter): axum::extract::Query<BuchungFilter>,
) -> AppResult<Json<Vec<Beitrag>>> {
    let rows = sqlx::query_as::<_, Beitrag>(
        "SELECT b.id, b.mitglied_id,
                CONCAT(m.vorname, ' ', m.nachname) AS mitglied_name,
                m.mitgliedsnummer AS mitglied_nr,
                b.jahr, b.betrag, b.bezahlt_am, b.status, b.notiz, b.created_at
         FROM verein_beitraege b
         JOIN verein_mitglieder m ON m.id = b.mitglied_id
         WHERE ($1::int IS NULL OR b.jahr = $1)
           AND ($2::text IS NULL OR b.status = $2)
           AND m.archiviert = FALSE
         ORDER BY m.nachname, m.vorname, b.jahr DESC"
    )
    .bind(filter.jahr)
    .bind(&filter.typ)  // wir missbrauchen 'typ' als status-filter im frontend
    .fetch_all(&state.db).await?;
    Ok(Json(rows))
}

pub async fn create_beitrag(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateBeitrag>,
) -> AppResult<Json<Beitrag>> {
    if !claims.is_admin_or_above() { return Err(AppError::Forbidden); }
    let row = sqlx::query_as::<_, Beitrag>(
        "INSERT INTO verein_beitraege (mitglied_id, jahr, betrag, bezahlt_am, status, notiz)
         VALUES ($1, $2, $3, $4, COALESCE($5, 'offen'), $6)
         RETURNING id, mitglied_id,
                   (SELECT CONCAT(vorname, ' ', nachname) FROM verein_mitglieder WHERE id = $1) AS mitglied_name,
                   (SELECT mitgliedsnummer FROM verein_mitglieder WHERE id = $1) AS mitglied_nr,
                   jahr, betrag, bezahlt_am, status, notiz, created_at"
    )
    .bind(body.mitglied_id)
    .bind(body.jahr)
    .bind(body.betrag)
    .bind(body.bezahlt_am)
    .bind(&body.status)
    .bind(&body.notiz)
    .fetch_one(&state.db).await?;
    Ok(Json(row))
}

pub async fn update_beitrag(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateBeitrag>,
) -> AppResult<Json<Beitrag>> {
    if !claims.is_admin_or_above() { return Err(AppError::Forbidden); }
    let row = sqlx::query_as::<_, Beitrag>(
        "UPDATE verein_beitraege SET
             betrag     = COALESCE($1, betrag),
             bezahlt_am = $2,
             status     = COALESCE($3, status),
             notiz      = $4
         WHERE id = $5
         RETURNING id, mitglied_id,
                   (SELECT CONCAT(vorname, ' ', nachname) FROM verein_mitglieder WHERE id = mitglied_id) AS mitglied_name,
                   (SELECT mitgliedsnummer FROM verein_mitglieder WHERE id = mitglied_id) AS mitglied_nr,
                   jahr, betrag, bezahlt_am, status, notiz, created_at"
    )
    .bind(body.betrag)
    .bind(body.bezahlt_am)
    .bind(&body.status)
    .bind(&body.notiz)
    .bind(id)
    .fetch_optional(&state.db).await?
    .ok_or(AppError::NotFound)?;
    Ok(Json(row))
}

pub async fn delete_beitrag(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    if !claims.is_admin_or_above() { return Err(AppError::Forbidden); }
    let n = sqlx::query("DELETE FROM verein_beitraege WHERE id = $1")
        .bind(id).execute(&state.db).await?.rows_affected();
    if n == 0 { return Err(AppError::NotFound); }
    Ok(Json(serde_json::json!({ "deleted": id })))
}

pub async fn generate_beitraege(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<GenerateBeitraegeBody>,
) -> AppResult<Json<serde_json::Value>> {
    if !claims.is_admin_or_above() { return Err(AppError::Forbidden); }
    // Alle aktiven Mitglieder die noch keinen Beitrag für das Jahr haben
    let inserted: i64 = sqlx::query_scalar(
        "WITH ins AS (
             INSERT INTO verein_beitraege (mitglied_id, jahr, betrag)
             SELECT m.id, $1, $2
             FROM verein_mitglieder m
             WHERE m.archiviert = FALSE
               AND m.status = 'aktiv'
               AND NOT EXISTS (
                   SELECT 1 FROM verein_beitraege b
                   WHERE b.mitglied_id = m.id AND b.jahr = $1
               )
             RETURNING id
         ) SELECT COUNT(*) FROM ins"
    )
    .bind(body.jahr)
    .bind(body.betrag)
    .fetch_one(&state.db).await?;
    Ok(Json(serde_json::json!({ "created": inserted, "jahr": body.jahr })))
}

// ── Router ────────────────────────────────────────────────────────────────────

pub fn router(state: AppState) -> Router<AppState> {
    let protected = Router::new()
        // Briefkopf
        .route("/briefkopf",       put(update_briefkopf))
        .route("/logo",            post(upload_logo).delete(delete_logo))
        // Schwarzes Brett
        .route("/posts",           post(create_post))
        .route("/posts/:id",       put(update_post).delete(delete_post))
        // Dokumente
        .route("/dokumente",       post(upload_document))
        .route("/dokumente/:id",   delete(delete_document))
        // Mitglieder
        .route("/mitglieder",      post(create_mitglied))
        .route("/mitglieder/:id",  put(update_mitglied).delete(delete_mitglied))
        // Qualifikationen
        .route("/mitglieder/:id/qualifikationen", post(create_qualifikation))
        .route("/qualifikationen/:id",            delete(delete_qualifikation))
        // Auszeichnungen
        .route("/mitglieder/:id/auszeichnungen",  post(create_auszeichnung))
        .route("/auszeichnungen/:id",             delete(delete_auszeichnung))
        // Inventar
        .route("/inventar",        post(create_inventar))
        .route("/inventar/:id",    put(update_inventar).delete(delete_inventar))
        .route("/inventar/:id/ausleihen",         post(create_ausleihe))
        .route("/ausleihen/:id/rueckgabe",         put(return_ausleihe))
        .route("/ausleihen/:id",                   delete(delete_ausleihe))
        // Schlüssel
        .route("/schluessel",      post(create_schluessel))
        .route("/schluessel/:id",  put(update_schluessel).delete(delete_schluessel))
        .route("/schluessel/:id/ausgaben",         post(create_schluessel_ausgabe))
        .route("/schluessel-ausgaben/:id/rueckgabe", put(return_schluessel_ausgabe))
        // Aufgaben
        .route("/aufgaben",        post(create_aufgabe))
        .route("/aufgaben/:id",    put(update_aufgabe).delete(delete_aufgabe))
        // Events
        .route("/events",          post(create_event))
        .route("/events/:id",      put(update_event).delete(delete_event))
        .route("/events/:id/meine-antwort",        put(set_meine_antwort))
        .route("/events/:id/antworten/:mitglied_id", put(set_antwort_admin))
        // Protokolle
        .route("/protokolle",         post(create_protokoll))
        .route("/protokolle/:id",     put(update_protokoll).delete(delete_protokoll))
        .route("/protokolle/:id/tops",         post(create_top))
        .route("/protokoll-tops/:id",          put(update_top).delete(delete_top))
        // Finanzen
        .route("/finanz/kategorien",           post(create_finanz_kategorie))
        .route("/finanz/kategorien/:id",       delete(delete_finanz_kategorie))
        .route("/finanz/buchungen",            post(create_buchung))
        .route("/finanz/buchungen/:id",        put(update_buchung).delete(delete_buchung))
        .route("/finanz/beitraege",            post(create_beitrag))
        .route("/finanz/beitraege/generieren", post(generate_beitraege))
        .route("/finanz/beitraege/:id",        put(update_beitrag).delete(delete_beitrag))
        .route_layer(middleware::from_fn_with_state(state.clone(), require_auth));

    Router::new()
        .route("/briefkopf",              get(get_briefkopf))
        .route("/logo",                   get(get_logo))
        .route("/posts",                  get(list_posts))
        .route("/dokumente",              get(list_documents))
        .route("/dokumente/:id/download", get(download_document))
        .route("/mitglieder",             get(list_mitglieder))
        .route("/mitglieder/:id/qualifikationen", get(list_qualifikationen))
        .route("/mitglieder/:id/auszeichnungen",  get(list_auszeichnungen))
        .route("/ehrungen",               get(get_ehrungen))
        .route("/inventar",               get(list_inventar))
        .route("/inventar/:id/ausleihen", get(list_inventar_ausleihen))
        .route("/schluessel",             get(list_schluessel))
        .route("/schluessel/:id/ausgaben", get(list_schluessel_ausgaben))
        .route("/aufgaben",               get(list_aufgaben))
        .route("/events",                 get(list_events))
        .route("/events/:id/antworten",   get(list_event_antworten))
        .route("/events/:id/antworten/csv", get(export_event_csv))
        .route("/protokolle",             get(list_protokolle))
        .route("/protokolle/:id",         get(get_protokoll))
        .route("/finanz/kategorien",      get(list_finanz_kategorien))
        .route("/finanz/buchungen",       get(list_buchungen))
        .route("/finanz/summary",         get(get_finanz_summary))
        .route("/finanz/beitraege",       get(list_beitraege))
        .merge(protected)
        .route_layer(middleware::from_fn_with_state(state, require_auth))
}
