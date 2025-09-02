#!/usr/bin/env node

const { testConnection, healthCheck } = require('./connection');
const { runMigrations, getMigrationStatus, verifyMigrations } = require('./migrations');
const { Pool } = require('pg');
require('dotenv').config();

// Database setup configuration
const setupConfig = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'driver_onboarding',
  password: process.env.DB_PASSWORD || 'kivy',
  port: process.env.DB_PORT || 5432,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
};
console.log(setupConfig);

// Create database if it doesn't exist
const createDatabase = async () => {
  try {
    // Connect to postgres database to create our database
    const postgresPool = new Pool({
      ...setupConfig,
      database: 'postgres'
    });

    console.log('🔄 Creating database...');
    
    // Check if database exists
    const dbExists = await postgresPool.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [setupConfig.database]
    );

    if (dbExists.rows.length === 0) {
      // Create database
      await postgresPool.query(`CREATE DATABASE "${setupConfig.database}"`);
      console.log(`✅ Database '${setupConfig.database}' created successfully`);
    } else {
      console.log(`ℹ️ Database '${setupConfig.database}' already exists`);
    }

    await postgresPool.end();
    return true;
  } catch (error) {
    console.error('❌ Error creating database:', error.message);
    return false;
  }
};

// Setup database user and permissions
const setupDatabaseUser = async () => {
  try {
    console.log('🔄 Setting up database user...');
    
    // This would typically be done by a database administrator
    // For development, we'll just log the commands
    console.log('📋 Database setup commands (run as postgres superuser):');
    console.log(`CREATE USER ${setupConfig.user} WITH PASSWORD '${setupConfig.password}';`);
    console.log(`GRANT ALL PRIVILEGES ON DATABASE "${setupConfig.database}" TO ${setupConfig.user};`);
    console.log(`GRANT ALL PRIVILEGES ON SCHEMA public TO ${setupConfig.user};`);
    console.log(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${setupConfig.user};`);
    console.log(`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${setupConfig.user};`);
    
    return true;
  } catch (error) {
    console.error('❌ Error setting up database user:', error.message);
    return false;
  }
};

// Main setup function
const setupDatabase = async () => {
  try {
    console.log('🚀 Starting database setup...\n');
    
    // Step 1: Create database
    const dbCreated = await createDatabase();
    if (!dbCreated) {
      console.error('❌ Failed to create database');
      process.exit(1);
    }
    
    // Step 2: Setup user (informational)
    await setupDatabaseUser();
    
    // Step 3: Test connection
    console.log('\n🔄 Testing database connection...');
    const connected = await testConnection();
    if (!connected) {
      console.error('❌ Failed to connect to database');
      console.log('💡 Please ensure:');
      console.log('   - PostgreSQL is running');
      console.log('   - Database credentials are correct');
      console.log('   - User has proper permissions');
      process.exit(1);
    }
    
    // Step 4: Run migrations
    console.log('\n🔄 Running database migrations...');
    await runMigrations();
    
    // Step 5: Verify migrations
    console.log('\n🔄 Verifying migrations...');
    const migrationsValid = await verifyMigrations();
    if (!migrationsValid) {
      console.error('❌ Migration verification failed');
      process.exit(1);
    }
    
    // Step 6: Health check
    console.log('\n🔄 Running health check...');
    const health = await healthCheck();
    if (health.status === 'healthy') {
      console.log('✅ Database health check passed');
      console.log(`📊 PostgreSQL Version: ${health.version}`);
      console.log(`🕐 Current Time: ${health.timestamp}`);
      console.log(`🔌 Pool Status: ${health.pool.totalCount} total, ${health.pool.idleCount} idle, ${health.pool.waitingCount} waiting`);
    } else {
      console.error('❌ Database health check failed');
      process.exit(1);
    }
    
    // Step 7: Show migration status
    console.log('\n🔄 Migration status:');
    const migrations = await getMigrationStatus();
    if (migrations.length === 0) {
      console.log('ℹ️ No migrations applied yet');
    } else {
      console.log(`📋 Applied migrations (${migrations.length}):`);
      migrations.forEach(migration => {
        console.log(`   - ${migration.version}: ${migration.name} (${migration.execution_time}ms)`);
      });
    }
    
    console.log('\n🎉 Database setup completed successfully!');
    console.log('\n📚 Next steps:');
    console.log('   1. Update your .env file with database credentials');
    console.log('   2. Start your application: npm run dev');
    console.log('   3. Test the API endpoints');
    console.log('\n🔑 Default admin credentials:');
    console.log('   Email: admin@company.com');
    console.log('   Password: AdminPass123');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    process.exit(1);
  }
};

// CLI commands
const showHelp = () => {
  console.log(`
🚗 Driver Onboarding Database Setup

Usage: node database/setup.js [command]

Commands:
  setup     - Complete database setup (default)
  status    - Show migration status
  verify    - Verify migration integrity
  help      - Show this help message

Environment Variables:
  DB_USER     - Database username (default: postgres)
  DB_HOST     - Database host (default: localhost)
  DB_NAME     - Database name (default: driver_onboarding)
  DB_PASSWORD - Database password (default: password)
  DB_PORT     - Database port (default: 5432)
  DB_SSL      - Enable SSL (default: false)

Examples:
  node database/setup.js setup
  node database/setup.js status
  DB_PASSWORD=mypassword node database/setup.js setup
`);
};

// Main execution
const main = async () => {
  const command = process.argv[2] || 'setup';
  
  switch (command) {
    case 'setup':
      await setupDatabase();
      break;
    case 'status':
      try {
        await testConnection();
        const migrations = await getMigrationStatus();
        console.log('📋 Migration Status:');
        if (migrations.length === 0) {
          console.log('ℹ️ No migrations applied');
        } else {
          migrations.forEach(migration => {
            console.log(`   - ${migration.version}: ${migration.name} (${migration.applied_at})`);
          });
        }
      } catch (error) {
        console.error('❌ Error getting migration status:', error.message);
      }
      break;
    case 'verify':
      try {
        await testConnection();
        await verifyMigrations();
      } catch (error) {
        console.error('❌ Error verifying migrations:', error.message);
      }
      break;
    case 'help':
      showHelp();
      break;
    default:
      console.error(`❌ Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  });
}

module.exports = {
  setupDatabase,
  createDatabase,
  setupDatabaseUser
}; 