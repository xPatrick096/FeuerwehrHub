use anyhow::Result;

#[derive(Debug, Clone)]
pub struct Config {
    pub db_host: String,
    pub db_port: u16,
    pub db_name: String,
    pub db_user: String,
    pub db_password: String,
    pub app_host: String,
    pub app_port: u16,
    pub jwt_secret: String,
    pub jwt_expiry_hours: i64,
    pub ff_name: String,
    pub data_dir: String,
    pub frontend_url: String,
    pub login_max_attempts: u32,
    pub lockout_minutes: i64,
    // Docker-Container-Namen für den In-App-Update-Mechanismus
    pub container_backend:  String,
    pub container_frontend: String,
    pub container_db:       String,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        dotenvy::dotenv().ok();

        Ok(Self {
            db_host: std::env::var("DB_HOST")?,
            db_port: std::env::var("DB_PORT")
                .unwrap_or_else(|_| "5432".into())
                .parse()?,
            db_name: std::env::var("DB_NAME")?,
            db_user: std::env::var("DB_USER")?,
            db_password: std::env::var("DB_PASSWORD")?,
            app_host: std::env::var("APP_HOST")
                .unwrap_or_else(|_| "0.0.0.0".into()),
            app_port: std::env::var("APP_PORT")
                .unwrap_or_else(|_| "3000".into())
                .parse()?,
            jwt_secret: std::env::var("JWT_SECRET")?,
            jwt_expiry_hours: std::env::var("JWT_EXPIRY_HOURS")
                .unwrap_or_else(|_| "8".into())
                .parse()?,
            ff_name: std::env::var("FF_NAME")
                .unwrap_or_else(|_| "Freiwillige Feuerwehr".into()),
            data_dir: std::env::var("DATA_DIR")
                .unwrap_or_else(|_| "/data".into()),
            frontend_url: std::env::var("FRONTEND_URL")
                .unwrap_or_else(|_| "http://localhost".into()),
            login_max_attempts: std::env::var("LOGIN_MAX_ATTEMPTS")
                .unwrap_or_else(|_| "5".into())
                .parse()
                .unwrap_or(5),
            lockout_minutes: std::env::var("LOCKOUT_MINUTES")
                .unwrap_or_else(|_| "15".into())
                .parse()
                .unwrap_or(15),
            container_backend:  std::env::var("CONTAINER_BACKEND")
                .unwrap_or_else(|_| "feuerwehrhub-backend".into()),
            container_frontend: std::env::var("CONTAINER_FRONTEND")
                .unwrap_or_else(|_| "feuerwehrhub-frontend".into()),
            container_db:       std::env::var("CONTAINER_DB")
                .unwrap_or_else(|_| "feuerwehrhub-db".into()),
        })
    }

    pub fn database_url(&self) -> String {
        format!(
            "postgresql://{}:{}@{}:{}/{}",
            self.db_user, self.db_password, self.db_host, self.db_port, self.db_name
        )
    }
}
