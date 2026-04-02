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

// ── Mitglieder ────────────────────────────────────────────────────────────────

#[derive(Serialize, sqlx::FromRow)]
pub struct Mitglied {
    pub id:              Uuid,
    pub mitgliedsnummer: String,
    pub vorname:         String,
    pub nachname:        String,
    pub email:           Option<String>,
    pub telefon:         Option<String>,
    pub geburtsdatum:    Option<NaiveDate>,
    pub eintrittsdatum:  NaiveDate,
    pub status:          String,
    pub user_id:         Option<Uuid>,
    pub austritt_datum:  Option<NaiveDate>,
    pub austritt_grund:  Option<String>,
    pub bemerkung:       Option<String>,
    pub archiviert:      bool,
    pub created_at:      DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct CreateMitglied {
    pub vorname:        String,
    pub nachname:       String,
    pub email:          Option<String>,
    pub telefon:        Option<String>,
    pub geburtsdatum:   Option<NaiveDate>,
    pub eintrittsdatum: NaiveDate,
    pub status:         Option<String>,
    pub user_id:        Option<Uuid>,
    pub bemerkung:      Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateMitglied {
    pub vorname:        Option<String>,
    pub nachname:       Option<String>,
    pub email:          Option<String>,
    pub telefon:        Option<String>,
    pub geburtsdatum:   Option<NaiveDate>,
    pub eintrittsdatum: Option<NaiveDate>,
    pub status:         Option<String>,
    pub user_id:        Option<Uuid>,
    pub austritt_datum: Option<NaiveDate>,
    pub austritt_grund: Option<String>,
    pub bemerkung:      Option<String>,
    pub archiviert:     Option<bool>,
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
                bemerkung, archiviert, created_at
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
             eintrittsdatum, status, user_id, bemerkung)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING id, mitgliedsnummer, vorname, nachname, email, telefon, geburtsdatum,
                   eintrittsdatum, status, user_id, austritt_datum, austritt_grund,
                   bemerkung, archiviert, created_at"
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
            vorname        = COALESCE($1, vorname),
            nachname       = COALESCE($2, nachname),
            email          = $3,
            telefon        = $4,
            geburtsdatum   = $5,
            eintrittsdatum = COALESCE($6, eintrittsdatum),
            status         = COALESCE($7, status),
            user_id        = $8,
            austritt_datum = $9,
            austritt_grund = $10,
            bemerkung      = $11,
            archiviert     = COALESCE($12, archiviert)
         WHERE id = $13
         RETURNING id, mitgliedsnummer, vorname, nachname, email, telefon, geburtsdatum,
                   eintrittsdatum, status, user_id, austritt_datum, austritt_grund,
                   bemerkung, archiviert, created_at"
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
        // Mitglieder
        .route("/mitglieder",      post(create_mitglied))
        .route("/mitglieder/:id",  put(update_mitglied).delete(delete_mitglied))
        // Qualifikationen
        .route("/mitglieder/:id/qualifikationen", post(create_qualifikation))
        .route("/qualifikationen/:id",            delete(delete_qualifikation))
        // Auszeichnungen
        .route("/mitglieder/:id/auszeichnungen",  post(create_auszeichnung))
        .route("/auszeichnungen/:id",             delete(delete_auszeichnung))
        .route_layer(middleware::from_fn_with_state(state.clone(), require_auth));

    Router::new()
        .route("/briefkopf",              get(get_briefkopf))
        .route("/logo",                   get(get_logo))
        .route("/vorstand",               get(list_vorstand))
        .route("/posts",                  get(list_posts))
        .route("/dokumente",              get(list_documents))
        .route("/dokumente/:id/download", get(download_document))
        .route("/mitglieder",             get(list_mitglieder))
        .route("/mitglieder/:id/qualifikationen", get(list_qualifikationen))
        .route("/mitglieder/:id/auszeichnungen",  get(list_auszeichnungen))
        .route("/ehrungen",               get(get_ehrungen))
        .merge(protected)
        .route_layer(middleware::from_fn_with_state(state, require_auth))
}
