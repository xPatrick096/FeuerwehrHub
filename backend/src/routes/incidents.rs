use axum::{
    body::Body,
    extract::{Multipart, Path, Query, State},
    http::header,
    middleware,
    response::Response,
    routing::{delete, get, post, put},
    Extension, Json, Router,
};
use chrono::{Datelike, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    audit,
    auth::middleware::{require_auth, require_module, Claims},
    errors::{AppError, AppResult},
    AppState,
};

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

/// Prüft ob der User die Permission `einsatzberichte.approve` hat (direkt oder via Funktion).
async fn has_approve_perm(db: &PgPool, user_id: Uuid) -> bool {
    sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (
            SELECT 1 FROM (
                SELECT unnest(COALESCE(u.permissions, '{}') || COALESCE(r.permissions, '{}')) AS perm
                FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = $1
                UNION ALL
                SELECT unnest(fr.permissions)
                FROM user_functions uf JOIN roles fr ON fr.id = uf.role_id WHERE uf.user_id = $1
            ) t
            WHERE t.perm = 'einsatzberichte.approve'
         )"
    )
    .bind(user_id)
    .fetch_one(db)
    .await
    .unwrap_or(false)
}

async fn next_incident_number(db: &PgPool, year: i32) -> AppResult<String> {
    let max_seq: Option<i32> = sqlx::query_scalar(
        "SELECT MAX(CAST(SPLIT_PART(incident_number, '-', 2) AS INTEGER))
         FROM incident_reports
         WHERE incident_number LIKE $1"
    )
    .bind(format!("{}-", year) + "%")
    .fetch_one(db)
    .await?;
    Ok(format!("{}-{:03}", year, max_seq.unwrap_or(0) + 1))
}

// ── Structs ───────────────────────────────────────────────────────────────────

#[derive(Serialize, sqlx::FromRow)]
pub struct IncidentSummary {
    pub id:                 Uuid,
    pub incident_number:    Option<String>,
    pub incident_date:      NaiveDate,
    pub incident_type_key:  String,
    pub incident_type_label:String,
    pub location:           String,
    pub incident_commander: Option<String>,
    pub status:             String,
    pub strength_leadership:i32,
    pub strength_sub:       i32,
    pub strength_crew:      i32,
    pub created_by_name:    Option<String>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct IncidentReport {
    pub id:                         Uuid,
    pub incident_number:            Option<String>,
    pub incident_date:              NaiveDate,
    pub alarm_time:                 Option<chrono::NaiveTime>,
    pub departure_time:             Option<chrono::NaiveTime>,
    pub arrival_time:               Option<chrono::NaiveTime>,
    pub end_time:                   Option<chrono::NaiveTime>,
    pub incident_type_key:          String,
    pub incident_type_label:        String,
    pub location:                   String,
    pub postal_code:                Option<String>,
    pub district:                   Option<String>,
    pub street:                     Option<String>,
    pub house_number:               Option<String>,
    pub extinguished_before_arrival:bool,
    pub malicious_alarm:            bool,
    pub false_alarm:                bool,
    pub supraregional:              bool,
    pub bf_involved:                bool,
    pub violence_against_crew:      bool,
    pub violence_count:             i32,
    pub incident_commander:         Option<String>,
    pub reporter_name:              Option<String>,
    pub reporter_phone:             Option<String>,
    pub strength_leadership:        i32,
    pub strength_sub:               i32,
    pub strength_crew:              i32,
    pub fire_object:                Option<String>,
    pub situation:                  Option<String>,
    pub measures:                   Option<String>,
    pub notes:                      Option<String>,
    pub thl_type:                   Option<String>,
    pub weather_influence:          Option<String>,
    pub handover_to:                Option<String>,
    pub handover_notes:             Option<String>,
    pub police_case_number:         Option<String>,
    pub police_station:             Option<String>,
    pub police_officer:             Option<String>,
    pub persons_rescued:            i32,
    pub persons_evacuated:          i32,
    pub persons_injured:            i32,
    pub persons_injured_own:        i32,
    pub persons_recovered:          i32,
    pub persons_dead:               i32,
    pub persons_dead_own:           i32,
    pub animals_rescued:            i32,
    pub animals_injured:            i32,
    pub animals_recovered:          i32,
    pub animals_dead:               i32,
    pub vehicle_damage:             Option<String>,
    pub equipment_damage:           Option<String>,
    pub resources:                  JsonValue,
    pub status:                     String,
    pub created_by:                 Option<Uuid>,
    pub created_by_name:            Option<String>,
    pub released_by:                Option<Uuid>,
    pub released_at:                Option<chrono::DateTime<Utc>>,
    pub created_at:                 chrono::DateTime<Utc>,
    pub updated_at:                 chrono::DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct IncidentBody {
    pub incident_date:              String,
    pub alarm_time:                 Option<String>,
    pub departure_time:             Option<String>,
    pub arrival_time:               Option<String>,
    pub end_time:                   Option<String>,
    pub incident_type_key:          Option<String>,
    pub incident_type_label:        Option<String>,
    pub location:                   String,
    pub postal_code:                Option<String>,
    pub district:                   Option<String>,
    pub street:                     Option<String>,
    pub house_number:               Option<String>,
    pub extinguished_before_arrival:Option<bool>,
    pub malicious_alarm:            Option<bool>,
    pub false_alarm:                Option<bool>,
    pub supraregional:              Option<bool>,
    pub bf_involved:                Option<bool>,
    pub violence_against_crew:      Option<bool>,
    pub violence_count:             Option<i32>,
    pub incident_commander:         Option<String>,
    pub reporter_name:              Option<String>,
    pub reporter_phone:             Option<String>,
    pub strength_leadership:        Option<i32>,
    pub strength_sub:               Option<i32>,
    pub strength_crew:              Option<i32>,
    pub fire_object:                Option<String>,
    pub situation:                  Option<String>,
    pub measures:                   Option<String>,
    pub notes:                      Option<String>,
    pub thl_type:                   Option<String>,
    pub weather_influence:          Option<String>,
    pub handover_to:                Option<String>,
    pub handover_notes:             Option<String>,
    pub police_case_number:         Option<String>,
    pub police_station:             Option<String>,
    pub police_officer:             Option<String>,
    pub persons_rescued:            Option<i32>,
    pub persons_evacuated:          Option<i32>,
    pub persons_injured:            Option<i32>,
    pub persons_injured_own:        Option<i32>,
    pub persons_recovered:          Option<i32>,
    pub persons_dead:               Option<i32>,
    pub persons_dead_own:           Option<i32>,
    pub animals_rescued:            Option<i32>,
    pub animals_injured:            Option<i32>,
    pub animals_recovered:          Option<i32>,
    pub animals_dead:               Option<i32>,
    pub vehicle_damage:             Option<String>,
    pub equipment_damage:           Option<String>,
    pub resources:                  Option<JsonValue>,
    pub incident_number:            Option<String>,
    pub comment:                    Option<String>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct IncidentChange {
    pub id:               Uuid,
    pub incident_id:      Uuid,
    pub changed_by:       Option<Uuid>,
    pub changed_by_name:  Option<String>,
    pub comment:          Option<String>,
    pub created_at:       chrono::DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct ListQuery {
    pub year:   Option<i32>,
    pub type_key: Option<String>,
    pub status: Option<String>,
    pub page:   Option<i64>,
    pub per_page: Option<i64>,
}

#[derive(Serialize)]
pub struct ListResponse {
    pub items: Vec<IncidentSummary>,
    pub total: i64,
    pub page:  i64,
    pub per_page: i64,
}

#[derive(Deserialize)]
pub struct StatusBody {
    pub status: String,
}

#[derive(Serialize)]
pub struct StatsResponse {
    pub year:        i32,
    pub total:       i64,
    pub brand:       i64,
    pub thl:         i64,
    pub fehlalarm:   i64,
    pub sonstiges:   i64,
    pub entwurf:     i64,
}

// ── Liste ─────────────────────────────────────────────────────────────────────

pub async fn list_incidents(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListQuery>,
) -> AppResult<Json<ListResponse>> {
    let page     = q.page.unwrap_or(1).max(1);
    let per_page = q.per_page.unwrap_or(25).clamp(1, 100);
    let offset   = (page - 1) * per_page;
    let year     = q.year.unwrap_or_else(|| Utc::now().year());

    let is_elevated = claims.is_admin_or_above()
        || has_approve_perm(&state.db, claims.sub).await;

    // Filter: erhöhte Rechte → alle; sonst eigene Entwürfe + alle nicht-Entwürfe
    let (where_access, user_id_param) = if is_elevated {
        ("TRUE".to_string(), None)
    } else {
        ("(ir.status != 'entwurf' OR ir.created_by = $5)".to_string(), Some(claims.sub))
    };

    let type_filter  = q.type_key.as_deref().unwrap_or("");
    let status_filter= q.status.as_deref().unwrap_or("");

    let count_sql = format!(
        "SELECT COUNT(*) FROM incident_reports ir
         WHERE EXTRACT(YEAR FROM ir.incident_date) = $1
           AND ($2 = '' OR ir.incident_type_key = $2)
           AND ($3 = '' OR ir.status = $3)
           AND {}",
        where_access
    );

    let total: i64 = if let Some(uid) = user_id_param {
        sqlx::query_scalar(&count_sql)
            .bind(year).bind(type_filter).bind(status_filter).bind(0i64).bind(uid)
            .fetch_one(&state.db).await?
    } else {
        sqlx::query_scalar(&count_sql)
            .bind(year).bind(type_filter).bind(status_filter).bind(0i64)
            .fetch_one(&state.db).await?
    };

    let list_sql = format!(
        "SELECT id, incident_number, incident_date, incident_type_key, incident_type_label,
                location, incident_commander, status,
                strength_leadership, strength_sub, strength_crew, created_by_name
         FROM incident_reports ir
         WHERE EXTRACT(YEAR FROM ir.incident_date) = $1
           AND ($2 = '' OR ir.incident_type_key = $2)
           AND ($3 = '' OR ir.status = $3)
           AND {}
         ORDER BY ir.incident_date DESC, ir.created_at DESC
         LIMIT $4 OFFSET {}",
        where_access, offset
    );

    let items: Vec<IncidentSummary> = if let Some(uid) = user_id_param {
        sqlx::query_as(&list_sql)
            .bind(year).bind(type_filter).bind(status_filter).bind(per_page).bind(uid)
            .fetch_all(&state.db).await?
    } else {
        sqlx::query_as(&list_sql)
            .bind(year).bind(type_filter).bind(status_filter).bind(per_page)
            .fetch_all(&state.db).await?
    };

    Ok(Json(ListResponse { items, total, page, per_page }))
}

// ── Erstellen ─────────────────────────────────────────────────────────────────

pub async fn create_incident(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<IncidentBody>,
) -> AppResult<Json<IncidentReport>> {
    let date = NaiveDate::parse_from_str(&body.incident_date, "%Y-%m-%d")
        .map_err(|_| AppError::BadRequest("Ungültiges Datum (erwartet: YYYY-MM-DD)".into()))?;

    if body.location.trim().is_empty() {
        return Err(AppError::BadRequest("Einsatzort ist Pflichtfeld".into()));
    }

    let type_key   = body.incident_type_key.as_deref().unwrap_or("sonstiges");
    let type_label = if let Some(ref lbl) = body.incident_type_label {
        lbl.clone()
    } else {
        // Snapshot aus DB holen
        sqlx::query_scalar::<_, Option<String>>(
            "SELECT label FROM incident_types WHERE key = $1"
        )
        .bind(type_key)
        .fetch_one(&state.db)
        .await?
        .unwrap_or_else(|| "Sonstiges".to_string())
    };

    let incident_number = match body.incident_number.as_deref() {
        Some(n) if !n.is_empty() => n.to_string(),
        _ => next_incident_number(&state.db, date.year()).await?,
    };

    let display_name = claims.username.clone();

    let report = sqlx::query_as::<_, IncidentReport>(
        "INSERT INTO incident_reports (
            incident_number, incident_date, alarm_time, departure_time, arrival_time, end_time,
            incident_type_key, incident_type_label, location, postal_code, district, street, house_number,
            extinguished_before_arrival, malicious_alarm, false_alarm, supraregional,
            bf_involved, violence_against_crew, violence_count,
            incident_commander, reporter_name, reporter_phone,
            strength_leadership, strength_sub, strength_crew,
            fire_object, situation, measures, notes, thl_type, weather_influence,
            handover_to, handover_notes, police_case_number, police_station, police_officer,
            persons_rescued, persons_evacuated, persons_injured, persons_injured_own,
            persons_recovered, persons_dead, persons_dead_own,
            animals_rescued, animals_injured, animals_recovered, animals_dead,
            vehicle_damage, equipment_damage, resources,
            status, created_by, created_by_name
        ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
            $14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,
            $27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,
            $38,$39,$40,$41,$42,$43,$44,$45,$46,$47,$48,
            $49,$50,$51,'entwurf',$52,$53
        )
        RETURNING *"
    )
    .bind(&incident_number)
    .bind(date)
    .bind(parse_time(body.alarm_time.as_deref()))
    .bind(parse_time(body.departure_time.as_deref()))
    .bind(parse_time(body.arrival_time.as_deref()))
    .bind(parse_time(body.end_time.as_deref()))
    .bind(type_key)
    .bind(&type_label)
    .bind(body.location.trim())
    .bind(body.postal_code.as_deref())
    .bind(body.district.as_deref())
    .bind(body.street.as_deref())
    .bind(body.house_number.as_deref())
    .bind(body.extinguished_before_arrival.unwrap_or(false))
    .bind(body.malicious_alarm.unwrap_or(false))
    .bind(body.false_alarm.unwrap_or(false))
    .bind(body.supraregional.unwrap_or(false))
    .bind(body.bf_involved.unwrap_or(false))
    .bind(body.violence_against_crew.unwrap_or(false))
    .bind(body.violence_count.unwrap_or(0))
    .bind(body.incident_commander.as_deref())
    .bind(body.reporter_name.as_deref())
    .bind(body.reporter_phone.as_deref())
    .bind(body.strength_leadership.unwrap_or(0))
    .bind(body.strength_sub.unwrap_or(0))
    .bind(body.strength_crew.unwrap_or(0))
    .bind(body.fire_object.as_deref())
    .bind(body.situation.as_deref())
    .bind(body.measures.as_deref())
    .bind(body.notes.as_deref())
    .bind(body.thl_type.as_deref())
    .bind(body.weather_influence.as_deref())
    .bind(body.handover_to.as_deref())
    .bind(body.handover_notes.as_deref())
    .bind(body.police_case_number.as_deref())
    .bind(body.police_station.as_deref())
    .bind(body.police_officer.as_deref())
    .bind(body.persons_rescued.unwrap_or(0))
    .bind(body.persons_evacuated.unwrap_or(0))
    .bind(body.persons_injured.unwrap_or(0))
    .bind(body.persons_injured_own.unwrap_or(0))
    .bind(body.persons_recovered.unwrap_or(0))
    .bind(body.persons_dead.unwrap_or(0))
    .bind(body.persons_dead_own.unwrap_or(0))
    .bind(body.animals_rescued.unwrap_or(0))
    .bind(body.animals_injured.unwrap_or(0))
    .bind(body.animals_recovered.unwrap_or(0))
    .bind(body.animals_dead.unwrap_or(0))
    .bind(body.vehicle_damage.as_deref())
    .bind(body.equipment_damage.as_deref())
    .bind(body.resources.unwrap_or(JsonValue::Object(Default::default())))
    .bind(claims.sub)
    .bind(&display_name)
    .fetch_one(&state.db)
    .await?;

    audit::log(&state.db, Some(claims.sub), &claims.username,
        "INCIDENT_CREATED", Some("incident_reports"), Some(report.id), None).await;

    Ok(Json(report))
}

// ── Detail ────────────────────────────────────────────────────────────────────

pub async fn get_incident(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<IncidentReport>> {
    let report = sqlx::query_as::<_, IncidentReport>(
        "SELECT * FROM incident_reports WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    // Zugriffscheck: fremde Entwürfe nur mit approve-Permission sehbar
    if report.status == "entwurf" && !claims.is_admin_or_above() {
        if report.created_by != Some(claims.sub)
            && !has_approve_perm(&state.db, claims.sub).await
        {
            return Err(AppError::Forbidden);
        }
    }

    Ok(Json(report))
}

// ── Bearbeiten ────────────────────────────────────────────────────────────────

pub async fn update_incident(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<IncidentBody>,
) -> AppResult<Json<IncidentReport>> {
    let existing = sqlx::query_as::<_, IncidentReport>(
        "SELECT * FROM incident_reports WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    // Freigegeben / archiviert → nur Admin
    if existing.status != "entwurf" && !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }

    // Entwurf: eigener immer; fremder nur mit approve-Permission
    if existing.status == "entwurf" && !claims.is_admin_or_above() {
        if existing.created_by != Some(claims.sub)
            && !has_approve_perm(&state.db, claims.sub).await
        {
            return Err(AppError::Forbidden);
        }
    }

    let date = NaiveDate::parse_from_str(&body.incident_date, "%Y-%m-%d")
        .map_err(|_| AppError::BadRequest("Ungültiges Datum".into()))?;

    if body.location.trim().is_empty() {
        return Err(AppError::BadRequest("Einsatzort ist Pflichtfeld".into()));
    }

    let type_key   = body.incident_type_key.as_deref().unwrap_or("sonstiges");
    let type_label = if let Some(ref lbl) = body.incident_type_label {
        lbl.clone()
    } else {
        sqlx::query_scalar::<_, Option<String>>(
            "SELECT label FROM incident_types WHERE key = $1"
        )
        .bind(type_key)
        .fetch_one(&state.db)
        .await?
        .unwrap_or_else(|| "Sonstiges".to_string())
    };

    let report = sqlx::query_as::<_, IncidentReport>(
        "UPDATE incident_reports SET
            incident_date=$1, alarm_time=$2, departure_time=$3, arrival_time=$4, end_time=$5,
            incident_type_key=$6, incident_type_label=$7,
            location=$8, postal_code=$9, district=$10, street=$11, house_number=$12,
            extinguished_before_arrival=$13, malicious_alarm=$14, false_alarm=$15,
            supraregional=$16, bf_involved=$17, violence_against_crew=$18, violence_count=$19,
            incident_commander=$20, reporter_name=$21, reporter_phone=$22,
            strength_leadership=$23, strength_sub=$24, strength_crew=$25,
            fire_object=$26, situation=$27, measures=$28, notes=$29, thl_type=$30,
            weather_influence=$31, handover_to=$32, handover_notes=$33,
            police_case_number=$34, police_station=$35, police_officer=$36,
            persons_rescued=$37, persons_evacuated=$38, persons_injured=$39,
            persons_injured_own=$40, persons_recovered=$41, persons_dead=$42,
            persons_dead_own=$43, animals_rescued=$44, animals_injured=$45,
            animals_recovered=$46, animals_dead=$47, vehicle_damage=$48,
            equipment_damage=$49, resources=$50, updated_at=NOW()
         WHERE id=$51
         RETURNING *"
    )
    .bind(date)
    .bind(parse_time(body.alarm_time.as_deref()))
    .bind(parse_time(body.departure_time.as_deref()))
    .bind(parse_time(body.arrival_time.as_deref()))
    .bind(parse_time(body.end_time.as_deref()))
    .bind(type_key)
    .bind(&type_label)
    .bind(body.location.trim())
    .bind(body.postal_code.as_deref())
    .bind(body.district.as_deref())
    .bind(body.street.as_deref())
    .bind(body.house_number.as_deref())
    .bind(body.extinguished_before_arrival.unwrap_or(false))
    .bind(body.malicious_alarm.unwrap_or(false))
    .bind(body.false_alarm.unwrap_or(false))
    .bind(body.supraregional.unwrap_or(false))
    .bind(body.bf_involved.unwrap_or(false))
    .bind(body.violence_against_crew.unwrap_or(false))
    .bind(body.violence_count.unwrap_or(0))
    .bind(body.incident_commander.as_deref())
    .bind(body.reporter_name.as_deref())
    .bind(body.reporter_phone.as_deref())
    .bind(body.strength_leadership.unwrap_or(0))
    .bind(body.strength_sub.unwrap_or(0))
    .bind(body.strength_crew.unwrap_or(0))
    .bind(body.fire_object.as_deref())
    .bind(body.situation.as_deref())
    .bind(body.measures.as_deref())
    .bind(body.notes.as_deref())
    .bind(body.thl_type.as_deref())
    .bind(body.weather_influence.as_deref())
    .bind(body.handover_to.as_deref())
    .bind(body.handover_notes.as_deref())
    .bind(body.police_case_number.as_deref())
    .bind(body.police_station.as_deref())
    .bind(body.police_officer.as_deref())
    .bind(body.persons_rescued.unwrap_or(0))
    .bind(body.persons_evacuated.unwrap_or(0))
    .bind(body.persons_injured.unwrap_or(0))
    .bind(body.persons_injured_own.unwrap_or(0))
    .bind(body.persons_recovered.unwrap_or(0))
    .bind(body.persons_dead.unwrap_or(0))
    .bind(body.persons_dead_own.unwrap_or(0))
    .bind(body.animals_rescued.unwrap_or(0))
    .bind(body.animals_injured.unwrap_or(0))
    .bind(body.animals_recovered.unwrap_or(0))
    .bind(body.animals_dead.unwrap_or(0))
    .bind(body.vehicle_damage.as_deref())
    .bind(body.equipment_damage.as_deref())
    .bind(body.resources.unwrap_or(JsonValue::Object(Default::default())))
    .bind(id)
    .fetch_one(&state.db)
    .await?;

    // Änderungsprotokoll
    sqlx::query(
        "INSERT INTO incident_changes (incident_id, changed_by, changed_by_name, comment)
         VALUES ($1, $2, $3, $4)"
    )
    .bind(id)
    .bind(claims.sub)
    .bind(&claims.username)
    .bind(body.comment.as_deref())
    .execute(&state.db)
    .await
    .ok();

    audit::log(&state.db, Some(claims.sub), &claims.username,
        "INCIDENT_UPDATED", Some("incident_reports"), Some(id), None).await;

    Ok(Json(report))
}

// ── Löschen ───────────────────────────────────────────────────────────────────

pub async fn delete_incident(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let existing = sqlx::query_as::<_, IncidentReport>(
        "SELECT * FROM incident_reports WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    if !claims.is_admin_or_above() {
        let can_approve = has_approve_perm(&state.db, claims.sub).await;
        match existing.status.as_str() {
            "entwurf" => {
                let is_own = existing.created_by == Some(claims.sub);
                if !is_own && !can_approve {
                    return Err(AppError::Forbidden);
                }
            }
            "freigegeben" | "archiviert" => {
                if !can_approve {
                    return Err(AppError::Forbidden);
                }
            }
            _ => return Err(AppError::Forbidden),
        }
    }

    sqlx::query("DELETE FROM incident_reports WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;

    audit::log(&state.db, Some(claims.sub), &claims.username,
        "INCIDENT_DELETED", Some("incident_reports"), Some(id), None).await;

    Ok(Json(serde_json::json!({ "message": "Einsatzbericht gelöscht" })))
}

// ── Status-Übergang ───────────────────────────────────────────────────────────

pub async fn set_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<StatusBody>,
) -> AppResult<Json<IncidentReport>> {
    let existing = sqlx::query_as::<_, IncidentReport>(
        "SELECT * FROM incident_reports WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    // Middleware hat einsatzberichte.approve bereits geprüft — kein Level-Check nötig

    let new_status = body.status.as_str();
    let valid_transition = matches!(
        (existing.status.as_str(), new_status),
        ("entwurf", "freigegeben") | ("freigegeben", "archiviert")
    );

    if !valid_transition {
        return Err(AppError::BadRequest(format!(
            "Ungültiger Status-Übergang: {} → {}", existing.status, new_status
        )));
    }

    let report = sqlx::query_as::<_, IncidentReport>(
        "UPDATE incident_reports
         SET status=$1, released_by=$2, released_at=$3, updated_at=NOW()
         WHERE id=$4
         RETURNING *"
    )
    .bind(new_status)
    .bind(claims.sub)
    .bind(Utc::now())
    .bind(id)
    .fetch_one(&state.db)
    .await?;

    audit::log(&state.db, Some(claims.sub), &claims.username,
        "INCIDENT_STATUS_CHANGED", Some("incident_reports"), Some(id),
        Some(&serde_json::json!({"new_status": new_status}).to_string())).await;

    Ok(Json(report))
}

// ── Statistiken ───────────────────────────────────────────────────────────────

pub async fn get_stats(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Query(q): Query<ListQuery>,
) -> AppResult<Json<StatsResponse>> {
    let year = q.year.unwrap_or_else(|| Utc::now().year());

    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM incident_reports WHERE EXTRACT(YEAR FROM incident_date) = $1"
    ).bind(year).fetch_one(&state.db).await?;

    let brand: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM incident_reports ir
         LEFT JOIN incident_types it ON it.key = ir.incident_type_key
         WHERE EXTRACT(YEAR FROM ir.incident_date) = $1 AND it.category = 'brand'"
    ).bind(year).fetch_one(&state.db).await?;

    let thl: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM incident_reports ir
         LEFT JOIN incident_types it ON it.key = ir.incident_type_key
         WHERE EXTRACT(YEAR FROM ir.incident_date) = $1 AND it.category = 'thl'"
    ).bind(year).fetch_one(&state.db).await?;

    let fehlalarm: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM incident_reports ir
         LEFT JOIN incident_types it ON it.key = ir.incident_type_key
         WHERE EXTRACT(YEAR FROM ir.incident_date) = $1 AND it.category = 'fehlalarm'"
    ).bind(year).fetch_one(&state.db).await?;

    let sonstiges = total - brand - thl - fehlalarm;

    let entwurf: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM incident_reports
         WHERE EXTRACT(YEAR FROM incident_date) = $1 AND status = 'entwurf'"
    ).bind(year).fetch_one(&state.db).await?;

    Ok(Json(StatsResponse { year, total, brand, thl, fehlalarm, sonstiges, entwurf }))
}

// ── Änderungshistorie ─────────────────────────────────────────────────────────

pub async fn get_changes(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<Vec<IncidentChange>>> {
    // Existenzcheck + Zugriffscheck via get_incident logic
    let report = sqlx::query_as::<_, IncidentReport>(
        "SELECT * FROM incident_reports WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    if report.status == "entwurf" && !claims.is_admin_or_above() {
        if report.created_by != Some(claims.sub)
            && !has_approve_perm(&state.db, claims.sub).await
        {
            return Err(AppError::Forbidden);
        }
    }

    let changes = sqlx::query_as::<_, IncidentChange>(
        "SELECT * FROM incident_changes WHERE incident_id = $1 ORDER BY created_at DESC"
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(changes))
}

// ── Hilfsfunktion: Zeit parsen ────────────────────────────────────────────────

fn parse_time(s: Option<&str>) -> Option<chrono::NaiveTime> {
    s.and_then(|t| {
        if t.is_empty() { return None; }
        chrono::NaiveTime::parse_from_str(t, "%H:%M")
            .or_else(|_| chrono::NaiveTime::parse_from_str(t, "%H:%M:%S"))
            .ok()
    })
}

// ── Phase B: Fahrzeuge im Einsatz ─────────────────────────────────────────────

#[derive(Serialize, sqlx::FromRow)]
pub struct IncidentVehicle {
    pub id:             Uuid,
    pub incident_id:    Uuid,
    pub vehicle_id:     Option<Uuid>,
    pub vehicle_name:   String,
    pub callsign:       Option<String>,
    pub alarm_time:     Option<chrono::NaiveTime>,
    pub departure_time: Option<chrono::NaiveTime>,
    pub arrival_time:   Option<chrono::NaiveTime>,
    pub return_time:    Option<chrono::NaiveTime>,
    pub ready_time:     Option<chrono::NaiveTime>,
    pub km_driven:      Option<i32>,
    pub crew_count:     Option<i32>,
    pub notes:          Option<String>,
    pub created_at:     chrono::DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct IncidentVehicleBody {
    pub vehicle_id:     Option<Uuid>,
    pub vehicle_name:   String,
    pub callsign:       Option<String>,
    pub alarm_time:     Option<String>,
    pub departure_time: Option<String>,
    pub arrival_time:   Option<String>,
    pub return_time:    Option<String>,
    pub ready_time:     Option<String>,
    pub km_driven:      Option<i32>,
    pub crew_count:     Option<i32>,
    pub notes:          Option<String>,
}

pub async fn list_incident_vehicles(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<Vec<IncidentVehicle>>> {
    ensure_incident_readable(&state.db, id, &claims).await?;
    let rows = sqlx::query_as::<_, IncidentVehicle>(
        "SELECT * FROM incident_vehicles WHERE incident_id = $1 ORDER BY created_at ASC"
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows))
}

pub async fn add_incident_vehicle(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<IncidentVehicleBody>,
) -> AppResult<Json<IncidentVehicle>> {
    ensure_incident_editable(&state.db, id, &claims).await?;
    let name = body.vehicle_name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::BadRequest("Fahrzeugname darf nicht leer sein".into()));
    }
    let row = sqlx::query_as::<_, IncidentVehicle>(
        "INSERT INTO incident_vehicles
            (incident_id, vehicle_id, vehicle_name, callsign,
             alarm_time, departure_time, arrival_time, return_time, ready_time,
             km_driven, crew_count, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING *"
    )
    .bind(id)
    .bind(body.vehicle_id)
    .bind(&name)
    .bind(body.callsign.as_deref())
    .bind(parse_time(body.alarm_time.as_deref()))
    .bind(parse_time(body.departure_time.as_deref()))
    .bind(parse_time(body.arrival_time.as_deref()))
    .bind(parse_time(body.return_time.as_deref()))
    .bind(parse_time(body.ready_time.as_deref()))
    .bind(body.km_driven)
    .bind(body.crew_count)
    .bind(body.notes.as_deref())
    .fetch_one(&state.db)
    .await?;
    Ok(Json(row))
}

pub async fn update_incident_vehicle(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, fid)): Path<(Uuid, Uuid)>,
    Json(body): Json<IncidentVehicleBody>,
) -> AppResult<Json<IncidentVehicle>> {
    ensure_incident_editable(&state.db, id, &claims).await?;
    let name = body.vehicle_name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::BadRequest("Fahrzeugname darf nicht leer sein".into()));
    }
    let row = sqlx::query_as::<_, IncidentVehicle>(
        "UPDATE incident_vehicles SET
            vehicle_id=$1, vehicle_name=$2, callsign=$3,
            alarm_time=$4, departure_time=$5, arrival_time=$6,
            return_time=$7, ready_time=$8, km_driven=$9, crew_count=$10, notes=$11
         WHERE id=$12 AND incident_id=$13
         RETURNING *"
    )
    .bind(body.vehicle_id)
    .bind(&name)
    .bind(body.callsign.as_deref())
    .bind(parse_time(body.alarm_time.as_deref()))
    .bind(parse_time(body.departure_time.as_deref()))
    .bind(parse_time(body.arrival_time.as_deref()))
    .bind(parse_time(body.return_time.as_deref()))
    .bind(parse_time(body.ready_time.as_deref()))
    .bind(body.km_driven)
    .bind(body.crew_count)
    .bind(body.notes.as_deref())
    .bind(fid)
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;
    Ok(Json(row))
}

pub async fn remove_incident_vehicle(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, fid)): Path<(Uuid, Uuid)>,
) -> AppResult<Json<serde_json::Value>> {
    ensure_incident_editable(&state.db, id, &claims).await?;
    sqlx::query("DELETE FROM incident_vehicles WHERE id=$1 AND incident_id=$2")
        .bind(fid).bind(id).execute(&state.db).await?;
    Ok(Json(serde_json::json!({ "message": "Fahrzeug entfernt" })))
}

// ── Phase B: Personal im Einsatz ──────────────────────────────────────────────

#[derive(Serialize, sqlx::FromRow)]
pub struct IncidentPersonnel {
    pub id:           Uuid,
    pub incident_id:  Uuid,
    pub user_id:      Option<Uuid>,
    pub display_name: String,
    pub role_name:    Option<String>,
    pub function:     Option<String>,
    pub created_at:   chrono::DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct IncidentPersonnelBody {
    pub user_id:      Option<Uuid>,
    pub display_name: String,
    pub role_name:    Option<String>,
    pub function:     Option<String>,
}

pub async fn list_incident_personnel(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<Vec<IncidentPersonnel>>> {
    ensure_incident_readable(&state.db, id, &claims).await?;
    let rows = sqlx::query_as::<_, IncidentPersonnel>(
        "SELECT * FROM incident_personnel WHERE incident_id = $1 ORDER BY created_at ASC"
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows))
}

pub async fn add_incident_personnel(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<IncidentPersonnelBody>,
) -> AppResult<Json<IncidentPersonnel>> {
    ensure_incident_editable(&state.db, id, &claims).await?;
    let name = body.display_name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::BadRequest("Name darf nicht leer sein".into()));
    }
    let row = sqlx::query_as::<_, IncidentPersonnel>(
        "INSERT INTO incident_personnel (incident_id, user_id, display_name, role_name, function)
         VALUES ($1,$2,$3,$4,$5) RETURNING *"
    )
    .bind(id)
    .bind(body.user_id)
    .bind(&name)
    .bind(body.role_name.as_deref())
    .bind(body.function.as_deref())
    .fetch_one(&state.db)
    .await?;
    Ok(Json(row))
}

pub async fn remove_incident_personnel(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, pid)): Path<(Uuid, Uuid)>,
) -> AppResult<Json<serde_json::Value>> {
    ensure_incident_editable(&state.db, id, &claims).await?;
    sqlx::query("DELETE FROM incident_personnel WHERE id=$1 AND incident_id=$2")
        .bind(pid).bind(id).execute(&state.db).await?;
    Ok(Json(serde_json::json!({ "message": "Person entfernt" })))
}

// ── Phase C: Anhänge ──────────────────────────────────────────────────────────

const MAX_ATTACHMENT_SIZE: usize = 20 * 1024 * 1024; // 20 MB

const ALLOWED_MIME_TYPES: &[&str] = &[
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.oasis.opendocument.text",
    "text/plain",
];

#[derive(Serialize, sqlx::FromRow)]
pub struct IncidentAttachment {
    pub id:          Uuid,
    pub incident_id: Uuid,
    pub filename:    String,
    pub stored_name: String,
    pub mime_type:   String,
    pub file_size:   i64,
    pub uploaded_by: Option<Uuid>,
    pub created_at:  chrono::DateTime<chrono::Utc>,
}

pub async fn list_attachments(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<Vec<IncidentAttachment>>> {
    ensure_incident_readable(&state.db, id, &claims).await?;
    let rows = sqlx::query_as::<_, IncidentAttachment>(
        "SELECT * FROM incident_attachments WHERE incident_id = $1 ORDER BY created_at ASC"
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows))
}

pub async fn upload_attachment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    mut multipart: Multipart,
) -> AppResult<Json<IncidentAttachment>> {
    ensure_incident_editable(&state.db, id, &claims).await?;

    while let Some(field) = multipart.next_field().await
        .map_err(|e| AppError::BadRequest(e.to_string()))?
    {
        if field.name() != Some("file") { continue; }

        let filename = field.file_name().unwrap_or("datei").to_string();
        let mime_type = field.content_type()
            .unwrap_or("application/octet-stream")
            .to_string();

        if !ALLOWED_MIME_TYPES.contains(&mime_type.as_str()) {
            return Err(AppError::BadRequest(format!(
                "Dateityp '{}' ist nicht erlaubt. Erlaubt: Bilder (JPEG/PNG/GIF/WebP), PDF, Word (docx), ODT, Text",
                mime_type
            )));
        }

        let data = field.bytes().await
            .map_err(|e| AppError::BadRequest(e.to_string()))?;

        if data.len() > MAX_ATTACHMENT_SIZE {
            return Err(AppError::BadRequest("Datei zu groß (max. 20 MB)".into()));
        }

        let ext = filename.rsplit('.').next().unwrap_or("bin").to_lowercase();
        let stored_name = format!("{}.{}", Uuid::new_v4(), ext);

        let dir = format!("{}/incidents/{}", state.config.data_dir, id);
        tokio::fs::create_dir_all(&dir).await
            .map_err(|e| AppError::Internal(anyhow::anyhow!("Ordner erstellen: {e}")))?;
        tokio::fs::write(format!("{}/{}", dir, stored_name), &data).await
            .map_err(|e| AppError::Internal(anyhow::anyhow!("Datei schreiben: {e}")))?;

        let file_size = data.len() as i64;

        let row = sqlx::query_as::<_, IncidentAttachment>(
            "INSERT INTO incident_attachments
             (incident_id, filename, stored_name, mime_type, file_size, uploaded_by)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING *"
        )
        .bind(id)
        .bind(&filename)
        .bind(&stored_name)
        .bind(&mime_type)
        .bind(file_size)
        .bind(claims.sub)
        .fetch_one(&state.db)
        .await?;

        return Ok(Json(row));
    }

    Err(AppError::BadRequest("Keine Datei im Request gefunden".into()))
}

pub async fn download_attachment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, aid)): Path<(Uuid, Uuid)>,
) -> AppResult<Response> {
    ensure_incident_readable(&state.db, id, &claims).await?;

    let attachment = sqlx::query_as::<_, IncidentAttachment>(
        "SELECT * FROM incident_attachments WHERE id = $1 AND incident_id = $2"
    )
    .bind(aid)
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    let file_path = format!("{}/incidents/{}/{}", state.config.data_dir, id, attachment.stored_name);
    let bytes = tokio::fs::read(&file_path).await
        .map_err(|_| AppError::NotFound)?;

    let safe_name = attachment.filename.replace('"', "'");
    let content_disp = format!("attachment; filename=\"{}\"", safe_name);

    Ok(Response::builder()
        .header(header::CONTENT_TYPE, &attachment.mime_type)
        .header(header::CONTENT_DISPOSITION, content_disp)
        .header(header::CONTENT_LENGTH, bytes.len())
        .body(Body::from(bytes))
        .unwrap())
}

pub async fn delete_attachment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, aid)): Path<(Uuid, Uuid)>,
) -> AppResult<Json<serde_json::Value>> {
    ensure_incident_editable(&state.db, id, &claims).await?;

    let attachment = sqlx::query_as::<_, IncidentAttachment>(
        "SELECT * FROM incident_attachments WHERE id = $1 AND incident_id = $2"
    )
    .bind(aid)
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    let file_path = format!("{}/incidents/{}/{}", state.config.data_dir, id, attachment.stored_name);
    let _ = tokio::fs::remove_file(&file_path).await; // Datei-Fehler ignorieren (war vielleicht schon weg)

    sqlx::query("DELETE FROM incident_attachments WHERE id = $1")
        .bind(aid)
        .execute(&state.db)
        .await?;

    Ok(Json(serde_json::json!({ "message": "Anhang gelöscht" })))
}

// ── Zugriffshelfer ────────────────────────────────────────────────────────────

async fn ensure_incident_readable(db: &PgPool, id: Uuid, claims: &Claims) -> AppResult<()> {
    let report = sqlx::query_as::<_, IncidentReport>(
        "SELECT * FROM incident_reports WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(db)
    .await?
    .ok_or(AppError::NotFound)?;

    if report.status == "entwurf" && !claims.is_admin_or_above() {
        if report.created_by != Some(claims.sub)
            && !has_approve_perm(db, claims.sub).await
        {
            return Err(AppError::Forbidden);
        }
    }
    Ok(())
}

async fn ensure_incident_editable(db: &PgPool, id: Uuid, claims: &Claims) -> AppResult<()> {
    let report = sqlx::query_as::<_, IncidentReport>(
        "SELECT * FROM incident_reports WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(db)
    .await?
    .ok_or(AppError::NotFound)?;

    if claims.is_admin_or_above() {
        return Ok(());
    }
    if report.status != "entwurf" {
        return Err(AppError::Forbidden);
    }
    if report.created_by != Some(claims.sub)
        && !has_approve_perm(db, claims.sub).await
    {
        return Err(AppError::Forbidden);
    }
    Ok(())
}

// ── Router ────────────────────────────────────────────────────────────────────

pub fn router(state: AppState) -> Router<AppState> {
    // Approve-Routen — benötigen einsatzberichte.approve
    let approve_routes = Router::new()
        .route("/:id/status",  put(set_status))
        .route("/:id",         delete(delete_incident))
        .route_layer(middleware::from_fn_with_state(
            state.clone(), require_module("einsatzberichte.approve"),
        ))
        .route_layer(middleware::from_fn_with_state(state.clone(), require_auth));

    // Schreib-Routen — benötigen einsatzberichte (oder approve, via Hierarchie nicht nötig da approve eigene layer hat)
    let write_routes = Router::new()
        .route("/",             post(create_incident))
        .route("/:id",          put(update_incident))
        .route("/:id/fahrzeuge",            post(add_incident_vehicle))
        .route("/:id/fahrzeuge/:fid",       put(update_incident_vehicle).delete(remove_incident_vehicle))
        .route("/:id/personal",             post(add_incident_personnel))
        .route("/:id/personal/:pid",        delete(remove_incident_personnel))
        .route("/:id/anhaenge",             post(upload_attachment))
        .route("/:id/anhaenge/:aid",        delete(delete_attachment))
        .route_layer(middleware::from_fn_with_state(
            state.clone(), require_module("einsatzberichte"),
        ))
        .route_layer(middleware::from_fn_with_state(state.clone(), require_auth));

    // Lese-Routen — benötigen einsatzberichte.read (oder höher, via Hierarchie in check_module)
    let read_routes = Router::new()
        .route("/stats",                        get(get_stats))
        .route("/",                             get(list_incidents))
        .route("/:id",                          get(get_incident))
        .route("/:id/changes",                  get(get_changes))
        .route("/:id/fahrzeuge",                get(list_incident_vehicles))
        .route("/:id/personal",                 get(list_incident_personnel))
        .route("/:id/anhaenge",                 get(list_attachments))
        .route("/:id/anhaenge/:aid/download",   get(download_attachment))
        .route_layer(middleware::from_fn_with_state(
            state.clone(), require_module("einsatzberichte.read"),
        ))
        .route_layer(middleware::from_fn_with_state(state, require_auth));

    Router::new()
        .merge(read_routes)
        .merge(write_routes)
        .merge(approve_routes)
}
