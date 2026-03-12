#!/bin/bash
# Allow replication connections from the Docker network for Debezium CDC
echo "host replication conductor 0.0.0.0/0 md5" >> "$PGDATA/pg_hba.conf"
