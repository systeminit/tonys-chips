#!/bin/sh
set -e

echo "Starting Tony's Chips API..."

# Wait for database to be ready
echo "Checking database connectivity..."
until node -e "
const { getPrismaClient } = require('./dist/config/database');
(async () => {
  try {
    const prisma = await getPrismaClient();
    await prisma.\$queryRaw\`SELECT 1\`;
    console.log('Database is ready');
    process.exit(0);
  } catch (error) {
    console.error('Database not ready:', error.message);
    process.exit(1);
  }
})();
" 2>/dev/null; do
  echo "Waiting for database to be ready..."
  sleep 2
done

# Run Prisma migrations with IAM authentication
echo "Running database migrations..."
node scripts/run-migrations.js

# Check migration status
if [ $? -eq 0 ]; then
  echo "Migrations completed successfully"
else
  echo "ERROR: Migrations failed"
  exit 1
fi

# Generate Prisma Client (in case schema changed)
echo "Ensuring Prisma Client is up to date..."
npx prisma generate

# Seed database if empty (idempotent - only runs if no products exist)
echo "Seeding database if needed..."
npm run db:seed

# Start the application
echo "Starting application..."
exec "$@"
