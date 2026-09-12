#!/bin/sh
set -e

databasePath="${DATABASE_NAME:-masterMenuDatabase.db}"
case "$databasePath" in
    /*) ;;
    *) databasePath="/app/masterServer/$databasePath" ;;
esac

if [ "${INITIALIZE_EMPTY_DATABASE:-false}" != "true" ] && [ ! -f "$databasePath" ] && [ -f "/app/masterServer/masterMenuDatabase.db" ]; then
    mkdir -p "$(dirname "$databasePath")"
    cp "/app/masterServer/masterMenuDatabase.db" "$databasePath"
fi

exec "$@"
