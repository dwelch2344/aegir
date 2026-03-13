variable "database" {
  description = "Target PostgreSQL database name"
  type        = string
}

variable "iam_svc_password" {
  description = "Password for the iam_svc role"
  type        = string
  sensitive   = true
}

variable "legal_svc_password" {
  description = "Password for the legal_svc role"
  type        = string
  sensitive   = true
}

variable "system_svc_password" {
  description = "Password for the system_svc role"
  type        = string
  sensitive   = true
}

variable "host" {
  description = "PostgreSQL host (used for connection string outputs)"
  type        = string
}

variable "port" {
  description = "PostgreSQL port (used for connection string outputs)"
  type        = number
}
