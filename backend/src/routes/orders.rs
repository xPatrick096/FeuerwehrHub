use axum::{
    extract::{Path, Query, State},
    middleware,
    routing::{delete, get, post, put},
    Extension, Json, Router,
};
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::{
    auth::middleware::{require_auth, Claims},
    errors::{AppError, AppResult},
    AppState,
};

// ── Positionen ────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct OrderPosition {
    pub menge:      Option<String>,
    pub einheit:    Option<String>,
    pub gesamt:     Option<String>,
    pub gegenstand: Option<String>,
}

impl OrderPosition {
    fn is_empty(&self) -> bool {
        self.gegenstand.as_ref().map(|g| g.trim().is_empty()).unwrap_or(true)
    }
}

// ── API-Structs ───────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct Order {
    pub id:               Uuid,
    pub article_id:       Option<Uuid>,
    pub article_name:     String,
    pub quantity:         f64,
    pub unit:             String,
    pub status:           String,
    pub supplier:         Option<String>,
    pub order_date:       NaiveDate,
    pub notes:            Option<String>,
    pub ordered_by_id:    Option<Uuid>,
    pub ordered_by_name:  Option<String>,
    pub telefon:          Option<String>,
    pub lieferanschrift:  Option<String>,
    pub begruendung:      Option<String>,
    pub haendler_1:       Option<String>,
    pub haendler_2:       Option<String>,
    pub haendler_3:       Option<String>,
    pub positions:        Option<Vec<OrderPosition>>,
    pub created_at:       DateTime<Utc>,
    pub updated_at:       DateTime<Utc>,
}

#[derive(Serialize)]
pub struct OrderWithDeliveries {
    #[serde(flatten)]
    pub order:      Order,
    pub deliveries: Vec<Delivery>,
}

#[derive(Serialize, FromRow)]
pub struct Delivery {
    pub id:                 Uuid,
    pub order_id:           Uuid,
    pub quantity_delivered: f64,
    pub delivery_date:      NaiveDate,
    pub notes:              Option<String>,
    pub position_name:      Option<String>,
    pub received_by_name:   Option<String>,
    pub created_at:         DateTime<Utc>,
}

// ── DB-Zeile (non-macro FromRow) ──────────────────────────────────────────────

#[derive(FromRow)]
struct OrderRow {
    id:               Uuid,
    article_id:       Option<Uuid>,
    article_name:     String,
    quantity:         f64,
    unit:             String,
    status:           String,
    supplier:         Option<String>,
    order_date:       NaiveDate,
    notes:            Option<String>,
    ordered_by_id:    Option<Uuid>,
    ordered_by_name:  Option<String>,
    telefon:          Option<String>,
    lieferanschrift:  Option<String>,
    begruendung:      Option<String>,
    haendler_1:       Option<String>,
    haendler_2:       Option<String>,
    haendler_3:       Option<String>,
    positions:        Option<serde_json::Value>,
    created_at:       DateTime<Utc>,
    updated_at:       DateTime<Utc>,
}

impl From<OrderRow> for Order {
    fn from(r: OrderRow) -> Self {
        let positions = r.positions
            .and_then(|v| serde_json::from_value(v).ok());
        Order {
            id:              r.id,
            article_id:      r.article_id,
            article_name:    r.article_name,
            quantity:        r.quantity,
            unit:            r.unit,
            status:          r.status,
            supplier:        r.supplier,
            order_date:      r.order_date,
            notes:           r.notes,
            ordered_by_id:   r.ordered_by_id,
            ordered_by_name: r.ordered_by_name,
            telefon:         r.telefon,
            lieferanschrift: r.lieferanschrift,
            begruendung:     r.begruendung,
            haendler_1:      r.haendler_1,
            haendler_2:      r.haendler_2,
            haendler_3:      r.haendler_3,
            positions,
            created_at:      r.created_at,
            updated_at:      r.updated_at,
        }
    }
}

// ── Request-Body ──────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct OrderBody {
    pub article_id:      Option<Uuid>,
    pub article_name:    Option<String>,
    pub quantity:        Option<f64>,
    pub unit:            Option<String>,
    pub supplier:        Option<String>,
    pub order_date:      Option<NaiveDate>,
    pub notes:           Option<String>,
    pub telefon:         Option<String>,
    pub lieferanschrift: Option<String>,
    pub begruendung:     Option<String>,
    pub haendler_1:      Option<String>,
    pub haendler_2:      Option<String>,
    pub haendler_3:      Option<String>,
    pub positions:       Option<Vec<OrderPosition>>,
}

#[derive(Deserialize)]
pub struct OrderFilter {
    pub status: Option<String>,
    pub search: Option<String>,
}

#[derive(Deserialize)]
pub struct DeliveryBody {
    pub quantity_delivered: f64,
    pub delivery_date:      Option<NaiveDate>,
    pub notes:              Option<String>,
    pub position_name:      Option<String>,
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

/// Leitet article_name / quantity / unit aus der ersten nicht-leeren Position ab.
fn derive_article_fields(body: &OrderBody) -> Result<(String, f64, String), AppError> {
    if let Some(positions) = &body.positions {
        if let Some(first) = positions.iter().find(|p| !p.is_empty()) {
            let name = first.gegenstand.clone().unwrap_or_default().trim().to_string();
            let qty = first.menge.as_deref()
                .and_then(|m| m.replace(',', ".").trim().parse::<f64>().ok())
                .unwrap_or(1.0);
            let unit = first.einheit.clone().unwrap_or_else(|| "Stück".into());
            return Ok((name, qty, unit));
        }
        return Err(AppError::BadRequest("Mindestens eine Position muss ausgefüllt sein".into()));
    }

    // Legacy: direkte Felder
    let name = body.article_name.as_deref().unwrap_or("").trim().to_string();
    if name.is_empty() {
        return Err(AppError::BadRequest("Artikelname darf nicht leer sein".into()));
    }
    let qty = body.quantity.unwrap_or(1.0);
    if qty <= 0.0 {
        return Err(AppError::BadRequest("Menge muss größer als 0 sein".into()));
    }
    let unit = body.unit.clone().unwrap_or_else(|| "Stück".into());
    Ok((name, qty, unit))
}

const ORDER_COLUMNS: &str = r#"
    id, article_id, article_name, quantity::float8 as quantity,
    unit, status::text as status, supplier, order_date,
    notes, ordered_by_id, ordered_by_name,
    telefon, lieferanschrift, begruendung,
    haendler_1, haendler_2, haendler_3,
    positions, created_at, updated_at
"#;

// ── Handler ───────────────────────────────────────────────────────────────────

pub async fn list_orders(
    State(state): State<AppState>,
    Query(filter): Query<OrderFilter>,
) -> AppResult<Json<Vec<Order>>> {
    let sql = format!(
        "SELECT {ORDER_COLUMNS} FROM orders
         WHERE ($1::text IS NULL OR status::text = $1)
           AND ($2::text IS NULL OR article_name ILIKE '%' || $2 || '%')
         ORDER BY order_date DESC, created_at DESC"
    );

    let rows = sqlx::query_as::<_, OrderRow>(&sql)
        .bind(filter.status)
        .bind(filter.search)
        .fetch_all(&state.db)
        .await?;

    Ok(Json(rows.into_iter().map(Order::from).collect()))
}

pub async fn get_order(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<OrderWithDeliveries>> {
    let sql = format!("SELECT {ORDER_COLUMNS} FROM orders WHERE id = $1");

    let row = sqlx::query_as::<_, OrderRow>(&sql)
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)?;

    let deliveries = sqlx::query_as::<_, Delivery>(
        "SELECT id, order_id, quantity_delivered::float8 as quantity_delivered,
                delivery_date, notes, position_name, received_by_name, created_at
         FROM deliveries WHERE order_id = $1 ORDER BY delivery_date DESC, created_at DESC"
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;

    let order = Order::from(row);

    Ok(Json(OrderWithDeliveries { order, deliveries }))
}

pub async fn create_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<OrderBody>,
) -> AppResult<Json<Order>> {
    let (article_name, quantity, unit) = derive_article_fields(&body)?;
    let order_date = body.order_date.unwrap_or_else(|| chrono::Local::now().date_naive());
    let positions_json: Option<serde_json::Value> = body.positions.as_ref()
        .map(|p| serde_json::to_value(p).ok())
        .flatten();

    let returning = format!(
        "INSERT INTO orders
             (article_id, article_name, quantity, unit, supplier, order_date, notes,
              ordered_by_id, ordered_by_name,
              telefon, lieferanschrift, begruendung, haendler_1, haendler_2, haendler_3,
              positions)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         RETURNING {ORDER_COLUMNS}"
    );

    let row = sqlx::query_as::<_, OrderRow>(&returning)
        .bind(body.article_id)
        .bind(&article_name)
        .bind(quantity)
        .bind(&unit)
        .bind(body.supplier)
        .bind(order_date)
        .bind(body.notes)
        .bind(claims.sub)
        .bind(&claims.username)
        .bind(body.telefon)
        .bind(body.lieferanschrift)
        .bind(body.begruendung)
        .bind(body.haendler_1)
        .bind(body.haendler_2)
        .bind(body.haendler_3)
        .bind(positions_json)
        .fetch_one(&state.db)
        .await?;

    Ok(Json(Order::from(row)))
}

pub async fn update_order(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<OrderBody>,
) -> AppResult<Json<Order>> {
    let (article_name, quantity, unit) = derive_article_fields(&body)?;
    let order_date = body.order_date.unwrap_or_else(|| chrono::Local::now().date_naive());
    let positions_json: Option<serde_json::Value> = body.positions.as_ref()
        .map(|p| serde_json::to_value(p).ok())
        .flatten();

    let returning = format!(
        "UPDATE orders SET
             article_id=$1, article_name=$2, quantity=$3, unit=$4,
             supplier=$5, order_date=$6, notes=$7,
             telefon=$8, lieferanschrift=$9, begruendung=$10,
             haendler_1=$11, haendler_2=$12, haendler_3=$13,
             positions=$14
         WHERE id = $15
         RETURNING {ORDER_COLUMNS}"
    );

    let row = sqlx::query_as::<_, OrderRow>(&returning)
        .bind(body.article_id)
        .bind(&article_name)
        .bind(quantity)
        .bind(&unit)
        .bind(body.supplier)
        .bind(order_date)
        .bind(body.notes)
        .bind(body.telefon)
        .bind(body.lieferanschrift)
        .bind(body.begruendung)
        .bind(body.haendler_1)
        .bind(body.haendler_2)
        .bind(body.haendler_3)
        .bind(positions_json)
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)?;

    Ok(Json(Order::from(row)))
}

pub async fn delete_order(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let result = sqlx::query!("DELETE FROM orders WHERE id = $1", id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(Json(serde_json::json!({ "message": "Bestellung gelöscht" })))
}

pub async fn add_delivery(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<DeliveryBody>,
) -> AppResult<Json<serde_json::Value>> {
    if body.quantity_delivered <= 0.0 {
        return Err(AppError::BadRequest("Liefermenge muss größer als 0 sein".into()));
    }

    // Bestellung laden: Menge + Positionen für Status-Berechnung
    let order_data = sqlx::query_as::<_, (f64, Option<serde_json::Value>)>(
        "SELECT quantity::float8, positions FROM orders WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    // Anzahl nicht-leerer Positionen
    let positions_count = order_data.1.as_ref()
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter(|p| {
            p.get("gegenstand")
                .and_then(|g| g.as_str())
                .map(|s| !s.trim().is_empty())
                .unwrap_or(false)
        }).count())
        .unwrap_or(0);

    let delivery_date = body.delivery_date.unwrap_or_else(|| chrono::Local::now().date_naive());

    sqlx::query(
        "INSERT INTO deliveries (order_id, quantity_delivered, delivery_date, notes, position_name, received_by_id, received_by_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7)"
    )
    .bind(id)
    .bind(body.quantity_delivered)
    .bind(delivery_date)
    .bind(body.notes)
    .bind(&body.position_name)
    .bind(claims.sub)
    .bind(&claims.username)
    .execute(&state.db)
    .await?;

    // Status-Berechnung: bei mehreren Positionen erst vollständig wenn alle eine Lieferung haben
    let new_status = if positions_count > 1 {
        let delivered_positions: i64 = sqlx::query_scalar(
            "SELECT COUNT(DISTINCT position_name) FROM deliveries
             WHERE order_id = $1 AND position_name IS NOT NULL AND position_name != ''"
        )
        .bind(id)
        .fetch_one(&state.db)
        .await?;

        if delivered_positions >= positions_count as i64 {
            "vollstaendig"
        } else {
            "teillieferung"
        }
    } else {
        // Einzelposition: Mengenvergleich
        let total_delivered: f64 = sqlx::query_scalar(
            "SELECT COALESCE(SUM(quantity_delivered), 0)::float8 FROM deliveries WHERE order_id = $1"
        )
        .bind(id)
        .fetch_one(&state.db)
        .await?;

        if total_delivered >= order_data.0 { "vollstaendig" } else { "teillieferung" }
    };

    sqlx::query("UPDATE orders SET status = $1::order_status WHERE id = $2")
        .bind(new_status)
        .bind(id)
        .execute(&state.db)
        .await?;

    Ok(Json(serde_json::json!({ "message": "Lieferung eingetragen", "status": new_status })))
}

pub async fn get_stats(State(state): State<AppState>) -> AppResult<Json<serde_json::Value>> {
    let counts = sqlx::query!(
        r#"SELECT
            COUNT(*) FILTER (WHERE status = 'offen') as "offen!",
            COUNT(*) FILTER (WHERE status = 'teillieferung') as "teillieferung!",
            COUNT(*) FILTER (WHERE status = 'vollstaendig') as "vollstaendig!",
            COUNT(*) as "gesamt!"
           FROM orders"#
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(serde_json::json!({
        "offen": counts.offen,
        "teillieferung": counts.teillieferung,
        "vollstaendig": counts.vollstaendig,
        "gesamt": counts.gesamt
    })))
}

// ── Handler: Status manuell setzen ───────────────────────────────────────────

#[derive(Deserialize)]
pub struct SetStatusBody {
    pub status: String,
}

pub async fn set_status(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<SetStatusBody>,
) -> AppResult<Json<serde_json::Value>> {
    let valid = ["offen", "teillieferung", "vollstaendig", "storniert"];
    if !valid.contains(&body.status.as_str()) {
        return Err(AppError::BadRequest("Ungültiger Status".into()));
    }

    let result = sqlx::query("UPDATE orders SET status = $1::order_status WHERE id = $2")
        .bind(&body.status)
        .bind(id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(Json(serde_json::json!({ "status": body.status })))
}

pub fn router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/", get(list_orders).post(create_order))
        .route("/stats", get(get_stats))
        .route("/:id", get(get_order).put(update_order).delete(delete_order))
        .route("/:id/delivery", post(add_delivery))
        .route("/:id/status", post(set_status))
        .route_layer(middleware::from_fn_with_state(state, require_auth))
}
