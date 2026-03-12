-- Create keycloak database and user for the IdP service
CREATE DATABASE keycloak;
CREATE USER keycloak WITH ENCRYPTED PASSWORD 'keycloak_dev';
GRANT ALL PRIVILEGES ON DATABASE keycloak TO keycloak;
ALTER DATABASE keycloak OWNER TO keycloak;

-- Create conductor database and user for the workflow engine
CREATE DATABASE conductor;
CREATE USER conductor WITH ENCRYPTED PASSWORD 'conductor_dev' REPLICATION;
GRANT ALL PRIVILEGES ON DATABASE conductor TO conductor;
ALTER DATABASE conductor OWNER TO conductor;

-- Create cdc database for normalized CDC events
CREATE DATABASE conductor_cdc;
GRANT ALL PRIVILEGES ON DATABASE conductor_cdc TO aegir;

-- Grant replication privileges for Debezium CDC
ALTER USER conductor WITH REPLICATION;

-- Create agents service user for the agents service
CREATE USER agents_svc WITH ENCRYPTED PASSWORD 'agents_dev';
GRANT ALL PRIVILEGES ON DATABASE aegir TO agents_svc;
