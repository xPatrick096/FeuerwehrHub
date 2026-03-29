use axum::{
    extract::{Path, State},
    middleware,
    response::IntoResponse,
    routing::{delete, get, post, put},
    Extension, Json, Router,
};
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    auth::middleware::{require_auth, require_module, Claims},
    errors::{AppError, AppResult},
    AppState,
};

// ── Structs ───────────────────────────────────────────────────────────────────

#[derive(Serialize, sqlx::FromRow)]
pub struct MemberSummary {
    pub id:               Uuid,
    pub username:         String,
    pub display_name:     Option<String>,
    pub role:             String,
    pub personnel_number: Option<String>,
    pub entry_date:       Option<NaiveDate>,
    pub exit_date:        Option<NaiveDate>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct MemberDetails {
    pub id:                      Uuid,
    pub user_id:                 Uuid,
    pub date_of_birth:           Option<NaiveDate>,
    pub entry_date:              Option<NaiveDate>,
    pub exit_date:               Option<NaiveDate>,
    pub personnel_number:        Option<String>,
    pub notes:                   Option<String>,
    pub updated_at:              DateTime<Utc>,
    // Kontaktdaten aus member_profiles (selbst gepflegt)
    pub phone:                   Option<String>,
    pub email_private:           Option<String>,
    pub address:                 Option<String>,
    pub emergency_contact_name:  Option<String>,
    pub emergency_contact_phone: Option<String>,
    pub updated_by_id:           Option<Uuid>,
    pub updated_by_name:         Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateProfileBody {
    pub phone:         Option<String>,
    pub email_private: Option<String>,
    pub address:       Option<String>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct EmergencyContact {
    pub id:           Uuid,
    pub user_id:      Uuid,
    pub name:         String,
    pub phone:        String,
    pub relationship: Option<String>,
    pub sort_order:   i32,
    pub created_at:   DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct UpdateDetailsBody {
    pub date_of_birth:    Option<NaiveDate>,
    pub entry_date:       Option<NaiveDate>,
    pub exit_date:        Option<NaiveDate>,
    pub personnel_number: Option<String>,
    pub notes:            Option<String>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct Qualification {
    pub id:          Uuid,
    pub user_id:     Uuid,
    pub name:        String,
    pub acquired_at: Option<NaiveDate>,
    pub expires_at:  Option<NaiveDate>,
    pub notes:       Option<String>,
    pub created_at:  DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct QualificationBody {
    pub name:        String,
    pub acquired_at: Option<NaiveDate>,
    pub expires_at:  Option<NaiveDate>,
    pub notes:       Option<String>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct Equipment {
    pub id:         Uuid,
    pub user_id:    Uuid,
    pub r#type:     String,
    pub identifier: Option<String>,
    pub issued_at:  Option<NaiveDate>,
    pub expires_at: Option<NaiveDate>,
    pub notes:      Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct EquipmentBody {
    pub r#type:     String,
    pub identifier: Option<String>,
    pub issued_at:  Option<NaiveDate>,
    pub expires_at: Option<NaiveDate>,
    pub notes:      Option<String>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct Honor {
    pub id:         Uuid,
    pub user_id:    Uuid,
    pub name:       String,
    pub awarded_at: Option<NaiveDate>,
    pub notes:      Option<String>,
    pub status:     String,
    pub created_at: DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct HonorBody {
    pub name:       String,
    pub awarded_at: Option<NaiveDate>,
    pub notes:      Option<String>,
    pub status:     Option<String>,
}

// ── Mitgliederliste ───────────────────────────────────────────────────────────

pub async fn list_members(
    State(state): State<AppState>,
) -> AppResult<Json<Vec<MemberSummary>>> {
    let members = sqlx::query_as::<_, MemberSummary>(
        "SELECT u.id, u.username, u.display_name, u.role,
                d.personnel_number, d.entry_date, d.exit_date
         FROM users u
         LEFT JOIN member_details d ON d.user_id = u.id
         ORDER BY u.display_name ASC, u.username ASC"
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(members))
}

// ── Stammdaten lesen/bearbeiten ───────────────────────────────────────────────

pub async fn get_details(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
) -> AppResult<Json<MemberDetails>> {
    let details = sqlx::query_as::<_, MemberDetails>(
        "SELECT d.id, d.user_id, d.date_of_birth, d.entry_date, d.exit_date,
                d.personnel_number, d.notes, d.updated_at,
                p.phone, p.email_private, p.address,
                p.emergency_contact_name, p.emergency_contact_phone,
                p.updated_by_id, p.updated_by_name
         FROM member_details d
         LEFT JOIN member_profiles p ON p.user_id = d.user_id
         WHERE d.user_id = $1"
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?;

    if let Some(d) = details {
        return Ok(Json(d));
    }

    // Noch nicht vorhanden → anlegen
    let new = sqlx::query_as::<_, MemberDetails>(
        "WITH ins AS (
             INSERT INTO member_details (user_id)
             VALUES ($1)
             ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
             RETURNING id, user_id, date_of_birth, entry_date, exit_date,
                       personnel_number, notes, updated_at
         )
         SELECT ins.id, ins.user_id, ins.date_of_birth, ins.entry_date, ins.exit_date,
                ins.personnel_number, ins.notes, ins.updated_at,
                p.phone, p.email_private, p.address,
                p.emergency_contact_name, p.emergency_contact_phone,
                p.updated_by_id, p.updated_by_name
         FROM ins
         LEFT JOIN member_profiles p ON p.user_id = ins.user_id"
    )
    .bind(user_id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(new))
}

pub async fn update_details(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
    Json(body): Json<UpdateDetailsBody>,
) -> AppResult<Json<MemberDetails>> {
    let details = sqlx::query_as::<_, MemberDetails>(
        "WITH upd AS (
             INSERT INTO member_details (user_id, date_of_birth, entry_date, exit_date, personnel_number, notes)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (user_id) DO UPDATE SET
                 date_of_birth    = EXCLUDED.date_of_birth,
                 entry_date       = EXCLUDED.entry_date,
                 exit_date        = EXCLUDED.exit_date,
                 personnel_number = EXCLUDED.personnel_number,
                 notes            = EXCLUDED.notes,
                 updated_at       = NOW()
             RETURNING id, user_id, date_of_birth, entry_date, exit_date,
                       personnel_number, notes, updated_at
         )
         SELECT upd.id, upd.user_id, upd.date_of_birth, upd.entry_date, upd.exit_date,
                upd.personnel_number, upd.notes, upd.updated_at,
                p.phone, p.email_private, p.address,
                p.emergency_contact_name, p.emergency_contact_phone,
                p.updated_by_id, p.updated_by_name
         FROM upd
         LEFT JOIN member_profiles p ON p.user_id = upd.user_id"
    )
    .bind(user_id)
    .bind(body.date_of_birth)
    .bind(body.entry_date)
    .bind(body.exit_date)
    .bind(body.personnel_number.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .bind(body.notes.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .fetch_one(&state.db)
    .await?;

    Ok(Json(details))
}

// ── Qualifikationen ───────────────────────────────────────────────────────────

pub async fn list_qualifications(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
) -> AppResult<Json<Vec<Qualification>>> {
    let qualifications = sqlx::query_as::<_, Qualification>(
        "SELECT id, user_id, name, acquired_at, expires_at, notes, created_at
         FROM qualifications WHERE user_id = $1
         ORDER BY expires_at ASC NULLS LAST, name ASC"
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(qualifications))
}

pub async fn create_qualification(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
    Json(body): Json<QualificationBody>,
) -> AppResult<Json<Qualification>> {
    let name = body.name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::BadRequest("Name darf nicht leer sein".into()));
    }

    let q = sqlx::query_as::<_, Qualification>(
        "INSERT INTO qualifications (user_id, name, acquired_at, expires_at, notes)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, user_id, name, acquired_at, expires_at, notes, created_at"
    )
    .bind(user_id)
    .bind(&name)
    .bind(body.acquired_at)
    .bind(body.expires_at)
    .bind(body.notes.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .fetch_one(&state.db)
    .await?;

    Ok(Json(q))
}

pub async fn update_qualification(
    State(state): State<AppState>,
    Path((user_id, qual_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<QualificationBody>,
) -> AppResult<Json<Qualification>> {
    let name = body.name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::BadRequest("Name darf nicht leer sein".into()));
    }

    let q = sqlx::query_as::<_, Qualification>(
        "UPDATE qualifications SET name = $1, acquired_at = $2, expires_at = $3, notes = $4
         WHERE id = $5 AND user_id = $6
         RETURNING id, user_id, name, acquired_at, expires_at, notes, created_at"
    )
    .bind(&name)
    .bind(body.acquired_at)
    .bind(body.expires_at)
    .bind(body.notes.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .bind(qual_id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(q))
}

pub async fn delete_qualification(
    State(state): State<AppState>,
    Path((user_id, qual_id)): Path<(Uuid, Uuid)>,
) -> AppResult<Json<serde_json::Value>> {
    let result = sqlx::query(
        "DELETE FROM qualifications WHERE id = $1 AND user_id = $2"
    )
    .bind(qual_id)
    .bind(user_id)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(Json(serde_json::json!({ "message": "Qualifikation gelöscht" })))
}

// ── Ausrüstung ────────────────────────────────────────────────────────────────

pub async fn list_equipment(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
) -> AppResult<Json<Vec<Equipment>>> {
    let equipment = sqlx::query_as::<_, Equipment>(
        "SELECT id, user_id, type, identifier, issued_at, expires_at, notes, created_at
         FROM member_equipment WHERE user_id = $1
         ORDER BY type ASC, created_at ASC"
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(equipment))
}

pub async fn create_equipment(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
    Json(body): Json<EquipmentBody>,
) -> AppResult<Json<Equipment>> {
    let eq_type = body.r#type.trim().to_string();
    if eq_type.is_empty() {
        return Err(AppError::BadRequest("Typ darf nicht leer sein".into()));
    }

    let e = sqlx::query_as::<_, Equipment>(
        "INSERT INTO member_equipment (user_id, type, identifier, issued_at, expires_at, notes)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, user_id, type, identifier, issued_at, expires_at, notes, created_at"
    )
    .bind(user_id)
    .bind(&eq_type)
    .bind(body.identifier.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .bind(body.issued_at)
    .bind(body.expires_at)
    .bind(body.notes.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .fetch_one(&state.db)
    .await?;

    Ok(Json(e))
}

pub async fn update_equipment(
    State(state): State<AppState>,
    Path((user_id, eq_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<EquipmentBody>,
) -> AppResult<Json<Equipment>> {
    let eq_type = body.r#type.trim().to_string();
    if eq_type.is_empty() {
        return Err(AppError::BadRequest("Typ darf nicht leer sein".into()));
    }

    let e = sqlx::query_as::<_, Equipment>(
        "UPDATE member_equipment
         SET type = $1, identifier = $2, issued_at = $3, expires_at = $4, notes = $5
         WHERE id = $6 AND user_id = $7
         RETURNING id, user_id, type, identifier, issued_at, expires_at, notes, created_at"
    )
    .bind(&eq_type)
    .bind(body.identifier.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .bind(body.issued_at)
    .bind(body.expires_at)
    .bind(body.notes.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .bind(eq_id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(e))
}

pub async fn delete_equipment(
    State(state): State<AppState>,
    Path((user_id, eq_id)): Path<(Uuid, Uuid)>,
) -> AppResult<Json<serde_json::Value>> {
    let result = sqlx::query(
        "DELETE FROM member_equipment WHERE id = $1 AND user_id = $2"
    )
    .bind(eq_id)
    .bind(user_id)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(Json(serde_json::json!({ "message": "Ausrüstung gelöscht" })))
}

// ── Ehrungen ──────────────────────────────────────────────────────────────────

pub async fn list_honors(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
) -> AppResult<Json<Vec<Honor>>> {
    let honors = sqlx::query_as::<_, Honor>(
        "SELECT id, user_id, name, awarded_at, notes, status, created_at
         FROM honors WHERE user_id = $1
         ORDER BY awarded_at DESC NULLS LAST"
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(honors))
}

pub async fn create_honor(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
    Json(body): Json<HonorBody>,
) -> AppResult<Json<Honor>> {
    let name = body.name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::BadRequest("Name darf nicht leer sein".into()));
    }

    let h = sqlx::query_as::<_, Honor>(
        "INSERT INTO honors (user_id, name, awarded_at, notes)
         VALUES ($1, $2, $3, $4)
         RETURNING id, user_id, name, awarded_at, notes, status, created_at"
    )
    .bind(user_id)
    .bind(&name)
    .bind(body.awarded_at)
    .bind(body.notes.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .fetch_one(&state.db)
    .await?;

    Ok(Json(h))
}

pub async fn update_honor(
    State(state): State<AppState>,
    Path((user_id, honor_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<HonorBody>,
) -> AppResult<Json<Honor>> {
    let name = body.name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::BadRequest("Name darf nicht leer sein".into()));
    }

    let h = sqlx::query_as::<_, Honor>(
        "UPDATE honors SET name = $1, awarded_at = $2, notes = $3,
             status = COALESCE($4, status)
         WHERE id = $5 AND user_id = $6
         RETURNING id, user_id, name, awarded_at, notes, status, created_at"
    )
    .bind(&name)
    .bind(body.awarded_at)
    .bind(body.notes.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .bind(body.status.as_deref())
    .bind(honor_id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(h))
}

pub async fn delete_honor(
    State(state): State<AppState>,
    Path((user_id, honor_id)): Path<(Uuid, Uuid)>,
) -> AppResult<Json<serde_json::Value>> {
    let result = sqlx::query(
        "DELETE FROM honors WHERE id = $1 AND user_id = $2"
    )
    .bind(honor_id)
    .bind(user_id)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(Json(serde_json::json!({ "message": "Ehrung gelöscht" })))
}

// ── Anwesenheit ───────────────────────────────────────────────────────────────

#[derive(Serialize, sqlx::FromRow)]
pub struct AttendanceEntry {
    pub id:           Uuid,
    pub user_id:      Uuid,
    pub service_date: NaiveDate,
    pub status:       String,
    pub notes:        Option<String>,
    pub created_by_id: Option<Uuid>,
    pub created_at:   DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct AttendanceBody {
    pub service_date: NaiveDate,
    pub status:       String,
    pub notes:        Option<String>,
}

#[derive(Serialize)]
pub struct AttendanceStats {
    pub total:   i64,
    pub present: i64,
    pub absent:  i64,
    pub excused: i64,
}

pub async fn list_attendance(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
) -> AppResult<Json<Vec<AttendanceEntry>>> {
    let entries = sqlx::query_as::<_, AttendanceEntry>(
        "SELECT id, user_id, service_date, status, notes, created_by_id, created_at
         FROM service_attendance WHERE user_id = $1
         ORDER BY service_date DESC"
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(entries))
}

pub async fn create_attendance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(user_id): Path<Uuid>,
    Json(body): Json<AttendanceBody>,
) -> AppResult<Json<AttendanceEntry>> {
    let allowed = ["present", "absent", "excused"];
    if !allowed.contains(&body.status.as_str()) {
        return Err(AppError::BadRequest("Ungültiger Status".into()));
    }

    let entry = sqlx::query_as::<_, AttendanceEntry>(
        "INSERT INTO service_attendance (user_id, service_date, status, notes, created_by_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, user_id, service_date, status, notes, created_by_id, created_at"
    )
    .bind(user_id)
    .bind(body.service_date)
    .bind(&body.status)
    .bind(body.notes.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .bind(claims.sub)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(entry))
}

pub async fn update_attendance(
    State(state): State<AppState>,
    Path((user_id, entry_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<AttendanceBody>,
) -> AppResult<Json<AttendanceEntry>> {
    let allowed = ["present", "absent", "excused"];
    if !allowed.contains(&body.status.as_str()) {
        return Err(AppError::BadRequest("Ungültiger Status".into()));
    }

    let entry = sqlx::query_as::<_, AttendanceEntry>(
        "UPDATE service_attendance
         SET service_date = $1, status = $2, notes = $3
         WHERE id = $4 AND user_id = $5
         RETURNING id, user_id, service_date, status, notes, created_by_id, created_at"
    )
    .bind(body.service_date)
    .bind(&body.status)
    .bind(body.notes.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .bind(entry_id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(entry))
}

pub async fn delete_attendance(
    State(state): State<AppState>,
    Path((user_id, entry_id)): Path<(Uuid, Uuid)>,
) -> AppResult<Json<serde_json::Value>> {
    let result = sqlx::query(
        "DELETE FROM service_attendance WHERE id = $1 AND user_id = $2"
    )
    .bind(entry_id)
    .bind(user_id)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(Json(serde_json::json!({ "message": "Eintrag gelöscht" })))
}

pub async fn get_attendance_stats(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
) -> AppResult<Json<AttendanceStats>> {
    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM service_attendance WHERE user_id = $1"
    )
    .bind(user_id)
    .fetch_one(&state.db)
    .await?;

    let present: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM service_attendance WHERE user_id = $1 AND status = 'present'"
    )
    .bind(user_id)
    .fetch_one(&state.db)
    .await?;

    let absent: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM service_attendance WHERE user_id = $1 AND status = 'absent'"
    )
    .bind(user_id)
    .fetch_one(&state.db)
    .await?;

    let excused: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM service_attendance WHERE user_id = $1 AND status = 'excused'"
    )
    .bind(user_id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(AttendanceStats { total, present, absent, excused }))
}

pub async fn export_attendance_csv(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let entries = sqlx::query_as::<_, AttendanceEntry>(
        "SELECT id, user_id, service_date, status, notes, created_by_id, created_at
         FROM service_attendance WHERE user_id = $1
         ORDER BY service_date ASC"
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await?;

    let mut csv = String::from("Datum,Status,Notizen\n");
    for e in &entries {
        let status_label = match e.status.as_str() {
            "present" => "Anwesend",
            "absent"  => "Abwesend",
            "excused" => "Entschuldigt",
            _         => &e.status,
        };
        let notes = e.notes.as_deref().unwrap_or("").replace('"', "\"\"");
        csv.push_str(&format!("{},{},\"{}\"\n", e.service_date, status_label, notes));
    }

    Ok((
        [
            ("Content-Type", "text/csv; charset=utf-8"),
            ("Content-Disposition", "attachment; filename=\"anwesenheit.csv\""),
        ],
        csv,
    ))
}

// ── Personal Stats ────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct PersonalStats {
    pub total_members:              i64,
    pub active_members:             i64,
    pub qualifications_expiring_30: i64,
    pub qualifications_expiring_90: i64,
    pub g263_expiring_90:           i64,
}

pub async fn get_personal_stats(
    State(state): State<AppState>,
) -> AppResult<Json<PersonalStats>> {
    let total_members: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM users WHERE role != 'superuser'"
    )
    .fetch_one(&state.db)
    .await?;

    let active_members: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM users u \
         LEFT JOIN member_details md ON md.user_id = u.id \
         WHERE u.role != 'superuser' \
           AND (md.exit_date IS NULL OR md.exit_date >= CURRENT_DATE)"
    )
    .fetch_one(&state.db)
    .await?;

    let qualifications_expiring_30: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM qualifications q \
         JOIN users u ON u.id = q.user_id \
         LEFT JOIN member_details md ON md.user_id = u.id \
         WHERE q.expires_at BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days' \
           AND u.role != 'superuser' \
           AND (md.exit_date IS NULL OR md.exit_date >= CURRENT_DATE)"
    )
    .fetch_one(&state.db)
    .await?;

    let qualifications_expiring_90: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM qualifications q \
         JOIN users u ON u.id = q.user_id \
         LEFT JOIN member_details md ON md.user_id = u.id \
         WHERE q.expires_at BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days' \
           AND u.role != 'superuser' \
           AND (md.exit_date IS NULL OR md.exit_date >= CURRENT_DATE)"
    )
    .fetch_one(&state.db)
    .await?;

    let g263_expiring_90: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM qualifications q \
         JOIN users u ON u.id = q.user_id \
         LEFT JOIN member_details md ON md.user_id = u.id \
         WHERE q.expires_at BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days' \
           AND q.name ILIKE '%G26%' \
           AND u.role != 'superuser' \
           AND (md.exit_date IS NULL OR md.exit_date >= CURRENT_DATE)"
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(PersonalStats {
        total_members,
        active_members,
        qualifications_expiring_30,
        qualifications_expiring_90,
        g263_expiring_90,
    }))
}

// ── Kontaktdaten bearbeiten (Wehrleiter) ──────────────────────────────────────

pub async fn update_member_profile(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(user_id): Path<Uuid>,
    Json(body): Json<UpdateProfileBody>,
) -> AppResult<Json<serde_json::Value>> {
    // Aktuellen Admin-Namen ermitteln
    let editor_name: Option<String> = sqlx::query_scalar(
        "SELECT COALESCE(display_name, username) FROM users WHERE id = $1"
    )
    .bind(claims.sub)
    .fetch_optional(&state.db)
    .await?;

    sqlx::query(
        "INSERT INTO member_profiles (user_id, phone, email_private, address,
             updated_by_id, updated_by_name)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id) DO UPDATE SET
             phone           = EXCLUDED.phone,
             email_private   = EXCLUDED.email_private,
             address         = EXCLUDED.address,
             updated_at      = NOW(),
             updated_by_id   = EXCLUDED.updated_by_id,
             updated_by_name = EXCLUDED.updated_by_name"
    )
    .bind(user_id)
    .bind(body.phone.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .bind(body.email_private.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .bind(body.address.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .bind(claims.sub)
    .bind(editor_name.as_deref())
    .execute(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "message": "Kontaktdaten gespeichert" })))
}

// ── Notfallkontakte lesen (Wehrleiter) ────────────────────────────────────────

pub async fn list_member_emergency_contacts(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
) -> AppResult<Json<Vec<EmergencyContact>>> {
    let contacts = sqlx::query_as::<_, EmergencyContact>(
        "SELECT id, user_id, name, phone, relationship, sort_order, created_at
         FROM emergency_contacts
         WHERE user_id = $1
         ORDER BY sort_order ASC, created_at ASC"
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(contacts))
}

// ── Router ────────────────────────────────────────────────────────────────────

pub fn router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/stats",                                        get(get_personal_stats))
        .route("/members",                                      get(list_members))
        .route("/members/:id/details",                          get(get_details).put(update_details))
        .route("/members/:id/qualifications",                   get(list_qualifications).post(create_qualification))
        .route("/members/:id/qualifications/:qid",              put(update_qualification).delete(delete_qualification))
        .route("/members/:id/equipment",                        get(list_equipment).post(create_equipment))
        .route("/members/:id/equipment/:eid",                   put(update_equipment).delete(delete_equipment))
        .route("/members/:id/honors",                           get(list_honors).post(create_honor))
        .route("/members/:id/honors/:hid",                      put(update_honor).delete(delete_honor))
        .route("/members/:id/attendance",                       get(list_attendance).post(create_attendance))
        .route("/members/:id/attendance/:aid",                  put(update_attendance).delete(delete_attendance))
        .route("/members/:id/attendance/stats",                 get(get_attendance_stats))
        .route("/members/:id/attendance/export",                get(export_attendance_csv))
        .route("/members/:id/profile",                          put(update_member_profile))
        .route("/members/:id/emergency-contacts",               get(list_member_emergency_contacts))
        .route_layer(middleware::from_fn_with_state(state.clone(), require_module("personal")))
        .route_layer(middleware::from_fn_with_state(state, require_auth))
}
