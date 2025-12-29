require('dotenv').config({ path: './api/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }
});

async function cleanupDuplicates() {
  try {
    await pool.query(`SET search_path TO ${process.env.DB_SCHEMA || 'tesis'}`);
    
    console.log('🧹 Limpiando clusters duplicados...\n');
    
    // Encontrar clusters muy cercanos entre sí
    const duplicates = await pool.query(`
      WITH nearby_pairs AS (
        SELECT 
          c1.id_cluster as cluster_keep,
          c2.id_cluster as cluster_remove,
          ST_Distance(c1.geom, c2.geom::geography) as distancia_metros,
          c1.fecha_creacion as fecha1,
          c2.fecha_creacion as fecha2
        FROM clusters c1
        JOIN clusters c2 ON c1.id_cluster < c2.id_cluster
        WHERE c1.id_ruta = c2.id_ruta
          AND ST_Distance(c1.geom, c2.geom::geography) < 80
          AND c1.fecha_creacion > NOW() - INTERVAL '24 hours'
        ORDER BY distancia_metros ASC
      )
      SELECT * FROM nearby_pairs
    `);
    
    if (duplicates.rows.length === 0) {
      console.log('✅ No hay clusters duplicados para limpiar');
      await pool.end();
      return;
    }
    
    console.log(`⚠️ Encontrados ${duplicates.rows.length} pares de clusters duplicados:\n`);
    console.table(duplicates.rows);
    
    // Marcar clusters duplicados como inactivos (mantener el más antiguo)
    for (const pair of duplicates.rows) {
      console.log(`\n🗑️ Desactivando cluster ${pair.cluster_remove} (a ${Math.round(pair.distancia_metros)}m del ${pair.cluster_keep})`);
      
      // Reasignar ubicaciones al cluster que se mantiene
      await pool.query(`
        UPDATE ubicacion 
        SET id_cluster = $1
        WHERE id_cluster = $2
      `, [pair.cluster_keep, pair.cluster_remove]);
      
      // Marcar cluster duplicado como inactivo
      await pool.query(`
        UPDATE clusters
        SET esta_activo = FALSE
        WHERE id_cluster = $1
      `, [pair.cluster_remove]);
    }
    
    console.log('\n✅ Limpieza completada');
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error);
    await pool.end();
  }
}

cleanupDuplicates();
