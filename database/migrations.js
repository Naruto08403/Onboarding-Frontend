const { query, transaction } = require('./connection');
const fs = require('fs').promises;
const path = require('path');

// Migration table to track applied migrations
const createMigrationsTable = async () => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        version VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(500) NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        checksum VARCHAR(64) NOT NULL,
        execution_time INTEGER NOT NULL
      )
    `);
    console.log('✅ Migrations table created/verified');
  } catch (error) {
    console.error('❌ Error creating migrations table:', error.message);
    throw error;
  }
};

// Get applied migrations
const getAppliedMigrations = async () => {
  try {
    const result = await query('SELECT version FROM migrations ORDER BY version');
    return result.rows.map(row => row.version);
  } catch (error) {
    console.error('❌ Error getting applied migrations:', error.message);
    return [];
  }
};

// Apply a single migration
const applyMigration = async (version, name, sql, checksum) => {
  const startTime = Date.now();
  
  try {
    await transaction(async (client) => {
      // Temporarily disable foreign key constraints
      await client.query('SET session_replication_role = replica;');
      
      // Split SQL into individual statements
      const statements = sql
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

      // Execute each statement
      for (const statement of statements) {
        if (statement.trim()) {
          await client.query(statement);
        }
      }

      // Re-enable foreign key constraints
      await client.query('SET session_replication_role = DEFAULT;');

      // Record the migration
      await client.query(
        'INSERT INTO migrations (version, name, checksum, execution_time) VALUES ($1, $2, $3, $4)',
        [version, name, checksum, Date.now() - startTime]
      );
    });

    console.log(`✅ Migration ${version} (${name}) applied successfully`);
    return true;
  } catch (error) {
    console.error(`❌ Migration ${version} (${name}) failed:`, error.message);
    throw error;
  }
};

// Generate checksum for SQL content
const generateChecksum = (content) => {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(content).digest('hex');
};

// Run all pending migrations
const runMigrations = async () => {
  try {
    console.log('🔄 Starting database migrations...');
    
    // Ensure migrations table exists
    await createMigrationsTable();
    
    // Get applied migrations
    const appliedMigrations = await getAppliedMigrations();
    
    // Get migration files
    const migrationsDir = path.join(__dirname, 'migration-files');
    const migrationFiles = await fs.readdir(migrationsDir);
    
    // Filter and sort migration files
    const pendingMigrations = migrationFiles
      .filter(file => file.endsWith('.sql'))
      .sort()
      .filter(file => {
        const version = file.split('_')[0];
        return !appliedMigrations.includes(version);
      });

    if (pendingMigrations.length === 0) {
      console.log('✅ No pending migrations');
      return;
    }

    console.log(`📋 Found ${pendingMigrations.length} pending migrations`);

    // Apply each migration
    for (const file of pendingMigrations) {
      const filePath = path.join(migrationsDir, file);
      const sql = await fs.readFile(filePath, 'utf8');
      
      const version = file.split('_')[0];
      const name = file.replace('.sql', '').replace(/^\d+_/, '');
      const checksum = generateChecksum(sql);
      
      await applyMigration(version, name, sql, checksum);
    }

    console.log('🎉 All migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration process failed:', error.message);
    throw error;
  }
};

// Rollback last migration
const rollbackLastMigration = async () => {
  try {
    console.log('🔄 Rolling back last migration...');
    
    const result = await query(
      'SELECT * FROM migrations ORDER BY applied_at DESC LIMIT 1'
    );
    
    if (result.rows.length === 0) {
      console.log('ℹ️ No migrations to rollback');
      return;
    }
    
    const lastMigration = result.rows[0];
    console.log(`📋 Rolling back: ${lastMigration.version} (${lastMigration.name})`);
    
    // Note: This is a simplified rollback. In production, you'd want more sophisticated rollback logic
    await query('DELETE FROM migrations WHERE id = $1', [lastMigration.id]);
    
    console.log(`✅ Migration ${lastMigration.version} rolled back`);
  } catch (error) {
    console.error('❌ Rollback failed:', error.message);
    throw error;
  }
};

// Get migration status
const getMigrationStatus = async () => {
  try {
    const result = await query(`
      SELECT 
        version,
        name,
        applied_at,
        execution_time,
        checksum
      FROM migrations 
      ORDER BY version DESC
    `);
    
    return result.rows;
  } catch (error) {
    console.error('❌ Error getting migration status:', error.message);
    return [];
  }
};

// Create a new migration file
const createMigration = async (name) => {
  try {
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const fileName = `${timestamp}_${name}.sql`;
    const filePath = path.join(__dirname, 'migration-files', fileName);
    
    const template = `-- Migration: ${name}
-- Created: ${new Date().toISOString()}
-- Description: ${name}

-- Add your SQL statements here
-- Example:
-- CREATE TABLE example_table (
--     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--     name VARCHAR(255) NOT NULL,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );

-- Don't forget to add indexes if needed
-- CREATE INDEX idx_example_table_name ON example_table(name);
`;

    await fs.writeFile(filePath, template);
    console.log(`✅ Migration file created: ${fileName}`);
    return fileName;
  } catch (error) {
    console.error('❌ Error creating migration file:', error.message);
    throw error;
  }
};

// Verify migration integrity
const verifyMigrations = async () => {
  try {
    console.log('🔍 Verifying migration integrity...');
    
    const migrations = await getMigrationStatus();
    let allValid = true;
    
    for (const migration of migrations) {
      const filePath = path.join(__dirname, 'migration-files', `${migration.version}_${migration.name}.sql`);
      
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const checksum = generateChecksum(content);
        
        if (checksum !== migration.checksum) {
          console.error(`❌ Checksum mismatch for migration ${migration.version}`);
          allValid = false;
        }
      } catch (error) {
        console.error(`❌ Migration file not found: ${migration.version}_${migration.name}.sql`);
        allValid = false;
      }
    }
    
    if (allValid) {
      console.log('✅ All migrations verified successfully');
    } else {
      console.error('❌ Migration verification failed');
    }
    
    return allValid;
  } catch (error) {
    console.error('❌ Error verifying migrations:', error.message);
    return false;
  }
};

module.exports = {
  runMigrations,
  rollbackLastMigration,
  getMigrationStatus,
  createMigration,
  verifyMigrations,
  createMigrationsTable
}; 