terraform {
  required_providers {
    keycloak = {
      source  = "mrparkers/keycloak"
      version = "~> 4.4"
    }
  }
}

# ---------- Global Realm ----------

resource "keycloak_realm" "global" {
  realm   = "global"
  enabled = true

  # User registration
  registration_allowed = false

  # Username = email
  login_with_email_allowed       = true
  duplicate_emails_allowed       = false
  edit_username_allowed          = false
  reset_password_allowed         = true
  remember_me                    = true
  verify_email                   = true
  registration_email_as_username = true

  # Organizations
  attributes = {
    "organizationsEnabled" = "true"
  }

  # SMTP (local MailHog defaults)
  smtp_server {
    host = var.smtp_host
    port = var.smtp_port
    from = var.smtp_from

    from_display_name = "aegir"
  }
}

# ---------- Google Identity Provider ----------

resource "keycloak_oidc_google_identity_provider" "google" {
  realm         = keycloak_realm.global.id
  client_id     = var.google_client_id
  client_secret = var.google_client_secret
  trust_email   = true

  # Scopes
  default_scopes = "openid email profile"

  # Sync settings
  sync_mode = "IMPORT"

  # Map Google email as the Keycloak username
  extra_config = {
    "filteredByClaim"      = ""
    "filteredByClaimValue" = ""
  }
}

# ---------- App OIDC Client ----------

resource "keycloak_openid_client" "app" {
  realm_id = keycloak_realm.global.id

  client_id     = "aegir-app"
  client_secret = var.app_client_secret
  name          = "aegir App"
  enabled       = true
  access_type   = "CONFIDENTIAL"

  standard_flow_enabled        = true
  direct_access_grants_enabled = false
  implicit_flow_enabled        = false

  valid_redirect_uris             = [var.app_redirect_uri]
  valid_post_logout_redirect_uris = [var.app_post_logout_redirect_uri]
  web_origins                     = ["+"]

  login_theme = "keycloak"
}

resource "keycloak_openid_client_default_scopes" "app" {
  realm_id  = keycloak_realm.global.id
  client_id = keycloak_openid_client.app.id

  default_scopes = ["openid", "email", "profile", "basic"]
}

# ---------- Service Account Client (Admin API) ----------

resource "keycloak_openid_client" "admin_api" {
  realm_id = keycloak_realm.global.id

  client_id                = "aegir-admin-api"
  client_secret            = var.admin_api_client_secret
  name                     = "aegir Admin API"
  enabled                  = true
  access_type              = "CONFIDENTIAL"
  service_accounts_enabled = true

  standard_flow_enabled        = true
  direct_access_grants_enabled = true
  implicit_flow_enabled        = true
  base_url                     = "http://localhost:8080/app/"
  valid_redirect_uris = [
    "http://localhost:8080/app/api/oidc/callback"
  ]
  # valid_post_logout_redirect_uris = [
  #   "http://localhost:8080/app/"
  # ]
}

# Grant realm-management roles to the service account
data "keycloak_openid_client" "realm_management" {
  realm_id  = keycloak_realm.global.id
  client_id = "realm-management"
}

data "keycloak_role" "manage_users" {
  realm_id  = keycloak_realm.global.id
  client_id = data.keycloak_openid_client.realm_management.id
  name      = "manage-users"
}

data "keycloak_role" "view_users" {
  realm_id  = keycloak_realm.global.id
  client_id = data.keycloak_openid_client.realm_management.id
  name      = "view-users"
}

data "keycloak_role" "manage_realm" {
  realm_id  = keycloak_realm.global.id
  client_id = data.keycloak_openid_client.realm_management.id
  name      = "manage-realm"
}

resource "keycloak_openid_client_service_account_role" "admin_api_manage_users" {
  realm_id                = keycloak_realm.global.id
  service_account_user_id = keycloak_openid_client.admin_api.service_account_user_id
  client_id               = data.keycloak_openid_client.realm_management.id
  role                    = data.keycloak_role.manage_users.name
}

resource "keycloak_openid_client_service_account_role" "admin_api_view_users" {
  realm_id                = keycloak_realm.global.id
  service_account_user_id = keycloak_openid_client.admin_api.service_account_user_id
  client_id               = data.keycloak_openid_client.realm_management.id
  role                    = data.keycloak_role.view_users.name
}

resource "keycloak_openid_client_service_account_role" "admin_api_manage_realm" {
  realm_id                = keycloak_realm.global.id
  service_account_user_id = keycloak_openid_client.admin_api.service_account_user_id
  client_id               = data.keycloak_openid_client.realm_management.id
  role                    = data.keycloak_role.manage_realm.name
}
