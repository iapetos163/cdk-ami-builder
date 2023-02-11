#!/bin/bash

# This line ensures that errors in this script result in a build failure
set -euo pipefail

apt update
apt -y upgrade

# Install a bunch of software. That's it for the example
apt -y install apt-transport-https ca-certificates cowsay \
  curl gnupg-agent htop iftop iotop \
  iptraf jq nvme-cli software-properties-common tcpdump
