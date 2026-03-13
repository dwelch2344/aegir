import { getEnv } from '@aegir/common'

const REGISTRY_URL = getEnv('SCHEMA_REGISTRY_URL', 'http://redpanda:8083')

export async function registerSchema(subject: string, schema: object): Promise<number> {
  const resp = await fetch(`${REGISTRY_URL}/subjects/${subject}/versions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/vnd.schemaregistry.v1+json' },
    body: JSON.stringify({
      schemaType: 'AVRO',
      schema: JSON.stringify(schema),
    }),
  })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Failed to register schema "${subject}": ${resp.status} ${text}`)
  }
  const { id } = (await resp.json()) as { id: number }
  console.log(`[cdc] registered schema "${subject}" with id ${id}`)
  return id
}

/**
 * Encode an Avro-serialized buffer with the Confluent wire format header:
 * [magic byte 0x00] [4-byte schema ID big-endian] [avro bytes]
 */
export function encodeWithSchemaId(schemaId: number, avroBytes: Buffer): Buffer {
  const header = Buffer.alloc(5)
  header.writeUInt8(0, 0) // magic byte
  header.writeUInt32BE(schemaId, 1)
  return Buffer.concat([header, avroBytes])
}

/**
 * Decode the Confluent wire format: strip the 5-byte header and return the Avro payload.
 */
export function decodeStripHeader(buf: Buffer): {
  schemaId: number
  payload: Buffer
} {
  const schemaId = buf.readUInt32BE(1)
  const payload = buf.subarray(5)
  return { schemaId, payload }
}
