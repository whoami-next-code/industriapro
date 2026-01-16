import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Cargar .env
dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
  console.log('🔌 Conectando a la base de datos remota de Supabase...');
  console.log(`Host: ${process.env.DB_HOST || 'Usando DATABASE_URL'}`);
  
  const clientConfig = process.env.DATABASE_URL 
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432'),
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
        ssl: { rejectUnauthorized: false },
      };

  const client = new Client(clientConfig);

  try {
    await client.connect();
    console.log('✅ Conectado exitosamente.');

    const defaultSqlPath = path.join(__dirname, 'sql/setup_supabase_sync.sql');
    const inputPath = process.argv[2];
    const sqlPath = inputPath ? path.resolve(process.cwd(), inputPath) : defaultSqlPath;

    if (!fs.existsSync(sqlPath)) {
        throw new Error(`Archivo SQL no encontrado: ${sqlPath}`);
    }
    
    console.log(`📜 Ejecutando script: ${sqlPath}`);
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    await client.query(sql);
    
    console.log('✨ Migración completada exitosamente.');
    console.log('   - Extensión UUID habilitada');
    console.log('   - Columna supabaseUid agregada a users');
    console.log('   - Función handle_new_user creada');
    console.log('   - Trigger on_auth_user_created activado');
    console.log('   - Políticas RLS configuradas');

  } catch (err) {
    console.error('❌ Error ejecutando la migración:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();