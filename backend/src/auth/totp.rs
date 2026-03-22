use anyhow::Result;
use totp_rs::{Algorithm, Secret, TOTP};

pub fn generate_secret() -> String {
    let secret = Secret::generate_secret();
    secret.to_encoded().to_string()
}

pub fn generate_qr_uri(secret: &str, username: &str, issuer: &str) -> Result<String> {
    let totp = TOTP::new(
        Algorithm::SHA1,
        6,
        1,
        30,
        Secret::Encoded(secret.to_string()).to_bytes()?,
        Some(issuer.to_string()),
        username.to_string(),
    )?;

    Ok(totp.get_url())
}

pub fn verify_code(secret: &str, code: &str) -> Result<bool> {
    let totp = TOTP::new(
        Algorithm::SHA1,
        6,
        1,
        30,
        Secret::Encoded(secret.to_string()).to_bytes()?,
        None,
        String::new(),
    )?;

    Ok(totp.check_current(code)?)
}
