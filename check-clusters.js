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

async function checkClusters() {
  try {
    await pool.query(`SET search_path TO ${process.env.DB_SCHEMA || 'tesis'}`);
    
    const result = await pool.query(`
      SELECT 
        id_cluster, 
        latitud_centro, 
        longitud_centro, 
        cantidad_usuarios, 
        id_ruta, 
        esta_activo,
        fecha_creacion,
        ultima_actualizacion
      FROM clusters 
      WHERE id_ruta = 2 
        AND fecha_creacion > NOW() - INTERVAL '1 hour'
      ORDER BY id_cluster DESC 
      LIMIT 10
    `);
    
    console.log('\n🔍 Clusters para ruta 2 (última hora):');
    console.log('='.repeat(120));
    console.table(result.rows);
    
    // Buscar clusters duplicados (muy cercanos)
    const duplicates = await pool.query(`
      SELECT 
        c1.id_cluster as cluster1,
        c2.id_cluster as cluster2,
        ST_Distance(c1.geom, c2.geom::geography) as distancia_metros,
        c1.cantidad_usuarios as usuarios1,
        c2.cantidad_usuarios as usuarios2,
        c1.esta_activo as activo1,
        c2.esta_activo as activo2
      FROM clusters c1
      JOIN clusters c2 ON c1.id_cluster < c2.id_cluster
      WHERE c1.id_ruta = 2 
        AND c2.id_ruta = 2
        AND c1.fecha_creacion > NOW() - INTERVAL '1 hour'
        AND ST_Distance(c1.geom, c2.geom::geography) < 100
      ORDER BY distancia_metros ASC
    `);
    
    if (duplicates.rows.length > 0) {
      console.log('\n⚠️ Clusters duplicados/cercanos (< 100m):');
      console.log('='.repeat(120));
      console.table(duplicates.rows);
    } else {
      console.log('\n✅ No hay clusters duplicados/cercanos');
    }
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error);
    await pool.end();
  }
}

checkClusters();
