FROM rust:latest AS builder

WORKDIR /app/backend

ENV SQLX_OFFLINE=true

# Abhängigkeiten cachen
COPY backend/Cargo.toml ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm -f target/release/deps/feuerwehrhub*

# Quellcode, sqlx-Cache und Migrationen kopieren und bauen
COPY backend/.sqlx ./.sqlx
COPY backend/src ./src
COPY migrations ../migrations
RUN cargo build --release

# Minimales Laufzeit-Image
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/backend/target/release/feuerwehrhub .

EXPOSE 3000

CMD ["./feuerwehrhub"]
