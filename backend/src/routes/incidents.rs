use axum::{
    extract::{Path, Query, State},
    middleware,
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

const GF_LEVEL: i32 = 30;
const WL_LEVEL: i32 = 50;

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

async fn user_role_level(db: &PgPool, user_id: Uuid) -> i32 {
    sqlx::query_scalar::<_, Option<i32>>(
        "SELECT r.level FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = $1"
    )
    .bind(user_id)
    .fetch_one(db)
    .await
    .unwrap_or(None)
    .unwrap_or(0)
}

async fn next_incident_number(db: &PgPool, year: i32) -> AppResult<String> {
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM incident_reports
         WHERE EXTRACT(YEAR FROM incident_date) = $1"
    )
    .bind(year)
    .fetch_one(db)
    .await?;
    Ok(format!("{}-{:03}", year, count + 1))
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
        || user_role_level(&state.db, claims.sub).await >= GF_LEVEL;

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

    // Zugriffscheck: Entwurf nur von Ersteller oder GF+/Admin sehbar
    if report.status == "entwurf" && !claims.is_admin_or_above() {
        if report.created_by != Some(claims.sub) {
            let level = user_role_level(&state.db, claims.sub).await;
            if level < GF_LEVEL {
                return Err(AppError::Forbidden);
            }
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

    // Freigegeben / archiviert → nur Admin kann noch bearbeiten
    if existing.status != "entwurf" && !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }

    // Entwurf: nur eigener oder GF+
    if existing.status == "entwurf" && !claims.is_admin_or_above() {
        if existing.created_by != Some(claims.sub) {
            let level = user_role_level(&state.db, claims.sub).await;
            if level < GF_LEVEL {
                return Err(AppError::Forbidden);
            }
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

    let level = if claims.is_admin_or_above() {
        i32::MAX
    } else {
        user_role_level(&state.db, claims.sub).await
    };

    match existing.status.as_str() {
        "entwurf" => {
            // TF: nur eigener Entwurf; GF+: alle Entwürfe
            let is_own = existing.created_by == Some(claims.sub);
            if !is_own && level < GF_LEVEL {
                return Err(AppError::Forbidden);
            }
        }
        "freigegeben" | "archiviert" => {
            // Nur WL+ oder Admin
            if level < WL_LEVEL {
                return Err(AppError::Forbidden);
            }
        }
        _ => return Err(AppError::Forbidden),
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

    let level = if claims.is_admin_or_above() {
        i32::MAX
    } else {
        user_role_level(&state.db, claims.sub).await
    };

    if level < GF_LEVEL {
        return Err(AppError::Forbidden);
    }

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
        "SELECT COUNT(*) FROM incident_reports
         WHERE EXTRACT(YEAR FROM incident_date) = $1
           AND incident_type_key LIKE 'brand%'"
    ).bind(year).fetch_one(&state.db).await?;

    let thl: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM incident_reports
         WHERE EXTRACT(YEAR FROM incident_date) = $1
           AND incident_type_key LIKE 'thl%'"
    ).bind(year).fetch_one(&state.db).await?;

    let fehlalarm: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM incident_reports
         WHERE EXTRACT(YEAR FROM incident_date) = $1
           AND incident_type_key LIKE 'fehlalarm%'"
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
        if report.created_by != Some(claims.sub) {
            let level = user_role_level(&state.db, claims.sub).await;
            if level < GF_LEVEL {
                return Err(AppError::Forbidden);
            }
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

// ── Router ────────────────────────────────────────────────────────────────────

pub fn router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/stats",      get(get_stats))
        .route("/",           get(list_incidents).post(create_incident))
        .route("/:id",        get(get_incident).put(update_incident).delete(delete_incident))
        .route("/:id/status", put(set_status))
        .route("/:id/changes", get(get_changes))
        .route_layer(middleware::from_fn_with_state(state.clone(), require_module("einsatzberichte")))
        .route_layer(middleware::from_fn_with_state(state, require_auth))
}
