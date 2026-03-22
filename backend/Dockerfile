FROM rust:1.78-slim AS builder

WORKDIR /app

# Abhängigkeiten cachen
COPY Cargo.toml ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm -f target/release/deps/ff_druckerverwaltung*

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

COPY --from=builder /app/target/release/ff-druckerverwaltung .

EXPOSE 3000

CMD ["./ff-druckerverwaltung"]
