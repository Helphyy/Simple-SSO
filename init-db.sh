#!/bin/bash
set -e

# Crée le user + la DB pour Outline uniquement.
# Rauthy a sa propre base SQLite dans son volume.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE USER outline_user WITH PASSWORD '${OUTLINE_DB_PASSWORD}';
    CREATE DATABASE outline OWNER outline_user;
    REVOKE ALL ON DATABASE outline FROM PUBLIC;
    GRANT ALL ON DATABASE outline TO outline_user;
EOSQL
