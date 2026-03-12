import { getEnv } from "@aegir/common";

const DEBEZIUM_URL = getEnv("DEBEZIUM_URL", "http://debezium-connect:8083");

const CONNECTOR_CONFIG = {
  name: "conductor-postgres-cdc",
  config: {
    "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
    "database.hostname": "postgres",
    "database.port": "5432",
    "database.user": "conductor",
    "database.password": "conductor_dev",
    "database.dbname": "conductor",
    "database.server.name": "conductor",
    "topic.prefix": "conductor.cdc",
    "schema.include.list": "public",
    "plugin.name": "pgoutput",
    "publication.autocreate.mode": "filtered",
    "slot.name": "conductor_cdc_slot",

    // Capture full before/after for updates
    "column.propagate.source.type": ".*",

    // Snapshot mode: initial snapshot then stream
    "snapshot.mode": "initial",

    // Heartbeat to keep replication slot active
    "heartbeat.interval.ms": "30000",

    // Key/value serialization (JSON for raw CDC, our service handles Avro)
    "key.converter": "org.apache.kafka.connect.json.JsonConverter",
    "key.converter.schemas.enable": "false",
    "value.converter": "org.apache.kafka.connect.json.JsonConverter",
    "value.converter.schemas.enable": "false",
  },
};

export async function registerDebeziumConnector(): Promise<void> {
  const name = CONNECTOR_CONFIG.name;
  const url = `${DEBEZIUM_URL}/connectors/${name}`;

  // Check if connector already exists
  const existing = await fetch(url);
  if (existing.ok) {
    // Update the connector config
    const resp = await fetch(`${url}/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(CONNECTOR_CONFIG.config),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(
        `Failed to update Debezium connector: ${resp.status} ${text}`,
      );
    }
    console.log(`[cdc] updated Debezium connector "${name}"`);
    return;
  }

  // Create new connector
  const resp = await fetch(`${DEBEZIUM_URL}/connectors`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(CONNECTOR_CONFIG),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(
      `Failed to create Debezium connector: ${resp.status} ${text}`,
    );
  }
  console.log(`[cdc] created Debezium connector "${name}"`);
}

export async function getConnectorStatus(): Promise<any> {
  const resp = await fetch(
    `${DEBEZIUM_URL}/connectors/${CONNECTOR_CONFIG.name}/status`,
  );
  if (!resp.ok) return null;
  return resp.json();
}
