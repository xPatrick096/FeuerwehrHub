use std::{
    net::IpAddr,
    num::NonZeroU32,
    sync::Arc,
    time::Duration,
};

use axum::{
    body::Body,
    extract::{ConnectInfo, Request, State},
    http::StatusCode,
    middleware::Next,
    response::Response,
};
use dashmap::DashMap;
use governor::{
    clock::DefaultClock,
    state::{InMemoryState, NotKeyed},
    Quota, RateLimiter,
};
use std::net::SocketAddr;

type Limiter = Arc<RateLimiter<NotKeyed, InMemoryState, DefaultClock>>;

#[derive(Clone)]
pub struct LoginRateLimiter {
    // Pro IP: max. 10 Versuche pro Minute
    limiters: Arc<DashMap<IpAddr, Limiter>>,
}

impl LoginRateLimiter {
    pub fn new() -> Self {
        Self {
            limiters: Arc::new(DashMap::new()),
        }
    }

    fn limiter_for(&self, ip: IpAddr) -> Limiter {
        self.limiters
            .entry(ip)
            .or_insert_with(|| {
                Arc::new(RateLimiter::direct(
                    Quota::per_minute(NonZeroU32::new(10).unwrap())
                        .allow_burst(NonZeroU32::new(5).unwrap()),
                ))
            })
            .clone()
    }
}

pub async fn login_rate_limit(
    State(limiter): State<LoginRateLimiter>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    request: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    let ip = addr.ip();
    let lim = limiter.limiter_for(ip);

    if lim.check().is_err() {
        tracing::warn!("Rate-Limit überschritten für IP: {}", ip);
        return Err(StatusCode::TOO_MANY_REQUESTS);
    }

    Ok(next.run(request).await)
}
