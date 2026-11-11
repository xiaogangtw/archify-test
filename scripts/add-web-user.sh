#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
umask 077
name=${1:-}
case "$name" in ''|*[!A-Za-z0-9_.-]*) printf '%s\n' 'Usage: sh scripts/add-web-user.sh username (letters, digits, _, ., -)'; exit 1;; esac
mkdir -p .local
touch .local/web-users
# htpasswd prompts on the terminal; the password is never a command argument.
docker run --rm -it --user "$(id -u):$(id -g)" -v "$(pwd)/.local:/users" --entrypoint htpasswd httpd:2.4-alpine -B /users/web-users "$name"
chmod 644 .local/web-users
printf '%s\n' 'Account saved. User identities protect Android device controls; the rest of the workspace is shared.'
