variable "google_client_id" {
  description = "Google OAuth 2.0 Client ID for the Identity Provider"
  type        = string
  sensitive   = true
}

variable "google_client_secret" {
  description = "Google OAuth 2.0 Client Secret for the Identity Provider"
  type        = string
  sensitive   = true
}

variable "smtp_host" {
  description = "SMTP server host for realm email"
  type        = string
  default     = "mailhog"
}

variable "smtp_port" {
  description = "SMTP server port"
  type        = string
  default     = "1025"
}

variable "smtp_from" {
  description = "From address for realm emails"
  type        = string
  default     = "noreply@aegir.local"
}

# ---------- App OIDC Client ----------

variable "app_client_secret" {
  description = "Fixed OIDC client secret for local dev (deterministic across environments)"
  type        = string
  default     = "aegir-local-dev-oidc-client-secret"
  sensitive   = true
}

variable "admin_api_client_secret" {
  description = "Fixed service account client secret for local dev (Keycloak Admin API)"
  type        = string
  default     = "aegir-local-dev-admin-api-secret"
  sensitive   = true
}

variable "app_redirect_uri" {
  description = "Valid redirect URI for the app OIDC client"
  type        = string
  default     = "http://localhost:8080/app/auth/oidc/callback"
}

variable "app_post_logout_redirect_uri" {
  description = "Post-logout redirect URI for the app OIDC client"
  type        = string
  default     = "http://localhost:8080/app/*"
}
