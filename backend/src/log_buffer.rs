use std::sync::{Arc, Mutex};
use tracing_subscriber::Layer;

const MAX_LINES: usize = 1000;

#[derive(Clone)]
pub struct LogBuffer {
    lines: Arc<Mutex<Vec<String>>>,
}

impl LogBuffer {
    pub fn new() -> Self {
        Self {
            lines: Arc::new(Mutex::new(Vec::with_capacity(MAX_LINES))),
        }
    }

    pub fn get_lines(&self) -> Vec<String> {
        self.lines.lock().unwrap().clone()
    }

    fn push(&self, line: String) {
        let mut buf = self.lines.lock().unwrap();
        if buf.len() >= MAX_LINES {
            buf.remove(0);
        }
        buf.push(line);
    }
}

// Tracing-Layer der Einträge in den Buffer schreibt
pub struct LogBufferLayer {
    buffer: LogBuffer,
}

impl LogBufferLayer {
    pub fn new(buffer: LogBuffer) -> Self {
        Self { buffer }
    }
}

impl<S> Layer<S> for LogBufferLayer
where
    S: tracing::Subscriber,
{
    fn on_event(
        &self,
        event: &tracing::Event<'_>,
        _ctx: tracing_subscriber::layer::Context<'_, S>,
    ) {
        use std::fmt::Write;
        use tracing::field::{Field, Visit};

        struct Visitor {
            message: String,
        }

        impl Visit for Visitor {
            fn record_debug(&mut self, field: &Field, value: &dyn std::fmt::Debug) {
                if field.name() == "message" {
                    let _ = write!(self.message, "{:?}", value);
                }
            }
            fn record_str(&mut self, field: &Field, value: &str) {
                if field.name() == "message" {
                    self.message.push_str(value);
                }
            }
        }

        let mut visitor = Visitor { message: String::new() };
        event.record(&mut visitor);

        let level = event.metadata().level().as_str();
        let target = event.metadata().target();
        let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ");

        let line = format!("[{}] {} {} — {}", now, level, target, visitor.message);
        self.buffer.push(line);
    }
}
