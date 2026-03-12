output "realm_id" {
  value = keycloak_realm.global.id
}

output "google_idp_alias" {
  value = keycloak_oidc_google_identity_provider.google.alias
}

output "app_client_id" {
  value = keycloak_openid_client.app.client_id
}

output "app_client_secret" {
  value     = keycloak_openid_client.app.client_secret
  sensitive = true
}

output "admin_api_client_id" {
  value = keycloak_openid_client.admin_api.client_id
}

output "admin_api_client_secret" {
  value     = keycloak_openid_client.admin_api.client_secret
  sensitive = true
}
