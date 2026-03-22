use axum::{
    extract::{Path, Query, State},
    middleware,
    routing::{delete, get, post, put},
    Extension, Json, Router,
};
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    auth::middleware::{require_auth, Claims},
    errors::{AppError, AppResult},
    AppState,
};

#[derive(Serialize)]
pub struct Order {
    pub id: Uuid,
    pub article_id: Option<Uuid>,
    pub article_name: String,
    pub quantity: f64,
    pub unit: String,
    pub status: String,
    pub supplier: Option<String>,
    pub order_date: NaiveDate,
    pub notes: Option<String>,
    pub ordered_by_id: Option<Uuid>,
    pub ordered_by_name: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Serialize)]
pub struct OrderWithDeliveries {
    #[serde(flatten)]
    pub order: Order,
    pub deliveries: Vec<Delivery>,
}

#[derive(Serialize)]
pub struct Delivery {
    pub id: Uuid,
    pub order_id: Uuid,
    pub quantity_delivered: f64,
    pub delivery_date: NaiveDate,
    pub notes: Option<String>,
    pub received_by_name: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct OrderBody {
    pub article_id: Option<Uuid>,
    pub article_name: String,
    pub quantity: f64,
    pub unit: String,
    pub supplier: Option<String>,
    pub order_date: Option<NaiveDate>,
    pub notes: Option<String>,
}

#[derive(Deserialize)]
pub struct OrderFilter {
    pub status: Option<String>,
    pub search: Option<String>,
}

#[derive(Deserialize)]
pub struct DeliveryBody {
    pub quantity_delivered: f64,
    pub delivery_date: Option<NaiveDate>,
    pub notes: Option<String>,
}

pub async fn list_orders(
    State(state): State<AppState>,
    Query(filter): Query<OrderFilter>,
) -> AppResult<Json<Vec<Order>>> {
    // Dynamisches SQL über sqlx ist etwas ausführlicher; wir nutzen einfaches Matching
    let rows = sqlx::query!(
        r#"SELECT id, article_id, article_name, quantity::float8 as "quantity!",
                  unit, status::text as "status!", supplier, order_date,
                  notes, ordered_by_id, ordered_by_name, created_at, updated_at
           FROM orders
           WHERE ($1::text IS NULL OR status::text = $1)
             AND ($2::text IS NULL OR article_name ILIKE '%' || $2 || '%')
           ORDER BY order_date DESC, created_at DESC"#,
        filter.status,
        filter.search
    )
    .fetch_all(&state.db)
    .await?;

    let orders = rows
        .into_iter()
        .map(|r| Order {
            id: r.id,
            article_id: r.article_id,
            article_name: r.article_name,
            quantity: r.quantity,
            unit: r.unit,
            status: r.status,
            supplier: r.supplier,
            order_date: r.order_date,
            notes: r.notes,
            ordered_by_id: r.ordered_by_id,
            ordered_by_name: r.ordered_by_name,
            created_at: r.created_at,
            updated_at: r.updated_at,
        })
        .collect();

    Ok(Json(orders))
}

pub async fn get_order(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<OrderWithDeliveries>> {
    let row = sqlx::query!(
        r#"SELECT id, article_id, article_name, quantity::float8 as "quantity!",
                  unit, status::text as "status!", supplier, order_date,
                  notes, ordered_by_id, ordered_by_name, created_at, updated_at
           FROM orders WHERE id = $1"#,
        id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    let deliveries = sqlx::query!(
        r#"SELECT id, order_id, quantity_delivered::float8 as "quantity_delivered!",
                  delivery_date, notes, received_by_name, created_at
           FROM deliveries WHERE order_id = $1 ORDER BY delivery_date DESC"#,
        id
    )
    .fetch_all(&state.db)
    .await?;

    let order = Order {
        id: row.id,
        article_id: row.article_id,
        article_name: row.article_name,
        quantity: row.quantity,
        unit: row.unit,
        status: row.status,
        supplier: row.supplier,
        order_date: row.order_date,
        notes: row.notes,
        ordered_by_id: row.ordered_by_id,
        ordered_by_name: row.ordered_by_name,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };

    let deliveries = deliveries
        .into_iter()
        .map(|d| Delivery {
            id: d.id,
            order_id: d.order_id,
            quantity_delivered: d.quantity_delivered,
            delivery_date: d.delivery_date,
            notes: d.notes,
            received_by_name: d.received_by_name,
            created_at: d.created_at,
        })
        .collect();

    Ok(Json(OrderWithDeliveries { order, deliveries }))
}

pub async fn create_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<OrderBody>,
) -> AppResult<Json<Order>> {
    if body.article_name.trim().is_empty() {
        return Err(AppError::BadRequest("Artikelname darf nicht leer sein".into()));
    }
    if body.quantity <= 0.0 {
        return Err(AppError::BadRequest("Menge muss größer als 0 sein".into()));
    }

    let order_date = body.order_date.unwrap_or_else(|| chrono::Local::now().date_naive());

    let row = sqlx::query!(
        r#"INSERT INTO orders
               (article_id, article_name, quantity, unit, supplier, order_date, notes, ordered_by_id, ordered_by_name)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id, article_id, article_name, quantity::float8 as "quantity!",
                     unit, status::text as "status!", supplier, order_date,
                     notes, ordered_by_id, ordered_by_name, created_at, updated_at"#,
        body.article_id,
        body.article_name.trim(),
        body.quantity,
        body.unit,
        body.supplier,
        order_date,
        body.notes,
        claims.sub,
        claims.username
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(Order {
        id: row.id,
        article_id: row.article_id,
        article_name: row.article_name,
        quantity: row.quantity,
        unit: row.unit,
        status: row.status,
        supplier: row.supplier,
        order_date: row.order_date,
        notes: row.notes,
        ordered_by_id: row.ordered_by_id,
        ordered_by_name: row.ordered_by_name,
        created_at: row.created_at,
        updated_at: row.updated_at,
    }))
}

pub async fn update_order(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<OrderBody>,
) -> AppResult<Json<Order>> {
    if body.article_name.trim().is_empty() {
        return Err(AppError::BadRequest("Artikelname darf nicht leer sein".into()));
    }

    let order_date = body.order_date.unwrap_or_else(|| chrono::Local::now().date_naive());

    let row = sqlx::query!(
        r#"UPDATE orders SET
               article_id=$1, article_name=$2, quantity=$3, unit=$4,
               supplier=$5, order_date=$6, notes=$7
           WHERE id = $8
           RETURNING id, article_id, article_name, quantity::float8 as "quantity!",
                     unit, status::text as "status!", supplier, order_date,
                     notes, ordered_by_id, ordered_by_name, created_at, updated_at"#,
        body.article_id,
        body.article_name.trim(),
        body.quantity,
        body.unit,
        body.supplier,
        order_date,
        body.notes,
        id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(Order {
        id: row.id,
        article_id: row.article_id,
        article_name: row.article_name,
        quantity: row.quantity,
        unit: row.unit,
        status: row.status,
        supplier: row.supplier,
        order_date: row.order_date,
        notes: row.notes,
        ordered_by_id: row.ordered_by_id,
        ordered_by_name: row.ordered_by_name,
        created_at: row.created_at,
        updated_at: row.updated_at,
    }))
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

    // Bestellung holen
    let order = sqlx::query!(
        r#"SELECT quantity::float8 as "quantity!" FROM orders WHERE id = $1"#,
        id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    let delivery_date = body.delivery_date.unwrap_or_else(|| chrono::Local::now().date_naive());

    sqlx::query!(
        "INSERT INTO deliveries (order_id, quantity_delivered, delivery_date, notes, received_by_id, received_by_name)
         VALUES ($1, $2, $3, $4, $5, $6)",
        id,
        body.quantity_delivered,
        delivery_date,
        body.notes,
        claims.sub,
        claims.username
    )
    .execute(&state.db)
    .await?;

    // Gesamtgelieferte Menge berechnen & Status aktualisieren
    let total_delivered: f64 = sqlx::query_scalar!(
        r#"SELECT COALESCE(SUM(quantity_delivered), 0)::float8 as "total!" FROM deliveries WHERE order_id = $1"#,
        id
    )
    .fetch_one(&state.db)
    .await?;

    let new_status = if total_delivered >= order.quantity {
        "vollstaendig"
    } else {
        "teillieferung"
    };

    sqlx::query!(
        "UPDATE orders SET status = $1::order_status WHERE id = $2",
        new_status,
        id
    )
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

pub fn router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/", get(list_orders).post(create_order))
        .route("/stats", get(get_stats))
        .route("/:id", get(get_order).put(update_order).delete(delete_order))
        .route("/:id/delivery", post(add_delivery))
        .route_layer(middleware::from_fn_with_state(state, require_auth))
}
