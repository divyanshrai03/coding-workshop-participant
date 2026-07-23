resource "random_id" "this" {
  byte_length = 4

  keepers = {
    seed_input = try(var.aws_app_code, terraform.workspace)
  }
}

resource "random_pet" "this" {
  length    = 3
  separator = "-"

  keepers = {
    seed_input = try(var.aws_app_code, terraform.workspace)
  }
}

# Signing secret for application-issued JWTs, injected into every Lambda as
# JWT_SECRET alongside the auto-generated Postgres credentials (see locals.tf).
resource "random_password" "jwt_secret" {
  length  = 64
  special = false

  keepers = {
    seed_input = try(var.aws_app_code, terraform.workspace)
  }
}
