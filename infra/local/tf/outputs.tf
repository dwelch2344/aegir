# ---------- PostgreSQL ----------

output "iam_connection_string" {
  value     = module.postgres.iam_connection_string
  sensitive = true
}

output "legal_connection_string" {
  value     = module.postgres.legal_connection_string
  sensitive = true
}

# ---------- Keycloak ----------

output "keycloak_realm_id" {
  value = module.keycloak.realm_id
}

output "keycloak_google_idp_alias" {
  value = module.keycloak.google_idp_alias
}

output "keycloak_app_client_id" {
  value = module.keycloak.app_client_id
}

output "keycloak_app_client_secret" {
  value     = module.keycloak.app_client_secret
  sensitive = true
}
