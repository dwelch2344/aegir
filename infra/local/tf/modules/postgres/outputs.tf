output "iam_connection_string" {
  value     = "postgres://iam_svc:${var.iam_svc_password}@${var.host}:${var.port}/${var.database}"
  sensitive = true
}

output "legal_connection_string" {
  value     = "postgres://legal_svc:${var.legal_svc_password}@${var.host}:${var.port}/${var.database}"
  sensitive = true
}
