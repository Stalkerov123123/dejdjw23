#!/bin/sh
set -e

# Run database migrations
echo "Running database migrations..."
bunx prisma db push --skip-generate

# Start the application
exec "$@"
