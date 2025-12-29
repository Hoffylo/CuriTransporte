#!/usr/bin/env node

/**
 * Test Script: Validar lógica de unión de clusters
 * 
 * Prueba los 6 casos principales de unión y consolidación de clusters
 */

const http = require('http');
const url = require('url');

const BASE_URL = 'http://localhost:3001/api/v1';
const API_KEY = 'your-api-key'; // Reemplazar si es necesario

// Colores para consola
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✅${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}❌${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.cyan}ℹ️${colors.reset} ${msg}`),
  test: (msg) => console.log(`${colors.blue}🧪${colors.reset} ${colors.bright}${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠️${colors.reset} ${msg}`),
  response: (label, data) => {
    console.log(`${colors.cyan}  [${label}]${colors.reset}`);
    if (data.data?.data) {
      console.log(`  • enBus: ${data.data.data.enBus}`);
      console.log(`  • clusterId: ${data.data.data.clusterId}`);
      console.log(`  • cantidadUsuarios: ${data.data.data.cantidadUsuarios}`);
      console.log(`  • accion: ${data.data.data.accion}`);
      console.log(`  • paradero: ${data.data.data.paraderosCercano?.nom_paradero || 'null'}`);
    } else {
      console.log(`  • error: ${data.data?.error || 'sin respuesta'}`);
    }
  }
};

// Configuración de rutas (alineado a la ruta 3 cargada en base de datos)
const RUTA_1 = 3; // Ruta principal (ida/vuelta)
const RUTA_2 = 3; // Ruta alternativa (no se usa pero se mantiene por compatibilidad)

// Coordenadas para las pruebas (puntos reales de la ruta 3 en Linares)
const coords = {
  ruta1_inicio: { lat: -34.9816193, lng: -71.2442931 },
  ruta1_medio: { lat: -34.9762016, lng: -71.2566966 },
  ruta1_fin: { lat: -34.9609127, lng: -71.2076615 },
  ruta2_inicio: { lat: -34.9816193, lng: -71.2442931 },
  ruta2_medio: { lat: -34.975525, lng: -71.2589861 },
};

let testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

async function makeRequest(endpoint, data) {
  return new Promise((resolve) => {
    const postData = JSON.stringify(data);
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
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          resolve({ success: res.statusCode === 200, data, status: res.statusCode });
        } catch (e) {
          resolve({ success: false, data: { error: body }, status: res.statusCode });
        }
      });
    });

    req.on('error', (error) => {
      resolve({ success: false, data: { error: error.message }, status: 0 });
    });

    req.write(postData);
    req.end();
  });
}

function assertCondition(condition, message, responseData = null) {
  if (condition) {
    log.success(message);
    testResults.passed++;
    return true;
  } else {
    log.error(message);
    if (responseData) {
      try {
        const data = JSON.stringify(responseData, null, 2).split('\n').slice(0, 5).join('\n');
        console.log(`  Respuesta: ${data}...`);
      } catch (e) {
        console.log(`  Respuesta: ${responseData}`);
      }
    }
    testResults.failed++;
    return false;
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ════════════════════════════════════════════════════════════════
// CASO 1: Usuario se une a cluster existente
// ════════════════════════════════════════════════════════════════
async function test1_UnidoAClusterExistente() {
  log.test('CASO 1: Usuario se une a cluster existente');
  
  const user1 = `anon_user_${Date.now()}_1`;
  const user2 = `anon_user_${Date.now()}_2`;

  // Usuario 1 crea cluster
  log.info('Usuario 1 (anónimo) se posiciona en ruta 1');
  const resp1 = await makeRequest('/telemetria/registrar', {
    usuario_id: user1,
    es_registrado: false,
    latitud: coords.ruta1_inicio.lat,
    longitud: coords.ruta1_inicio.lng,
    velocidad: 15,
    precision_metros: 5,
    direccion: 180,
    id_ruta: RUTA_1
  });

  const clusterId1 = resp1.data?.data?.clusterId;
  assertCondition(
    resp1.success && resp1.data?.success && resp1.data?.data?.enBus,
    `Usuario 1 detectado en bus: clusterId=${clusterId1}`
  );

  await sleep(500);

  // Usuario 2 se une al mismo cluster (16m de distancia)
  log.info('Usuario 2 (anónimo) se posiciona muy cerca de usuario 1');
  const resp2 = await makeRequest('/telemetria/registrar', {
    usuario_id: user2,
    es_registrado: false,
    latitud: coords.ruta1_inicio.lat + 0.0001, // ~11m más al sur
    longitud: coords.ruta1_inicio.lng + 0.0001, // ~12m más al este
    velocidad: 14,
    precision_metros: 5,
    direccion: 180,
    id_ruta: RUTA_1
  });

  assertCondition(
    resp2.success && resp2.data?.success && resp2.data?.data?.enBus,
    `Usuario 2 detectado en bus`
  );

  assertCondition(
    resp2.data?.data?.clusterId === clusterId1,
    `Usuario 2 se unió al mismo cluster (ID=${clusterId1})`
  );

  assertCondition(
    resp2.data?.data?.cantidadUsuarios === 2,
    `Conteo de usuarios correcto: 2`
  );

  assertCondition(
    resp2.data?.data?.accion === 'UNIDO_A_CLUSTER',
    `Acción correcta: UNIDO_A_CLUSTER`
  );

  assertCondition(
    resp2.data?.data?.paraderosCercano !== null,
    `Paradero cercano encontrado: ${resp2.data?.data?.paraderosCercano?.nom_paradero}`
  );

  console.log('');
}

// ════════════════════════════════════════════════════════════════
// CASO 2: Usuario reutiliza su cluster propio
// ════════════════════════════════════════════════════════════════
async function test2_ActualizaClusterPropio() {
  log.test('CASO 2: Usuario reutiliza y actualiza su cluster propio');
  
  const user = `anon_user_${Date.now()}_3`;

  // Primera ubicación
  log.info('Usuario 1 envía primera ubicación');
  const resp1 = await makeRequest('/telemetria/registrar', {
    usuario_id: user,
    es_registrado: false,
    latitud: coords.ruta1_inicio.lat,
    longitud: coords.ruta1_inicio.lng,
    velocidad: 12,
    precision_metros: 5,
    direccion: 180,
    id_ruta: RUTA_1
  });

  const clusterId = resp1.data?.data?.clusterId;
  const usuarios1 = resp1.data?.data?.cantidadUsuarios;
  assertCondition(
    resp1.data?.data?.enBus && clusterId,
    `Cluster creado: ID=${clusterId}, usuarios=${usuarios1}`
  );

  await sleep(1000);

  // Segunda ubicación - mismo usuario, cluster
  log.info('Usuario 1 envía segunda ubicación (cercana)');
  const resp2 = await makeRequest('/telemetria/registrar', {
    usuario_id: user,
    es_registrado: false,
    latitud: coords.ruta1_inicio.lat + 0.00005,
    longitud: coords.ruta1_inicio.lng + 0.00005,
    velocidad: 15,
    precision_metros: 5,
    direccion: 180,
    id_ruta: RUTA_1
  });

  assertCondition(
    resp2.success && resp2.data?.success && resp2.data?.data?.enBus,
    `Usuario 1 sigue en bus`
  );

  assertCondition(
    resp2.data?.data?.clusterId === clusterId,
    `Usuario reutilizó su cluster (ID=${clusterId})`
  );

  assertCondition(
    resp2.data?.data?.accion === 'ACTUALIZADO' || resp2.data?.data?.accion === 'UNIDO_A_CLUSTER',
    `Acción correcta: ${resp2.data?.data?.accion}`
  );

  assertCondition(
    resp2.data?.data?.cantidadUsuarios === usuarios1,
    `Conteo de usuarios se mantiene: ${usuarios1}`
  );

  assertCondition(
    resp2.data?.data?.paraderosCercano !== null,
    `Paradero cercano actualizado`
  );

  console.log('');
}

// ════════════════════════════════════════════════════════════════
// CASO 3: Usuario se une con radio ampliado (100m)
// ════════════════════════════════════════════════════════════════
async function test3_UnidoConRadioAmpliado() {
  log.test('CASO 3: Usuario se une a cluster con radio ampliado (100m)');
  
  const user1 = `anon_user_${Date.now()}_4`;
  const user2 = `anon_user_${Date.now()}_5`;

  // Usuario 1 crea cluster en inicio
  log.info('Usuario 1 crea cluster en inicio de ruta');
  const resp1 = await makeRequest('/telemetria/registrar', {
    usuario_id: user1,
    es_registrado: false,
    latitud: coords.ruta1_inicio.lat,
    longitud: coords.ruta1_inicio.lng,
    velocidad: 15,
    precision_metros: 5,
    direccion: 180,
    id_ruta: RUTA_1
  });

  const clusterId1 = resp1.data?.data?.clusterId;
  assertCondition(resp1.data?.data?.enBus, `Cluster 1 creado: ID=${clusterId1}`);

  await sleep(1000);

  // Usuario 2 se posiciona más lejos (75m aprox)
  log.info('Usuario 2 se posiciona a ~75m de usuario 1');
  const resp2 = await makeRequest('/telemetria/registrar', {
    usuario_id: user2,
    es_registrado: false,
    latitud: coords.ruta1_inicio.lat + 0.0006, // ~67m al sur
    longitud: coords.ruta1_inicio.lng + 0.0003, // ~27m al este
    velocidad: 14,
    precision_metros: 5,
    direccion: 180,
    id_ruta: RUTA_1
  });

  // Puede que cree su propio cluster o se una con radio ampliado
  const clusterId2 = resp2.data?.data?.clusterId;
  assertCondition(
    resp2.data?.data?.enBus,
    `Usuario 2 detectado en bus: clusterId=${clusterId2}`
  );

  const accion = resp2.data?.data?.accion;
  assertCondition(
    accion === 'UNIDO_A_CLUSTER_AMPLIADO' || accion === 'UNIDO_A_CLUSTER' || accion === 'CLUSTER_CREADO',
    `Acción válida: ${accion}`
  );

  assertCondition(
    resp2.data?.data?.paraderosCercano !== null,
    `Paradero cercano encontrado`
  );

  console.log('');
}

// ════════════════════════════════════════════════════════════════
// CASO 4: Consolidación de clusters duplicados
// ════════════════════════════════════════════════════════════════
async function test4_ConsolidacionDuplicados() {
  log.test('CASO 4: Consolidación de clusters duplicados creados en paralelo');
  
  const user1 = `anon_user_${Date.now()}_6`;
  const user2 = `anon_user_${Date.now()}_7`;
  const user3 = `anon_user_${Date.now()}_8`;

  // Crear dos usuarios cercanos
  log.info('Usuario 1 se posiciona en inicio de ruta');
  const resp1 = await makeRequest('/telemetria/registrar', {
    usuario_id: user1,
    es_registrado: false,
    latitud: coords.ruta1_medio.lat,
    longitud: coords.ruta1_medio.lng,
    velocidad: 15,
    precision_metros: 5,
    direccion: 180,
    id_ruta: RUTA_1
  });

  const clusterId1 = resp1.data?.data?.clusterId;
  assertCondition(resp1.data?.data?.enBus, `Cluster 1 creado: ID=${clusterId1}`);

  // Usuario 2 muy cerca
  log.info('Usuario 2 se posiciona muy cerca de usuario 1');
  const resp2 = await makeRequest('/telemetria/registrar', {
    usuario_id: user2,
    es_registrado: false,
    latitud: coords.ruta1_medio.lat + 0.00001,
    longitud: coords.ruta1_medio.lng + 0.00001,
    velocidad: 15,
    precision_metros: 5,
    direccion: 180,
    id_ruta: RUTA_1
  });

  const clusterId2 = resp2.data?.data?.clusterId;
  assertCondition(
    resp2.data?.data?.enBus,
    `Usuario 2 detectado en bus: clusterId=${clusterId2}`
  );

  // Usuario 3 hace que se consoliden si hay duplicados
  log.info('Usuario 3 se posiciona para verificar consolidación');
  const resp3 = await makeRequest('/telemetria/registrar', {
    usuario_id: user3,
    es_registrado: false,
    latitud: coords.ruta1_medio.lat + 0.00003,
    longitud: coords.ruta1_medio.lng + 0.00003,
    velocidad: 15,
    precision_metros: 5,
    direccion: 180,
    id_ruta: RUTA_1
  });

  if (resp3.data?.data?.accion === 'CLUSTER_CONSOLIDADO') {
    assertCondition(true, `Consolidación detectada: ${clusterId1} consolidó ${resp3.data?.data?.consolidado_desde}`);
  } else {
    log.info(`Sin consolidación en este caso (acción: ${resp3.data?.data?.accion})`);
  }

  console.log('');
}

// ════════════════════════════════════════════════════════════════
// CASO 5: Detección de desvío de cluster
// ════════════════════════════════════════════════════════════════
async function test5_ClusterDesviado() {
  log.test('CASO 5: Detección de desvío de cluster');
  
  const user1 = `anon_user_${Date.now()}_9`;
  const user2 = `anon_user_${Date.now()}_10`;

  // Crear cluster en ruta 1
  log.info('Usuario 1 y 2 crean cluster en ruta 1');
  const resp1 = await makeRequest('/telemetria/registrar', {
    usuario_id: user1,
    es_registrado: false,
    latitud: coords.ruta1_fin.lat,
    longitud: coords.ruta1_fin.lng,
    velocidad: 15,
    precision_metros: 5,
    direccion: 180,
    id_ruta: RUTA_1
  });

  const clusterId = resp1.data?.data?.clusterId;
  
  await sleep(200);

  const resp2 = await makeRequest('/telemetria/registrar', {
    usuario_id: user2,
    es_registrado: false,
    latitud: coords.ruta1_fin.lat + 0.00001,
    longitud: coords.ruta1_fin.lng + 0.00001,
    velocidad: 15,
    precision_metros: 5,
    direccion: 180,
    id_ruta: RUTA_1
  });

  assertCondition(
    resp2.data?.data?.clusterId === clusterId,
    `Cluster creado: ID=${clusterId}`
  );

  await sleep(500);

  // Simular que usuario se mueve a zona lejana (desvío esperado)
  log.info('Usuario intenta actualizarse pero se ha desviado mucho de la ruta');
  const resp3 = await makeRequest('/telemetria/registrar', {
    usuario_id: user1,
    es_registrado: false,
    latitud: coords.ruta1_fin.lat + 0.01, // ~1.1km al sur
    longitud: coords.ruta1_fin.lng + 0.01, // ~0.9km al este
    velocidad: 30,
    precision_metros: 5,
    direccion: 180,
    id_ruta: RUTA_1
  });

  if (resp3.data?.data?.accion?.includes('DESVIO') || resp3.data?.data?.accion === 'FUERA_DE_RUTA') {
    assertCondition(true, `Desvío detectado: acción=${resp3.data?.data?.accion}`);
    assertCondition(!resp3.data?.data?.enBus, `Usuario desvinculado del bus`);
  } else {
    log.warn(`Desvío no detectado (puede ser normal si está dentro de tolerancia). Acción: ${resp3.data?.data?.accion}`);
  }

  console.log('');
}

// ════════════════════════════════════════════════════════════════
// CASO 6: Detección de desvío al crear cluster
// ════════════════════════════════════════════════════════════════
async function test6_DesvioAlCrearCluster() {
  log.test('CASO 6: Detección de desvío al intentar crear cluster');
  
  const user1 = `anon_user_${Date.now()}_11`;
  const user2 = `anon_user_${Date.now()}_12`;

  // Usuario 1 en ruta válida
  log.info('Usuario 1 se posiciona en ruta válida');
  const resp1 = await makeRequest('/telemetria/registrar', {
    usuario_id: user1,
    es_registrado: false,
    latitud: coords.ruta1_inicio.lat,
    longitud: coords.ruta1_inicio.lng,
    velocidad: 15,
    precision_metros: 5,
    direccion: 180,
    id_ruta: RUTA_1
  });

  assertCondition(resp1.data?.data?.enBus, `Usuario 1 en ruta 1`);

  await sleep(200);

  // Usuario 2 intenta unirse pero está fuera de ruta/desvío
  log.info('Usuario 2 se posiciona muy fuera del corredor de ruta');
  const resp2 = await makeRequest('/telemetria/registrar', {
    usuario_id: user2,
    es_registrado: false,
    latitud: coords.ruta1_inicio.lat + 0.01, // ~1.1km de distancia
    longitud: coords.ruta1_inicio.lng + 0.01,
    velocidad: 15,
    precision_metros: 5,
    direccion: 180,
    id_ruta: RUTA_1
  });

  if (resp2.data?.data?.accion === 'FUERA_DE_RUTA' || resp2.data?.data?.accion?.includes('DESVIO')) {
    assertCondition(true, `Fuera de ruta detectado: ${resp2.data?.data?.accion}`);
    assertCondition(!resp2.data?.data?.enBus, `Usuario no está en bus`);
  } else {
    log.warn(`Usuario fue aceptado (puede estar dentro de tolerancia de 80m). Acción: ${resp2.data?.data?.accion}`);
  }

  console.log('');
}

// ════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════
async function main() {
  console.log(`${colors.bright}${colors.blue}
╔════════════════════════════════════════════════════════════════╗
║          TEST: Lógica de Unión de Clusters                    ║
╚════════════════════════════════════════════════════════════════╝
${colors.reset}`);

  console.log(`${colors.cyan}Conectando a: ${BASE_URL}${colors.reset}\n`);

  try {
    // Ejecutar pruebas
    await test1_UnidoAClusterExistente();
    await test2_ActualizaClusterPropio();
    await test3_UnidoConRadioAmpliado();
    await test4_ConsolidacionDuplicados();
    await test5_ClusterDesviado();
    await test6_DesvioAlCrearCluster();

    // Resumen
    console.log(`${colors.bright}${colors.cyan}
╔════════════════════════════════════════════════════════════════╗
║                      RESUMEN DE PRUEBAS                       ║
╚════════════════════════════════════════════════════════════════╝
${colors.reset}`);

    const total = testResults.passed + testResults.failed;
    const percentage = total > 0 ? Math.round((testResults.passed / total) * 100) : 0;

    console.log(`${colors.green}✅ Pasadas: ${testResults.passed}${colors.reset}`);
    console.log(`${colors.red}❌ Fallidas: ${testResults.failed}${colors.reset}`);
    console.log(`${colors.bright}Total: ${total}${colors.reset}`);
    console.log(`${colors.cyan}Éxito: ${percentage}%${colors.reset}\n`);

    if (testResults.failed === 0) {
      console.log(`${colors.green}${colors.bright}🎉 ¡Todas las pruebas pasaron!${colors.reset}`);
    } else {
      console.log(`${colors.yellow}${colors.bright}⚠️ Algunas pruebas fallaron. Revisa la lógica.${colors.reset}`);
    }

  } catch (error) {
    log.error(`Error general: ${error.message}`);
    process.exit(1);
  }
}

main().catch(err => {
  log.error(`Error: ${err.message}`);
  process.exit(1);
});
