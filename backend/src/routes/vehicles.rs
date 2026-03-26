use axum::{
    extract::{Path, State},
    middleware,
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
pub struct Vehicle {
    pub id:                  Uuid,
    pub name:                String,
    pub short_name:          Option<String>,
    pub opta:                Option<String>,
    pub vehicle_type:        String,
    pub base_type:           Option<String>,
    pub license_plate:       Option<String>,
    pub manufacturer:        Option<String>,
    pub body_manufacturer:   Option<String>,
    pub year_built:          Option<i32>,
    pub chassis_number:      Option<String>,
    pub strength_leadership: i32,
    pub strength_sub:        i32,
    pub strength_crew:       i32,
    pub replacement_id:      Option<Uuid>,
    pub replacement_name:    Option<String>,
    pub length_m:            Option<f64>,
    pub width_m:             Option<f64>,
    pub height_m:            Option<f64>,
    pub weight_kg:           Option<i32>,
    pub phone:               Option<String>,
    pub status:              String,
    pub notes:               Option<String>,
    pub created_at:          DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct VehicleBody {
    pub name:                String,
    pub short_name:          Option<String>,
    pub opta:                Option<String>,
    pub vehicle_type:        Option<String>,
    pub base_type:           Option<String>,
    pub license_plate:       Option<String>,
    pub manufacturer:        Option<String>,
    pub body_manufacturer:   Option<String>,
    pub year_built:          Option<i32>,
    pub chassis_number:      Option<String>,
    pub strength_leadership: Option<i32>,
    pub strength_sub:        Option<i32>,
    pub strength_crew:       Option<i32>,
    pub replacement_id:      Option<Uuid>,
    pub length_m:            Option<f64>,
    pub width_m:             Option<f64>,
    pub height_m:            Option<f64>,
    pub weight_kg:           Option<i32>,
    pub phone:               Option<String>,
    pub status:              Option<String>,
    pub notes:               Option<String>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct VehicleInspection {
    pub id:              Uuid,
    pub vehicle_id:      Uuid,
    pub name:            String,
    pub last_date:       Option<NaiveDate>,
    pub next_date:       Option<NaiveDate>,
    pub interval_months: Option<i32>,
    pub notes:           Option<String>,
    pub created_at:      DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct InspectionBody {
    pub name:            String,
    pub last_date:       Option<NaiveDate>,
    pub next_date:       Option<NaiveDate>,
    pub interval_months: Option<i32>,
    pub notes:           Option<String>,
}

#[derive(Serialize)]
pub struct VehicleStats {
    pub total:           i64,
    pub active:          i64,
    pub in_maintenance:  i64,
    pub inspections_overdue: i64,
    pub inspections_soon:    i64,
}

// ── Fahrzeuge ─────────────────────────────────────────────────────────────────

pub async fn list_vehicles(
    State(state): State<AppState>,
) -> AppResult<Json<Vec<Vehicle>>> {
    let vehicles = sqlx::query_as::<_, Vehicle>(
        "SELECT v.id, v.name, v.short_name, v.opta, v.vehicle_type, v.base_type,
                v.license_plate, v.manufacturer, v.body_manufacturer, v.year_built,
                v.chassis_number, v.strength_leadership, v.strength_sub, v.strength_crew,
                v.replacement_id, r.name as replacement_name,
                v.length_m::float8, v.width_m::float8, v.height_m::float8,
                v.weight_kg, v.phone, v.status, v.notes, v.created_at
         FROM vehicles v
         LEFT JOIN vehicles r ON r.id = v.replacement_id
         ORDER BY v.name ASC"
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(vehicles))
}

pub async fn get_vehicle(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<Vehicle>> {
    let vehicle = sqlx::query_as::<_, Vehicle>(
        "SELECT v.id, v.name, v.short_name, v.opta, v.vehicle_type, v.base_type,
                v.license_plate, v.manufacturer, v.body_manufacturer, v.year_built,
                v.chassis_number, v.strength_leadership, v.strength_sub, v.strength_crew,
                v.replacement_id, r.name as replacement_name,
                v.length_m::float8, v.width_m::float8, v.height_m::float8,
                v.weight_kg, v.phone, v.status, v.notes, v.created_at
         FROM vehicles v
         LEFT JOIN vehicles r ON r.id = v.replacement_id
         WHERE v.id = $1"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(vehicle))
}

pub async fn create_vehicle(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<VehicleBody>,
) -> AppResult<Json<Vehicle>> {
    if !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }

    let name = body.name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::BadRequest("Fahrzeugname darf nicht leer sein".into()));
    }

    let vehicle_type = validate_vehicle_type(body.vehicle_type.as_deref())?;
    let status = validate_status(body.status.as_deref())?;

    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO vehicles (name, short_name, opta, vehicle_type, base_type, license_plate,
            manufacturer, body_manufacturer, year_built, chassis_number,
            strength_leadership, strength_sub, strength_crew, replacement_id,
            length_m, width_m, height_m, weight_kg, phone, status, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
         RETURNING id"
    )
    .bind(&name)
    .bind(&body.short_name)
    .bind(&body.opta)
    .bind(vehicle_type)
    .bind(&body.base_type)
    .bind(&body.license_plate)
    .bind(&body.manufacturer)
    .bind(&body.body_manufacturer)
    .bind(body.year_built)
    .bind(&body.chassis_number)
    .bind(body.strength_leadership.unwrap_or(0))
    .bind(body.strength_sub.unwrap_or(0))
    .bind(body.strength_crew.unwrap_or(0))
    .bind(body.replacement_id)
    .bind(body.length_m)
    .bind(body.width_m)
    .bind(body.height_m)
    .bind(body.weight_kg)
    .bind(&body.phone)
    .bind(status)
    .bind(&body.notes)
    .fetch_one(&state.db)
    .await?;

    get_vehicle(State(state), Path(id)).await
}

pub async fn update_vehicle(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<VehicleBody>,
) -> AppResult<Json<Vehicle>> {
    if !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }

    let name = body.name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::BadRequest("Fahrzeugname darf nicht leer sein".into()));
    }

    let vehicle_type = validate_vehicle_type(body.vehicle_type.as_deref())?;
    let status = validate_status(body.status.as_deref())?;

    let rows = sqlx::query(
        "UPDATE vehicles SET name=$1, short_name=$2, opta=$3, vehicle_type=$4, base_type=$5,
            license_plate=$6, manufacturer=$7, body_manufacturer=$8, year_built=$9,
            chassis_number=$10, strength_leadership=$11, strength_sub=$12, strength_crew=$13,
            replacement_id=$14, length_m=$15, width_m=$16, height_m=$17, weight_kg=$18,
            phone=$19, status=$20, notes=$21, updated_at=NOW()
         WHERE id=$22"
    )
    .bind(&name)
    .bind(&body.short_name)
    .bind(&body.opta)
    .bind(vehicle_type)
    .bind(&body.base_type)
    .bind(&body.license_plate)
    .bind(&body.manufacturer)
    .bind(&body.body_manufacturer)
    .bind(body.year_built)
    .bind(&body.chassis_number)
    .bind(body.strength_leadership.unwrap_or(0))
    .bind(body.strength_sub.unwrap_or(0))
    .bind(body.strength_crew.unwrap_or(0))
    .bind(body.replacement_id)
    .bind(body.length_m)
    .bind(body.width_m)
    .bind(body.height_m)
    .bind(body.weight_kg)
    .bind(&body.phone)
    .bind(status)
    .bind(&body.notes)
    .bind(id)
    .execute(&state.db)
    .await?;

    if rows.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    get_vehicle(State(state), Path(id)).await
}

pub async fn delete_vehicle(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    if !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }

    let result = sqlx::query("DELETE FROM vehicles WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(Json(serde_json::json!({ "message": "Fahrzeug gelöscht" })))
}

// ── Fristen ───────────────────────────────────────────────────────────────────

pub async fn list_inspections(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<Vec<VehicleInspection>>> {
    let inspections = sqlx::query_as::<_, VehicleInspection>(
        "SELECT id, vehicle_id, name, last_date, next_date, interval_months, notes, created_at
         FROM vehicle_inspections WHERE vehicle_id = $1
         ORDER BY next_date ASC NULLS LAST"
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(inspections))
}

pub async fn create_inspection(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(vehicle_id): Path<Uuid>,
    Json(body): Json<InspectionBody>,
) -> AppResult<Json<VehicleInspection>> {
    if !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }

    let name = body.name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::BadRequest("Bezeichnung darf nicht leer sein".into()));
    }

    let inspection = sqlx::query_as::<_, VehicleInspection>(
        "INSERT INTO vehicle_inspections (vehicle_id, name, last_date, next_date, interval_months, notes)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, vehicle_id, name, last_date, next_date, interval_months, notes, created_at"
    )
    .bind(vehicle_id)
    .bind(&name)
    .bind(body.last_date)
    .bind(body.next_date)
    .bind(body.interval_months)
    .bind(&body.notes)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(inspection))
}

pub async fn update_inspection(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((vehicle_id, iid)): Path<(Uuid, Uuid)>,
    Json(body): Json<InspectionBody>,
) -> AppResult<Json<VehicleInspection>> {
    if !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }

    let name = body.name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::BadRequest("Bezeichnung darf nicht leer sein".into()));
    }

    let inspection = sqlx::query_as::<_, VehicleInspection>(
        "UPDATE vehicle_inspections
         SET name=$1, last_date=$2, next_date=$3, interval_months=$4, notes=$5, updated_at=NOW()
         WHERE id=$6 AND vehicle_id=$7
         RETURNING id, vehicle_id, name, last_date, next_date, interval_months, notes, created_at"
    )
    .bind(&name)
    .bind(body.last_date)
    .bind(body.next_date)
    .bind(body.interval_months)
    .bind(&body.notes)
    .bind(iid)
    .bind(vehicle_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(inspection))
}

pub async fn delete_inspection(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((vehicle_id, iid)): Path<(Uuid, Uuid)>,
) -> AppResult<Json<serde_json::Value>> {
    if !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }

    let result = sqlx::query(
        "DELETE FROM vehicle_inspections WHERE id = $1 AND vehicle_id = $2"
    )
    .bind(iid)
    .bind(vehicle_id)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(Json(serde_json::json!({ "message": "Frist gelöscht" })))
}

// ── Stats ─────────────────────────────────────────────────────────────────────

pub async fn get_vehicle_stats(
    State(state): State<AppState>,
) -> AppResult<Json<VehicleStats>> {
    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM vehicles")
        .fetch_one(&state.db).await?;

    let active: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM vehicles WHERE status = 'aktiv'")
        .fetch_one(&state.db).await?;

    let in_maintenance: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM vehicles WHERE status IN ('ausser_dienst', 'wartung')"
    ).fetch_one(&state.db).await?;

    let inspections_overdue: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM vehicle_inspections WHERE next_date < CURRENT_DATE"
    ).fetch_one(&state.db).await?;

    let inspections_soon: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM vehicle_inspections
         WHERE next_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days'"
    ).fetch_one(&state.db).await?;

    Ok(Json(VehicleStats {
        total,
        active,
        in_maintenance,
        inspections_overdue,
        inspections_soon,
    }))
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

fn validate_vehicle_type(t: Option<&str>) -> AppResult<&'static str> {
    Ok(match t.unwrap_or("lkw") {
        "lkw"       => "lkw",
        "pkw"       => "pkw",
        "anhaenger" => "anhaenger",
        "drohne"    => "drohne",
        "warnmittel"=> "warnmittel",
        _           => return Err(AppError::BadRequest("Ungültiger Fahrzeugtyp".into())),
    })
}

fn validate_status(s: Option<&str>) -> AppResult<&'static str> {
    Ok(match s.unwrap_or("aktiv") {
        "aktiv"        => "aktiv",
        "ausser_dienst"=> "ausser_dienst",
        "wartung"      => "wartung",
        _              => return Err(AppError::BadRequest("Ungültiger Status".into())),
    })
}

// ── Fahrtenbuch ───────────────────────────────────────────────────────────────

#[derive(Serialize, sqlx::FromRow)]
pub struct VehicleTrip {
    pub id:         Uuid,
    pub vehicle_id: Uuid,
    pub trip_date:  NaiveDate,
    pub driver:     Option<String>,
    pub reason:     String,
    pub km_start:   Option<i32>,
    pub km_end:     Option<i32>,
    pub notes:      Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct TripBody {
    pub trip_date: NaiveDate,
    pub driver:    Option<String>,
    pub reason:    Option<String>,
    pub km_start:  Option<i32>,
    pub km_end:    Option<i32>,
    pub notes:     Option<String>,
}

pub async fn list_trips(
    State(state): State<AppState>,
    Path(vehicle_id): Path<Uuid>,
) -> AppResult<Json<Vec<VehicleTrip>>> {
    let trips = sqlx::query_as::<_, VehicleTrip>(
        "SELECT id, vehicle_id, trip_date, driver, reason, km_start, km_end, notes, created_at
         FROM vehicle_trips WHERE vehicle_id = $1 ORDER BY trip_date DESC, created_at DESC"
    )
    .bind(vehicle_id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(trips))
}

pub async fn create_trip(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(vehicle_id): Path<Uuid>,
    Json(body): Json<TripBody>,
) -> AppResult<Json<VehicleTrip>> {
    let reason = match body.reason.as_deref().unwrap_or("sonstiges") {
        "uebung" | "einsatz" | "werkstatt" | "sonstiges" => body.reason.as_deref().unwrap_or("sonstiges"),
        _ => return Err(AppError::BadRequest("Ungültiger Anlass".into())),
    };
    let trip = sqlx::query_as::<_, VehicleTrip>(
        "INSERT INTO vehicle_trips (vehicle_id, trip_date, driver, reason, km_start, km_end, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id, vehicle_id, trip_date, driver, reason, km_start, km_end, notes, created_at"
    )
    .bind(vehicle_id)
    .bind(body.trip_date)
    .bind(&body.driver)
    .bind(reason)
    .bind(body.km_start)
    .bind(body.km_end)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&state.db)
    .await?;
    Ok(Json(trip))
}

pub async fn update_trip(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((vehicle_id, tid)): Path<(Uuid, Uuid)>,
    Json(body): Json<TripBody>,
) -> AppResult<Json<VehicleTrip>> {
    if !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }
    let reason = match body.reason.as_deref().unwrap_or("sonstiges") {
        "uebung" | "einsatz" | "werkstatt" | "sonstiges" => body.reason.as_deref().unwrap_or("sonstiges"),
        _ => return Err(AppError::BadRequest("Ungültiger Anlass".into())),
    };
    let trip = sqlx::query_as::<_, VehicleTrip>(
        "UPDATE vehicle_trips SET trip_date=$1, driver=$2, reason=$3, km_start=$4, km_end=$5, notes=$6
         WHERE id=$7 AND vehicle_id=$8
         RETURNING id, vehicle_id, trip_date, driver, reason, km_start, km_end, notes, created_at"
    )
    .bind(body.trip_date)
    .bind(&body.driver)
    .bind(reason)
    .bind(body.km_start)
    .bind(body.km_end)
    .bind(&body.notes)
    .bind(tid)
    .bind(vehicle_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;
    Ok(Json(trip))
}

pub async fn delete_trip(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((vehicle_id, tid)): Path<(Uuid, Uuid)>,
) -> AppResult<Json<serde_json::Value>> {
    if !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }
    let r = sqlx::query("DELETE FROM vehicle_trips WHERE id=$1 AND vehicle_id=$2")
        .bind(tid).bind(vehicle_id).execute(&state.db).await?;
    if r.rows_affected() == 0 { return Err(AppError::NotFound); }
    Ok(Json(serde_json::json!({ "message": "Fahrt gelöscht" })))
}

// ── Tankprotokoll ─────────────────────────────────────────────────────────────

#[derive(Serialize, sqlx::FromRow)]
pub struct VehicleFueling {
    pub id:           Uuid,
    pub vehicle_id:   Uuid,
    pub fueling_date: NaiveDate,
    pub km_stand:     Option<i32>,
    pub liters:       Option<f64>,
    pub fuel_type:    String,
    pub cost_eur:     Option<f64>,
    pub notes:        Option<String>,
    pub created_at:   DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct FuelingBody {
    pub fueling_date: NaiveDate,
    pub km_stand:     Option<i32>,
    pub liters:       Option<f64>,
    pub fuel_type:    Option<String>,
    pub cost_eur:     Option<f64>,
    pub notes:        Option<String>,
}

pub async fn list_fuelings(
    State(state): State<AppState>,
    Path(vehicle_id): Path<Uuid>,
) -> AppResult<Json<Vec<VehicleFueling>>> {
    let rows = sqlx::query_as::<_, VehicleFueling>(
        "SELECT id, vehicle_id, fueling_date, km_stand, liters::float8, fuel_type, cost_eur::float8, notes, created_at
         FROM vehicle_fuelings WHERE vehicle_id = $1 ORDER BY fueling_date DESC, created_at DESC"
    )
    .bind(vehicle_id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows))
}

pub async fn create_fueling(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(vehicle_id): Path<Uuid>,
    Json(body): Json<FuelingBody>,
) -> AppResult<Json<VehicleFueling>> {
    let fuel_type = validate_fuel_type(body.fuel_type.as_deref())?;
    let row = sqlx::query_as::<_, VehicleFueling>(
        "INSERT INTO vehicle_fuelings (vehicle_id, fueling_date, km_stand, liters, fuel_type, cost_eur, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id, vehicle_id, fueling_date, km_stand, liters::float8, fuel_type, cost_eur::float8, notes, created_at"
    )
    .bind(vehicle_id)
    .bind(body.fueling_date)
    .bind(body.km_stand)
    .bind(body.liters)
    .bind(fuel_type)
    .bind(body.cost_eur)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&state.db)
    .await?;
    Ok(Json(row))
}

pub async fn update_fueling(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((vehicle_id, fid)): Path<(Uuid, Uuid)>,
    Json(body): Json<FuelingBody>,
) -> AppResult<Json<VehicleFueling>> {
    if !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }
    let fuel_type = validate_fuel_type(body.fuel_type.as_deref())?;
    let row = sqlx::query_as::<_, VehicleFueling>(
        "UPDATE vehicle_fuelings SET fueling_date=$1, km_stand=$2, liters=$3, fuel_type=$4, cost_eur=$5, notes=$6
         WHERE id=$7 AND vehicle_id=$8
         RETURNING id, vehicle_id, fueling_date, km_stand, liters::float8, fuel_type, cost_eur::float8, notes, created_at"
    )
    .bind(body.fueling_date)
    .bind(body.km_stand)
    .bind(body.liters)
    .bind(fuel_type)
    .bind(body.cost_eur)
    .bind(&body.notes)
    .bind(fid)
    .bind(vehicle_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;
    Ok(Json(row))
}

pub async fn delete_fueling(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((vehicle_id, fid)): Path<(Uuid, Uuid)>,
) -> AppResult<Json<serde_json::Value>> {
    if !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }
    let r = sqlx::query("DELETE FROM vehicle_fuelings WHERE id=$1 AND vehicle_id=$2")
        .bind(fid).bind(vehicle_id).execute(&state.db).await?;
    if r.rows_affected() == 0 { return Err(AppError::NotFound); }
    Ok(Json(serde_json::json!({ "message": "Tankvorgang gelöscht" })))
}

// ── Störungsmeldungen ─────────────────────────────────────────────────────────

#[derive(Serialize, sqlx::FromRow)]
pub struct VehicleDefect {
    pub id:              Uuid,
    pub vehicle_id:      Uuid,
    pub title:           String,
    pub description:     Option<String>,
    pub priority:        String,
    pub status:          String,
    pub reported_by_name:Option<String>,
    pub reported_at:     DateTime<Utc>,
    pub resolved_at:     Option<DateTime<Utc>>,
    pub resolution_note: Option<String>,
    pub created_at:      DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct DefectBody {
    pub title:       String,
    pub description: Option<String>,
    pub priority:    Option<String>,
}

#[derive(Deserialize)]
pub struct DefectStatusBody {
    pub status:          String,
    pub resolution_note: Option<String>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct DefectComment {
    pub id:          Uuid,
    pub defect_id:   Uuid,
    pub author_name: Option<String>,
    pub body:        String,
    pub created_at:  DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct CommentBody {
    pub body: String,
}

pub async fn list_defects(
    State(state): State<AppState>,
    Path(vehicle_id): Path<Uuid>,
) -> AppResult<Json<Vec<VehicleDefect>>> {
    let rows = sqlx::query_as::<_, VehicleDefect>(
        "SELECT d.id, d.vehicle_id, d.title, d.description, d.priority, d.status,
                u.display_name as reported_by_name,
                d.reported_at, d.resolved_at, d.resolution_note, d.created_at
         FROM vehicle_defects d
         LEFT JOIN users u ON u.id = d.reported_by
         WHERE d.vehicle_id = $1
         ORDER BY
           CASE d.status WHEN 'offen' THEN 0 WHEN 'in_bearbeitung' THEN 1 ELSE 2 END,
           CASE d.priority WHEN 'kritisch' THEN 0 WHEN 'hoch' THEN 1 WHEN 'mittel' THEN 2 ELSE 3 END,
           d.reported_at DESC"
    )
    .bind(vehicle_id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows))
}

pub async fn create_defect(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(vehicle_id): Path<Uuid>,
    Json(body): Json<DefectBody>,
) -> AppResult<Json<VehicleDefect>> {
    let title = body.title.trim().to_string();
    if title.is_empty() {
        return Err(AppError::BadRequest("Titel darf nicht leer sein".into()));
    }
    let priority = validate_priority(body.priority.as_deref())?;

    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO vehicle_defects (vehicle_id, title, description, priority, reported_by)
         VALUES ($1,$2,$3,$4,$5) RETURNING id"
    )
    .bind(vehicle_id)
    .bind(&title)
    .bind(&body.description)
    .bind(priority)
    .bind(claims.sub)
    .fetch_one(&state.db)
    .await?;

    // Bei kritisch → Fahrzeug automatisch auf Wartung setzen
    if priority == "kritisch" {
        let _ = sqlx::query(
            "UPDATE vehicles SET status='wartung', updated_at=NOW() WHERE id=$1 AND status='aktiv'"
        )
        .bind(vehicle_id)
        .execute(&state.db)
        .await;
    }

    get_defect_by_id(&state.db, id).await
}

pub async fn update_defect_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((vehicle_id, did)): Path<(Uuid, Uuid)>,
    Json(body): Json<DefectStatusBody>,
) -> AppResult<Json<VehicleDefect>> {
    if !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }
    let status = validate_defect_status(&body.status)?;
    let resolved_at = if status == "behoben" || status == "nicht_reproduzierbar" {
        Some("NOW()")
    } else {
        None
    };

    let id: Uuid = if resolved_at.is_some() {
        sqlx::query_scalar(
            "UPDATE vehicle_defects SET status=$1, resolution_note=$2, resolved_at=NOW(), updated_at=NOW()
             WHERE id=$3 AND vehicle_id=$4 RETURNING id"
        )
        .bind(status)
        .bind(&body.resolution_note)
        .bind(did)
        .bind(vehicle_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)?
    } else {
        sqlx::query_scalar(
            "UPDATE vehicle_defects SET status=$1, resolution_note=$2, resolved_at=NULL, updated_at=NOW()
             WHERE id=$3 AND vehicle_id=$4 RETURNING id"
        )
        .bind(status)
        .bind(&body.resolution_note)
        .bind(did)
        .bind(vehicle_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)?
    };

    get_defect_by_id(&state.db, id).await
}

pub async fn delete_defect(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((vehicle_id, did)): Path<(Uuid, Uuid)>,
) -> AppResult<Json<serde_json::Value>> {
    if !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }
    let r = sqlx::query("DELETE FROM vehicle_defects WHERE id=$1 AND vehicle_id=$2")
        .bind(did).bind(vehicle_id).execute(&state.db).await?;
    if r.rows_affected() == 0 { return Err(AppError::NotFound); }
    Ok(Json(serde_json::json!({ "message": "Störungsmeldung gelöscht" })))
}

pub async fn list_comments(
    State(state): State<AppState>,
    Path((_vehicle_id, did)): Path<(Uuid, Uuid)>,
) -> AppResult<Json<Vec<DefectComment>>> {
    let rows = sqlx::query_as::<_, DefectComment>(
        "SELECT c.id, c.defect_id, COALESCE(u.display_name, c.author_name) as author_name, c.body, c.created_at
         FROM vehicle_defect_comments c
         LEFT JOIN users u ON u.id = c.author_id
         WHERE c.defect_id = $1 ORDER BY c.created_at ASC"
    )
    .bind(did)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows))
}

pub async fn create_comment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((_vehicle_id, did)): Path<(Uuid, Uuid)>,
    Json(body): Json<CommentBody>,
) -> AppResult<Json<DefectComment>> {
    let text = body.body.trim().to_string();
    if text.is_empty() {
        return Err(AppError::BadRequest("Kommentar darf nicht leer sein".into()));
    }
    let row = sqlx::query_as::<_, DefectComment>(
        "INSERT INTO vehicle_defect_comments (defect_id, author_id, body)
         VALUES ($1,$2,$3)
         RETURNING id, defect_id,
           (SELECT display_name FROM users WHERE id=$2) as author_name,
           body, created_at"
    )
    .bind(did)
    .bind(claims.sub)
    .bind(&text)
    .fetch_one(&state.db)
    .await?;
    Ok(Json(row))
}

async fn get_defect_by_id(db: &sqlx::PgPool, id: Uuid) -> AppResult<Json<VehicleDefect>> {
    let row = sqlx::query_as::<_, VehicleDefect>(
        "SELECT d.id, d.vehicle_id, d.title, d.description, d.priority, d.status,
                u.display_name as reported_by_name,
                d.reported_at, d.resolved_at, d.resolution_note, d.created_at
         FROM vehicle_defects d
         LEFT JOIN users u ON u.id = d.reported_by
         WHERE d.id = $1"
    )
    .bind(id)
    .fetch_optional(db)
    .await?
    .ok_or(AppError::NotFound)?;
    Ok(Json(row))
}

fn validate_priority(p: Option<&str>) -> AppResult<&'static str> {
    Ok(match p.unwrap_or("mittel") {
        "niedrig"  => "niedrig",
        "mittel"   => "mittel",
        "hoch"     => "hoch",
        "kritisch" => "kritisch",
        _ => return Err(AppError::BadRequest("Ungültige Priorität".into())),
    })
}

fn validate_defect_status(s: &str) -> AppResult<&'static str> {
    Ok(match s {
        "offen"                 => "offen",
        "in_bearbeitung"        => "in_bearbeitung",
        "behoben"               => "behoben",
        "nicht_reproduzierbar"  => "nicht_reproduzierbar",
        _ => return Err(AppError::BadRequest("Ungültiger Status".into())),
    })
}

fn validate_fuel_type(t: Option<&str>) -> AppResult<&'static str> {
    Ok(match t.unwrap_or("diesel") {
        "diesel"    => "diesel",
        "benzin"    => "benzin",
        "adblue"    => "adblue",
        "strom"     => "strom",
        "sonstiges" => "sonstiges",
        _ => return Err(AppError::BadRequest("Ungültiger Kraftstofftyp".into())),
    })
}

// ── Router ────────────────────────────────────────────────────────────────────

pub fn router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/stats",                                    get(get_vehicle_stats))
        .route("/",                                         get(list_vehicles).post(create_vehicle))
        .route("/:id",                                      get(get_vehicle).put(update_vehicle).delete(delete_vehicle))
        .route("/:id/inspections",                          get(list_inspections).post(create_inspection))
        .route("/:id/inspections/:iid",                     put(update_inspection).delete(delete_inspection))
        .route("/:id/trips",                                get(list_trips).post(create_trip))
        .route("/:id/trips/:tid",                           put(update_trip).delete(delete_trip))
        .route("/:id/fuelings",                             get(list_fuelings).post(create_fueling))
        .route("/:id/fuelings/:fid",                        put(update_fueling).delete(delete_fueling))
        .route("/:id/defects",                              get(list_defects).post(create_defect))
        .route("/:id/defects/:did/status",                  put(update_defect_status))
        .route("/:id/defects/:did",                         delete(delete_defect))
        .route("/:id/defects/:did/comments",                get(list_comments).post(create_comment))
        .route_layer(middleware::from_fn_with_state(state.clone(), require_module("fahrzeuge")))
        .route_layer(middleware::from_fn_with_state(state, require_auth))
}
