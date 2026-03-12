FROM conductoross/conductor:3.22.0

# Download OpenTelemetry Java agent (use RUN+curl instead of ADD for reliable layer caching)
RUN curl -sSL -o /opt/opentelemetry-javaagent.jar \
    https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/download/v2.12.0/opentelemetry-javaagent.jar

ENV JAVA_TOOL_OPTIONS="-javaagent:/opt/opentelemetry-javaagent.jar" \
    OTEL_SERVICE_NAME=conductor \
    OTEL_TRACES_EXPORTER=otlp \
    OTEL_METRICS_EXPORTER=none \
    OTEL_LOGS_EXPORTER=none \
    OTEL_EXPORTER_OTLP_ENDPOINT=http://tempo:4317
