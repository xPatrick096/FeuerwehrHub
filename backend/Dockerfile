FROM rust:latest AS builder

WORKDIR /app

ENV SQLX_OFFLINE=true

# Abhängigkeiten cachen
COPY Cargo.toml ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm -f target/release/deps/feuerwehrhub*

# Quellcode kopieren und bauen
COPY src ./src
RUN cargo build --release

# Minimales Laufzeit-Image
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/target/release/feuerwehrhub .

EXPOSE 3000

CMD ["./feuerwehrhub"]
