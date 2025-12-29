#!/usr/bin/env node

/**
 * Debug Script: Ver respuestas reales del API
 * 
 * Muestra exactamente qué retorna el backend para debugging
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
      
      console.log(`${colors.magenta}Status: ${res.statusCode}${colors.reset}`);
      console.log(`${colors.magenta}Headers: ${JSON.stringify(res.headers, null, 2)}${colors.reset}\n`);
      
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
  log.header('╚════════════════════════════════════════════════════════════╝');

  console.log(`${colors.cyan}Conectando a: http://localhost:3001/api/v1${colors.reset}\n`);

  // TEST 1: Usuario anónimo en ruta 1
  log.header('TEST 1: Usuario anónimo crea cluster en ruta 1');
  const user1 = `anon_${Date.now()}_1`;
  const resp1 = await makeRequest('/telemetria/registrar', {
    usuario_id: user1,
    es_registrado: false,
    latitud: -33.3870,
    longitud: -70.5450,
    velocidad: 15,
    precision_metros: 5,
    direccion: 180,
    id_ruta: 1
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
  log.header('TEST 2: Segundo usuario se une al primer cluster');
  const user2 = `anon_${Date.now()}_2`;
  const resp2 = await makeRequest('/telemetria/registrar', {
    usuario_id: user2,
    es_registrado: false,
    latitud: -33.38705,
    longitud: -70.54505,
    velocidad: 14,
    precision_metros: 5,
    direccion: 180,
    id_ruta: 1
  });

  log.info(`\nExtrayendo valores:`);
  console.log(`  • resp.data.success: ${resp2.data?.success}`);
  console.log(`  • resp.data.data.enBus: ${resp2.data?.data?.enBus}`);
  console.log(`  • resp.data.data.clusterId: ${resp2.data?.data?.clusterId}`);
  console.log(`  • resp.data.data.cantidadUsuarios: ${resp2.data?.data?.cantidadUsuarios}`);
  console.log(`  • resp.data.data.accion: ${resp2.data?.data?.accion}`);
  console.log(`  • Mismo cluster que user1? ${resp2.data?.data?.clusterId === clusterId ? 'SÍ ✅' : 'NO ❌'}`);

  await sleep(500);

  // TEST 3: Usuario anónimo registrado se une
  log.header('TEST 3: Usuario registrado se une al cluster');
  const resp3 = await makeRequest('/telemetria/registrar', {
    usuario_id: 999, // ID registrado
    es_registrado: true,
    latitud: -33.3871,
    longitud: -70.5451,
    velocidad: 13,
    precision_metros: 5,
    direccion: 180,
    id_ruta: 1
  });

  log.info(`\nExtrayendo valores:`);
  console.log(`  • resp.data.success: ${resp3.data?.success}`);
  console.log(`  • resp.data.data.enBus: ${resp3.data?.data?.enBus}`);
  console.log(`  • resp.data.data.clusterId: ${resp3.data?.data?.clusterId}`);
  console.log(`  • resp.data.data.cantidadUsuarios: ${resp3.data?.data?.cantidadUsuarios}`);
  console.log(`  • Mismo cluster? ${resp3.data?.data?.clusterId === clusterId ? 'SÍ ✅' : 'NO ❌'}`);

  await sleep(500);

  // TEST 4: Usuario intenta unirse pero está muy lejos
  log.header('TEST 4: Usuario muy lejos (debe estar solo o fallar)');
  const user4 = `anon_${Date.now()}_4`;
  const resp4 = await makeRequest('/telemetria/registrar', {
    usuario_id: user4,
    es_registrado: false,
    latitud: -33.3780, // ~1km al norte
    longitud: -70.5550, // ~1km al oeste
    velocidad: 15,
    precision_metros: 5,
    direccion: 180,
    id_ruta: 1
  });

  log.info(`\nExtrayendo valores:`);
  console.log(`  • resp.data.success: ${resp4.data?.success}`);
  console.log(`  • resp.data.data.enBus: ${resp4.data?.data?.enBus}`);
  console.log(`  • resp.data.data.clusterId: ${resp4.data?.data?.clusterId}`);
  console.log(`  • resp.data.data.accion: ${resp4.data?.data?.accion}`);
  console.log(`  • resp.data.data.cantidadUsuariosCercanos: ${resp4.data?.data?.cantidadUsuariosCercanos}`);

  // TEST 5: Usuario registrado reutiliza su cluster
  log.header('TEST 5: Usuario registrado reutiliza su cluster');
  const resp5 = await makeRequest('/telemetria/registrar', {
    usuario_id: 999,
    es_registrado: true,
    latitud: -33.38712,
    longitud: -70.54512,
    velocidad: 14,
    precision_metros: 5,
    direccion: 180,
    id_ruta: 1
  });

  log.info(`\nExtrayendo valores:`);
  console.log(`  • resp.data.success: ${resp5.data?.success}`);
  console.log(`  • resp.data.data.enBus: ${resp5.data?.data?.enBus}`);
  console.log(`  • resp.data.data.clusterId: ${resp5.data?.data?.clusterId}`);
  console.log(`  • resp.data.data.accion: ${resp5.data?.data?.accion}`);
  console.log(`  • resp.data.data.cantidadUsuarios: ${resp5.data?.data?.cantidadUsuarios}`);
  console.log(`  • Mismo cluster que TEST 3? ${resp5.data?.data?.clusterId === resp3.data?.data?.clusterId ? 'SÍ ✅' : 'NO ❌'}`);

  log.header('╔════════════════════════════════════════════════════════════╗');
  log.header('║                    FIN DE DEBUG                             ║');
  log.header('╚════════════════════════════════════════════════════════════╝');

  log.info('\n📊 Resumen:');
  console.log(`  • Usuario 1 cluster: ${clusterId}`);
  console.log(`  • Usuario 2 se unió: ${resp2.data?.data?.clusterId === clusterId ? 'SÍ ✅' : 'NO ❌'}`);
  console.log(`  • Usuario 3 se unió: ${resp3.data?.data?.clusterId === clusterId ? 'SÍ ✅' : 'NO ❌'}`);
  console.log(`  • Conteo final: ${resp5.data?.data?.cantidadUsuarios} usuarios`);
  console.log(`  • Acción reutilización: ${resp5.data?.data?.accion}`);

  console.log('');
}

main().catch(err => {
  log.error(`Error: ${err.message}`);
  process.exit(1);
});
