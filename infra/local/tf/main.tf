terraform {
  required_providers {
    postgresql = {
      source  = "cyrilgdn/postgresql"
      version = "~> 1.25"
    }
    keycloak = {
      source  = "mrparkers/keycloak"
      version = "~> 4.4"
    }
  }
}

# ---------- Providers ----------

provider "postgresql" {
  host     = var.pg_host
  port     = var.pg_port
  username = var.pg_superuser
  password = var.pg_superuser_password
  database = var.pg_database
  sslmode  = "disable"
}

provider "keycloak" {
  client_id = "admin-cli"
  username  = var.keycloak_admin_user
  password  = var.keycloak_admin_password
  url       = var.keycloak_url
}

# ---------- Modules ----------

module "postgres" {
  source = "./modules/postgres"

  database           = var.pg_database
  host               = var.pg_host
  port               = var.pg_port
  iam_svc_password   = var.iam_svc_password
  legal_svc_password = var.legal_svc_password
}

module "keycloak" {
  source = "./modules/keycloak"

  google_client_id     = var.google_client_id
  google_client_secret = var.google_client_secret
}
