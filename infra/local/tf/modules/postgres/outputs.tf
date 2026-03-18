output "iam_connection_string" {
  value     = "postgres://iam_svc:${var.iam_svc_password}@${var.host}:${var.port}/${var.database}"
  sensitive = true
}

output "legal_connection_string" {
  value     = "postgres://legal_svc:${var.legal_svc_password}@${var.host}:${var.port}/${var.database}"
  sensitive = true
}

output "analytics_ro_connection_string" {
  value     = "postgres://analytics_ro:${var.analytics_ro_password}@${var.host}:${var.port}/${var.database}"
  sensitive = true
}

output "analytics_rw_connection_string" {
  value     = "postgres://analytics_rw:${var.analytics_rw_password}@${var.host}:${var.port}/${var.database}"
  sensitive = true
}
