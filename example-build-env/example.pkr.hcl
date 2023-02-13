locals {
  # This exact timestamp format is not required and can be customized
  timestamp = formatdate("YYYYMMDDhhmm", timestamp())
}

variable "aws_region" {
  default = env("AWS_REGION")
}

variable "image_name_prefix" {
  default = env("IMAGE_NAME_PREFIX")
}

variable "instance_profile" {
  default = env("INSTANCE_PROFILE_NAME")
}

variable "root_device_name" {
  default = env("ROOT_DEVICE_NAME")
}

packer {
  required_plugins {
    amazon = {
      version = ">= 0.0.2"
      source  = "github.com/hashicorp/amazon"
    }
  }
}

source "amazon-ebs" "base" {
  ami_name             = "${var.image_name_prefix}-${local.timestamp}"
  region               = var.aws_region
  iam_instance_profile = var.instance_profile

  launch_block_device_mappings {
    device_name = var.root_device_name

    ### Everything above here is required for the build to work ###
    # The rest of the file is an example of a simple image derived from Ubuntu 22.04

    delete_on_termination = true
    volume_type           = "gp3"
    volume_size           = 32
  }

  instance_type = "t3.micro"

  source_ami_filter {
    filters = {
      name                = "ubuntu/images/*ubuntu-jammy-22.04-amd64-server-*"
      root-device-type    = "ebs"
      virtualization-type = "hvm"
    }
    owners      = ["099720109477"]
    most_recent = true
  }

  ssh_username = "ubuntu"
}

build {
  name = var.image_name_prefix # This can be changed

  provisioner "shell" {
    inline = [
      # IMPORTANT - wait for instance to finish initializing
      "cloud-init status --wait",
      "sudo bash /tmp/setup.sh"
    ]
  }

  sources = [
    "source.amazon-ebs.base"
  ]
}
