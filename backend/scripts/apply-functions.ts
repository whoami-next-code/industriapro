import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Cargar .env
dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
  console.log('🔌 Conectando a la base de datos remota de Supabase...');
  
  const connectionConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      }
    : {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432'),
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
        ssl: { rejectUnauthorized: false },
      };

  // Remove sslmode from connectionString if it exists to avoid conflicts with ssl config object
  if (connectionConfig.connectionString && connectionConfig.connectionString.includes('sslmode=')) {
     // This is a simplistic replacement, but effective for the common case
     connectionConfig.connectionString = connectionConfig.connectionString.replace(/[?&]sslmode=[^&]+/, '');
  }

  const client = new Client(connectionConfig);

  try {
    await client.connect();
    console.log('✅ Conectado exitosamente.');

    const sqlPath = path.join(__dirname, 'sql/20260111_functions_and_triggers.sql');
    if (!fs.existsSync(sqlPath)) {
        throw new Error(`Archivo SQL no encontrado: ${sqlPath}`);
    }
    
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log(`📜 Ejecutando script de migración: ${path.basename(sqlPath)}`);
    
    await client.query(sql);
    
    console.log('✨ Migración completada exitosamente.');

  } catch (err) {
    console.error('❌ Error ejecutando la migración:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
