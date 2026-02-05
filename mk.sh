#!/usr/bin/env bash
set -euo pipefail

cmd="${1:-help}"

case "$cmd" in
  dev)
    docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
    ;;
  help|-h|--help)
    echo "Usage: ./mk.sh dev"
    ;;
  *)
    echo "Unknown command: $cmd" >&2
    echo "Usage: ./mk.sh dev" >&2
    exit 1
    ;;
esac
