# ---------- PostgreSQL ----------

variable "pg_host" {
  default = "postgres"
}

variable "pg_port" {
  default = 5432
}

variable "pg_superuser" {
  default = "aegir"
}

variable "pg_superuser_password" {
  default   = "aegir_dev"
  sensitive = true
}

variable "pg_database" {
  default = "aegir"
}

variable "iam_svc_password" {
  default   = "iam_dev"
  sensitive = true
}

variable "legal_svc_password" {
  default   = "legal_dev"
  sensitive = true
}

variable "system_svc_password" {
  default   = "system_dev"
  sensitive = true
}

variable "analytics_ro_password" {
  default   = "analytics_ro_dev"
  sensitive = true
}

variable "analytics_rw_password" {
  default   = "analytics_rw_dev"
  sensitive = true
}

# ---------- Keycloak ----------

variable "keycloak_url" {
  description = "Keycloak base URL (admin API)"
  default     = "http://keycloak:8080/infra/idp"
}

variable "keycloak_admin_user" {
  default = "admin"
}

variable "keycloak_admin_password" {
  default   = "admin"
  sensitive = true
}

# ---------- Google IdP ----------

variable "google_client_id" {
  description = "Google OAuth 2.0 Client ID"
  type        = string
  default     = "not-set"
  sensitive   = true
}

variable "google_client_secret" {
  description = "Google OAuth 2.0 Client Secret"
  type        = string
  default     = "not-set"
  sensitive   = true
}
