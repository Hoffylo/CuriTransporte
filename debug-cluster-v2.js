#!/usr/bin/env node

/**
 * Debug Script: Validar lógica de unión de clusters
 *
 * ACTUALIZADO: Usa puntos dentro de la ruta 3
 */

const http = require('http');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✅${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}❌${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.cyan}ℹ️${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.bright}${colors.blue}${msg}${colors.reset}\n`),
  json: (data) => console.log(JSON.stringify(data, null, 2)),
  warn: (msg) => console.log(`${colors.yellow}⚠️${colors.reset} ${msg}`)
};

// Coordenadas alineadas con la ruta 3 (Linares) para evitar FUERA_DE_RUTA
const RUTA_ID = 3;
const coords = {
  base: { lat: -34.9762016, lon: -71.2566966 },
  cerca1: { lat: -34.97618, lon: -71.25664 },
  cerca2: { lat: -34.97616, lon: -71.25661 },
  lejos: { lat: -34.9816193, lon: -71.2442931 },
  reuse: { lat: -34.975525, lon: -71.2589861 },
  fueraCorridor: { lat: -34.95, lon: -71.15 }
};

function makeRequest(endpoint, data) {
  return new Promise((resolve) => {
    const postData = JSON.stringify(data);
    
    log.info(`POST ${endpoint}`);
    log.info(`Body: ${postData}`);

    const options = {
      hostname: 'localhost',
      port: 3001,
      path: `/api/v1${endpoint}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      
      console.log(`${colors.magenta}Status: ${res.statusCode}${colors.reset}\n`);
      
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          log.json(data);
          resolve({ success: res.statusCode === 200, data, status: res.statusCode });
        } catch (e) {
          log.error(`Parse error: ${e.message}`);
          log.warn(`Raw response: ${body}`);
          resolve({ success: false, data: null, status: res.statusCode });
        }
      });
    });

    req.on('error', (error) => {
      log.error(`Connection error: ${error.message}`);
      resolve({ success: false, data: null, status: 0 });
    });

    req.write(postData);
    req.end();
  });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  log.header('╔════════════════════════════════════════════════════════════╗');
  log.header('║        DEBUG: Respuestas del API de Telemetría              ║');
  log.header('║     (ACTUALIZADO: Puntos válidos sobre la ruta 3)           ║');
  log.header('╚════════════════════════════════════════════════════════════╝');

  console.log(`${colors.cyan}Conectando a: http://localhost:3001/api/v1${colors.reset}\n`);

  const userReg = `anon_${Date.now()}_reg`; // Se reutiliza en tests 3 y 5

  // TEST 1: Usuario anónimo en ruta 3
  log.header('TEST 1: Usuario anónimo crea cluster en ruta 3');
  const user1 = `anon_${Date.now()}_1`;
  const resp1 = await makeRequest('/telemetria/registrar', {
    usuario_id: user1,
    es_registrado: false,
    latitud: coords.base.lat,
    longitud: coords.base.lon,
    velocidad: 15,
    precision_metros: 5,
    direccion: 180,
    id_ruta: RUTA_ID
  });

  if (!resp1.success) {
    log.error('No hay respuesta del servidor');
    log.warn('¿Está corriendo el backend? Ejecuta: cd api && npm run dev');
    process.exit(1);
  }

  const clusterId = resp1.data?.data?.clusterId;
  
  log.info(`\nExtrayendo valores:`);
  console.log(`  • resp.data.success: ${resp1.data?.success}`);
  console.log(`  • resp.data.data.enBus: ${resp1.data?.data?.enBus}`);
  console.log(`  • resp.data.data.clusterId: ${clusterId}`);
  console.log(`  • resp.data.data.cantidadUsuarios: ${resp1.data?.data?.cantidadUsuarios}`);
  console.log(`  • resp.data.data.accion: ${resp1.data?.data?.accion}`);
  console.log(`  • resp.data.data.paraderosCercano: ${resp1.data?.data?.paraderosCercano?.nom_paradero || 'null'}`);

  await sleep(500);

  // TEST 2: Usuario se une al mismo cluster
  log.header('TEST 2: Segundo usuario se une al primer cluster (misma ruta 3)');
  const user2 = `anon_${Date.now()}_2`;
  const resp2 = await makeRequest('/telemetria/registrar', {
    usuario_id: user2,
    es_registrado: false,
    latitud: coords.cerca1.lat,
    longitud: coords.cerca1.lon,
    velocidad: 14,
    precision_metros: 5,
    direccion: 180,
    id_ruta: RUTA_ID
  });

  log.info(`\nExtrayendo valores:`);
  console.log(`  • resp.data.success: ${resp2.data?.success}`);
  console.log(`  • resp.data.data.enBus: ${resp2.data?.data?.enBus}`);
  console.log(`  • resp.data.data.clusterId: ${resp2.data?.data?.clusterId}`);
  console.log(`  • resp.data.data.cantidadUsuarios: ${resp2.data?.data?.cantidadUsuarios}`);
  console.log(`  • resp.data.data.accion: ${resp2.data?.data?.accion}`);
  console.log(`  • Mismo cluster que user1? ${resp2.data?.data?.clusterId === clusterId ? 'SÍ ✅' : 'NO ❌'}`);

  await sleep(500);

  // TEST 3: Usuario registrado se une
  log.header('TEST 3: Usuario registrado se une al cluster');
  const resp3 = await makeRequest('/telemetria/registrar', {
    usuario_id: userReg,
    es_registrado: false,
    latitud: coords.cerca2.lat,
    longitud: coords.cerca2.lon,
    velocidad: 13,
    precision_metros: 5,
    direccion: 180,
    id_ruta: RUTA_ID
  });

  log.info(`\nExtrayendo valores:`);
  console.log(`  • resp.data.success: ${resp3.data?.success}`);
  console.log(`  • resp.data.data.enBus: ${resp3.data?.data?.enBus}`);
  console.log(`  • resp.data.data.clusterId: ${resp3.data?.data?.clusterId}`);
  console.log(`  • resp.data.data.cantidadUsuarios: ${resp3.data?.data?.cantidadUsuarios}`);
  console.log(`  • Mismo cluster? ${resp3.data?.data?.clusterId === clusterId ? 'SÍ ✅' : 'NO ❌'}`);

  await sleep(500);

  // TEST 4: Usuario muy lejos
  log.header('TEST 4: Usuario lejos en la misma ruta (debería crear su cluster)');
  const user4 = `anon_${Date.now()}_4`;
  const resp4 = await makeRequest('/telemetria/registrar', {
    usuario_id: user4,
    es_registrado: false,
    latitud: coords.lejos.lat,
    longitud: coords.lejos.lon,
    velocidad: 15,
    precision_metros: 5,
    direccion: 180,
    id_ruta: RUTA_ID
  });

  log.info(`\nExtrayendo valores:`);
  console.log(`  • resp.data.success: ${resp4.data?.success}`);
  console.log(`  • resp.data.data.enBus: ${resp4.data?.data?.enBus}`);
  console.log(`  • resp.data.data.clusterId: ${resp4.data?.data?.clusterId}`);
  console.log(`  • resp.data.data.accion: ${resp4.data?.data?.accion}`);
  console.log(`  • resp.data.data.cantidadUsuariosCercanos: ${resp4.data?.data?.cantidadUsuariosCercanos}`);

  await sleep(500);

  // TEST 5: Usuario registrado reutiliza su cluster
  log.header('TEST 5: Usuario registrado reutiliza su cluster');
  const resp5 = await makeRequest('/telemetria/registrar', {
    usuario_id: userReg,
    es_registrado: false,
    latitud: coords.reuse.lat,
    longitud: coords.reuse.lon,
    velocidad: 14,
    precision_metros: 5,
    direccion: 180,
    id_ruta: RUTA_ID
  });

  log.info(`\nExtrayendo valores:`);
  console.log(`  • resp.data.success: ${resp5.data?.success}`);
  console.log(`  • resp.data.data.enBus: ${resp5.data?.data?.enBus}`);
  console.log(`  • resp.data.data.clusterId: ${resp5.data?.data?.clusterId}`);
  console.log(`  • resp.data.data.accion: ${resp5.data?.data?.accion}`);
  console.log(`  • resp.data.data.cantidadUsuarios: ${resp5.data?.data?.cantidadUsuarios}`);
  console.log(`  • Mismo cluster que TEST 3? ${resp5.data?.data?.clusterId === resp3.data?.data?.clusterId ? 'SÍ ✅' : 'NO ❌'}`);

  // TEST 6: Usuario reporta posición fuera del corredor
  log.header('TEST 6: Usuario fuera del corredor esperado (debe marcar desvío/fuera_de_ruta)');
  const resp6 = await makeRequest('/telemetria/registrar', {
    usuario_id: `anon_${Date.now()}_6`,
    es_registrado: false,
    latitud: coords.fueraCorridor.lat,
    longitud: coords.fueraCorridor.lon,
    velocidad: 15,
    precision_metros: 5,
    direccion: 0,
    id_ruta: RUTA_ID
  });

  log.info(`\nExtrayendo valores:`);
  console.log(`  • resp.data.success: ${resp6.data?.success}`);
  console.log(`  • resp.data.data.enBus: ${resp6.data?.data?.enBus}`);
  console.log(`  • resp.data.data.accion: ${resp6.data?.data?.accion}`);
  console.log(`  • Si es DESVIO_*: El sistema detectó cambio de ruta ✅`);

  log.header('╔════════════════════════════════════════════════════════════╗');
  log.header('║                    FIN DE DEBUG                             ║');
  log.header('╚════════════════════════════════════════════════════════════╝');

  log.info('\n📊 Resumen de Resultados:');
  console.log(`  • Ruta 3 usuarios creados: ${clusterId ? 'SÍ ✅' : 'NO ❌'}`);
  console.log(`  • Usuario 2 se unió: ${resp2.data?.data?.clusterId === clusterId ? 'SÍ ✅' : 'NO ❌'}`);
  console.log(`  • Usuario registrado se unió: ${resp3.data?.data?.clusterId === clusterId ? 'SÍ ✅' : 'NO ❌'}`);
  console.log(`  • Usuario lejano creo/unio cluster: ${resp4.data?.success ? 'SÍ ✅' : 'NO ❌'}`);
  console.log(`  • Usuario reutiliza cluster: ${resp5.data?.data?.accion === 'ACTUALIZADO' || resp5.data?.data?.accion === 'UNIDO_A_CLUSTER' ? 'SÍ ✅' : 'NO ❌'}`);
  console.log(`  • Desvío detectado en TEST 6: ${resp6.data?.data?.accion?.includes('DESVIO') || resp6.data?.data?.accion === 'FUERA_DE_RUTA' ? 'SÍ ✅' : 'NO ❌'}`);

  console.log('');
}

main().catch(err => {
  log.error(`Error: ${err.message}`);
  process.exit(1);
});
