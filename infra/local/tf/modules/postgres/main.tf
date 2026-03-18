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

# ---------- ANALYTICS (read-only) ----------

resource "postgresql_role" "analytics_ro" {
  name     = "analytics_ro"
  login    = true
  password = var.analytics_ro_password
}

resource "postgresql_grant" "analytics_ro_iam_usage" {
  role        = postgresql_role.analytics_ro.name
  database    = var.database
  schema      = postgresql_schema.iam.name
  object_type = "schema"
  privileges  = ["USAGE"]
}

resource "postgresql_default_privileges" "analytics_ro_iam_tables" {
  role     = postgresql_role.analytics_ro.name
  database = var.database
  schema   = postgresql_schema.iam.name
  owner    = postgresql_role.iam_svc.name

  object_type = "table"
  privileges  = ["SELECT"]
}

resource "postgresql_grant" "analytics_ro_legal_usage" {
  role        = postgresql_role.analytics_ro.name
  database    = var.database
  schema      = postgresql_schema.legal.name
  object_type = "schema"
  privileges  = ["USAGE"]
}

resource "postgresql_default_privileges" "analytics_ro_legal_tables" {
  role     = postgresql_role.analytics_ro.name
  database = var.database
  schema   = postgresql_schema.legal.name
  owner    = postgresql_role.legal_svc.name

  object_type = "table"
  privileges  = ["SELECT"]
}

resource "postgresql_grant" "analytics_ro_system_usage" {
  role        = postgresql_role.analytics_ro.name
  database    = var.database
  schema      = postgresql_schema.system.name
  object_type = "schema"
  privileges  = ["USAGE"]
}

resource "postgresql_default_privileges" "analytics_ro_system_tables" {
  role     = postgresql_role.analytics_ro.name
  database = var.database
  schema   = postgresql_schema.system.name
  owner    = postgresql_role.system_svc.name

  object_type = "table"
  privileges  = ["SELECT"]
}

# ---------- ANALYTICS (read-write, tinkering) ----------

resource "postgresql_role" "analytics_rw" {
  name     = "analytics_rw"
  login    = true
  password = var.analytics_rw_password
}

# analytics_rw gets SELECT on all domain schemas (same as analytics_ro)

resource "postgresql_grant" "analytics_rw_iam_usage" {
  role        = postgresql_role.analytics_rw.name
  database    = var.database
  schema      = postgresql_schema.iam.name
  object_type = "schema"
  privileges  = ["USAGE"]
}

resource "postgresql_default_privileges" "analytics_rw_iam_tables" {
  role     = postgresql_role.analytics_rw.name
  database = var.database
  schema   = postgresql_schema.iam.name
  owner    = postgresql_role.iam_svc.name

  object_type = "table"
  privileges  = ["SELECT"]
}

resource "postgresql_grant" "analytics_rw_legal_usage" {
  role        = postgresql_role.analytics_rw.name
  database    = var.database
  schema      = postgresql_schema.legal.name
  object_type = "schema"
  privileges  = ["USAGE"]
}

resource "postgresql_default_privileges" "analytics_rw_legal_tables" {
  role     = postgresql_role.analytics_rw.name
  database = var.database
  schema   = postgresql_schema.legal.name
  owner    = postgresql_role.legal_svc.name

  object_type = "table"
  privileges  = ["SELECT"]
}

resource "postgresql_grant" "analytics_rw_system_usage" {
  role        = postgresql_role.analytics_rw.name
  database    = var.database
  schema      = postgresql_schema.system.name
  object_type = "schema"
  privileges  = ["USAGE"]
}

resource "postgresql_default_privileges" "analytics_rw_system_tables" {
  role     = postgresql_role.analytics_rw.name
  database = var.database
  schema   = postgresql_schema.system.name
  owner    = postgresql_role.system_svc.name

  object_type = "table"
  privileges  = ["SELECT"]
}

# analytics_rw also gets a dedicated scratch schema for temp tables, views, etc.

resource "postgresql_schema" "analytics" {
  name     = "analytics"
  owner    = postgresql_role.analytics_rw.name
  database = var.database
}

resource "postgresql_grant" "analytics_rw_scratch_usage" {
  role        = postgresql_role.analytics_rw.name
  database    = var.database
  schema      = postgresql_schema.analytics.name
  object_type = "schema"
  privileges  = ["CREATE", "USAGE"]
}

resource "postgresql_default_privileges" "analytics_rw_scratch_tables" {
  role     = postgresql_role.analytics_rw.name
  database = var.database
  schema   = postgresql_schema.analytics.name
  owner    = postgresql_role.analytics_rw.name

  object_type = "table"
  privileges  = ["SELECT", "INSERT", "UPDATE", "DELETE"]
}

# analytics_ro can also read the scratch schema
resource "postgresql_grant" "analytics_ro_scratch_usage" {
  role        = postgresql_role.analytics_ro.name
  database    = var.database
  schema      = postgresql_schema.analytics.name
  object_type = "schema"
  privileges  = ["USAGE"]
}

resource "postgresql_default_privileges" "analytics_ro_scratch_tables" {
  role     = postgresql_role.analytics_ro.name
  database = var.database
  schema   = postgresql_schema.analytics.name
  owner    = postgresql_role.analytics_rw.name

  object_type = "table"
  privileges  = ["SELECT"]
}
