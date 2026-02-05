#!/bin/sh
set -e

echo "Initializing database..."
prisma db push --schema=./prisma/schema.prisma --url="file:./prisma/freesearch.db"

echo "Starting server..."
exec node server.js
