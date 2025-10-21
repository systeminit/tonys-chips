#!/usr/bin/env node
/**
 * Script to run Prisma migrations with IAM authentication
 *
 * This script:
 * 1. Builds the DATABASE_URL with a fresh IAM token
 * 2. Sets it as an environment variable
 * 3. Executes prisma migrate deploy
 */

const { buildDatabaseUrl } = require('../dist/config/secrets');
const { execSync } = require('child_process');

async function runMigrations() {
  try {
    console.log('Building database URL with IAM authentication...');

    // Build DATABASE_URL with IAM token
    const databaseUrl = await buildDatabaseUrl();
    process.env.DATABASE_URL = databaseUrl;

    console.log('Running Prisma migrations...');

    // Run prisma migrate deploy with the DATABASE_URL set
    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: databaseUrl }
    });

    console.log('Migrations completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

runMigrations();
