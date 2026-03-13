terraform {
  required_providers {
    postgresql = {
      source  = "cyrilgdn/postgresql"
      version = "~> 1.25"
    }
  }
}

# ---------- IAM ----------

resource "postgresql_role" "iam_svc" {
  name     = "iam_svc"
  login    = true
  password = var.iam_svc_password
}

resource "postgresql_schema" "iam" {
  name     = "iam"
  owner    = postgresql_role.iam_svc.name
  database = var.database
}

resource "postgresql_grant" "iam_schema_usage" {
  role        = postgresql_role.iam_svc.name
  database    = var.database
  schema      = postgresql_schema.iam.name
  object_type = "schema"
  privileges  = ["CREATE", "USAGE"]
}

resource "postgresql_default_privileges" "iam_tables" {
  role     = postgresql_role.iam_svc.name
  database = var.database
  schema   = postgresql_schema.iam.name
  owner    = postgresql_role.iam_svc.name

  object_type = "table"
  privileges  = ["SELECT", "INSERT", "UPDATE", "DELETE"]
}

# ---------- LEGAL ----------

resource "postgresql_role" "legal_svc" {
  name     = "legal_svc"
  login    = true
  password = var.legal_svc_password
}

resource "postgresql_schema" "legal" {
  name     = "legal"
  owner    = postgresql_role.legal_svc.name
  database = var.database
}

resource "postgresql_grant" "legal_schema_usage" {
  role        = postgresql_role.legal_svc.name
  database    = var.database
  schema      = postgresql_schema.legal.name
  object_type = "schema"
  privileges  = ["CREATE", "USAGE"]
}

resource "postgresql_default_privileges" "legal_tables" {
  role     = postgresql_role.legal_svc.name
  database = var.database
  schema   = postgresql_schema.legal.name
  owner    = postgresql_role.legal_svc.name

  object_type = "table"
  privileges  = ["SELECT", "INSERT", "UPDATE", "DELETE"]
}

# ---------- SYSTEM ----------

resource "postgresql_role" "system_svc" {
  name     = "system_svc"
  login    = true
  password = var.system_svc_password
}

resource "postgresql_schema" "system" {
  name     = "system"
  owner    = postgresql_role.system_svc.name
  database = var.database
}

resource "postgresql_grant" "system_schema_usage" {
  role        = postgresql_role.system_svc.name
  database    = var.database
  schema      = postgresql_schema.system.name
  object_type = "schema"
  privileges  = ["CREATE", "USAGE"]
}

resource "postgresql_default_privileges" "system_tables" {
  role     = postgresql_role.system_svc.name
  database = var.database
  schema   = postgresql_schema.system.name
  owner    = postgresql_role.system_svc.name

  object_type = "table"
  privileges  = ["SELECT", "INSERT", "UPDATE", "DELETE"]
}
