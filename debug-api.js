#!/usr/bin/env node

/**
 * Debug Script: Ver respuestas reales del API
 */

const http = require('http');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m'
};

async function makeRequest(endpoint, data) {
  return new Promise((resolve) => {
    const postData = JSON.stringify(data);
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: `/api/v1${endpoint}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          resolve({ success: res.statusCode >= 200 && res.statusCode < 300, data, status: res.statusCode });
        } catch (e) {
          resolve({ success: false, data: { error: body }, status: res.statusCode });
        }
      });
    });

    req.on('error', (error) => {
      resolve({ success: false, data: { error: error.message }, status: 0 });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, data: { error: 'Timeout - servidor no responde' }, status: 0 });
    });

    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log(`${colors.cyan}${colors.bright}
═══════════════════════════════════════════════════════════════
               🐛 DEBUG: Test Simple de Clusters
═══════════════════════════════════════════════════════════════
${colors.reset}`);

  // 1. Verificar conexión
  console.log(`\n${colors.yellow}1️⃣ Verificando conexión al servidor...${colors.reset}`);
  const testReq = await makeRequest('/telemetria/registrar', {
    usuario_id: 'anon_test',
    es_registrado: false,
    latitud: -33.3870,
    longitud: -70.5450,
    velocidad: 10,
    precision_metros: 5,
    direccion: 180,
    id_ruta: 1
  });

  if (testReq.status === 0) {
    console.log(`${colors.red}❌ NO HAY CONEXIÓN${colors.reset}`);
    console.log(`${colors.red}El servidor no está corriendo en http://localhost:3000${colors.reset}`);
    console.log(`${colors.yellow}Solución: Ejecuta en otra terminal:${colors.reset}`);
    console.log(`${colors.cyan}  cd api && npm run dev${colors.reset}`);
    process.exit(1);
  }

  console.log(`${colors.green}✅ Servidor respondiendo en puerto 3000${colors.reset}`);
  console.log(`${colors.cyan}Status HTTP: ${testReq.status}${colors.reset}\n`);

  // 2. Mostrar respuesta completa
  console.log(`${colors.yellow}2️⃣ Respuesta Completa:${colors.reset}`);
  console.log(`${colors.cyan}${JSON.stringify(testReq.data, null, 2)}${colors.reset}\n`);

  // 3. Analizar problemas
  console.log(`${colors.yellow}3️⃣ Análisis:${colors.reset}`);

  const responseData = testReq.data?.data;
  const success = testReq.data?.success;

  if (!testReq.data) {
    console.log(`${colors.red}❌ No hay campo 'data' en la respuesta${colors.reset}`);
    console.log(`${colors.cyan}Respuesta cruda: ${JSON.stringify(testReq.data)}${colors.reset}`);
    console.log(`${colors.yellow}Solución: Verifica que el endpoint sea correcto${colors.reset}`);
  } else if (!responseData) {
    console.log(`${colors.red}❌ No hay campo 'data.data' en la respuesta${colors.reset}`);
    if (testReq.data?.error) {
      console.log(`${colors.cyan}Error: ${testReq.data.error}${colors.reset}`);
    }
  } else {
    console.log(`${colors.green}✅ Estructura de respuesta correcta${colors.reset}`);
    console.log(`  • success: ${success}`);
    console.log(`  • enBus: ${responseData.enBus}`);
    console.log(`  • clusterId: ${responseData.clusterId}`);
    console.log(`  • cantidadUsuarios: ${responseData.cantidadUsuarios}`);
    console.log(`  • accion: ${responseData.accion}`);
    console.log(`  • paraderosCercano: ${responseData.paraderosCercano ? 'SÍ' : 'NO'}`);
    
    if (!responseData.enBus && responseData.accion === 'USUARIO_SOLO') {
      console.log(`\n${colors.yellow}⚠️ Usuario fue detectado como SOLO (no en bus)${colors.reset}`);
      console.log(`${colors.yellow}Posibles causas:${colors.reset}`);
      console.log(`  1. Coordenadas están fuera del corredor de ruta`);
      console.log(`  2. Ruta con ID=1 no existe`);
      console.log(`  3. Usuario no tiene otros cercanos`);
    }
  }

  // 4. Verificación de rutas
  console.log(`\n${colors.yellow}4️⃣ Verificando si existen rutas en la BD...${colors.reset}`);
  
  // Haremos otra petición con diferentes coordenadas para ver el patrón
  const test2 = await makeRequest('/telemetria/registrar', {
    usuario_id: `anon_debug_${Date.now()}`,
    es_registrado: false,
    latitud: -33.40,
    longitud: -70.55,
    velocidad: 0,
    precision_metros: 10,
    direccion: 0,
    id_ruta: 1
  });

  if (test2.data?.data?.accion === 'FUERA_DE_RUTA') {
    console.log(`${colors.yellow}⚠️ Punto está FUERA DE RUTA${colors.reset}`);
    console.log(`${colors.cyan}Error: ${test2.data.data.motivo}${colors.reset}`);
    console.log(`${colors.yellow}Necesitas ajustar las coordenadas dentro del corredor de la ruta 1${colors.reset}`);
  } else {
    console.log(`${colors.green}✅ Punto validado contra ruta 1${colors.reset}`);
  }

  // 5. Recomendaciones
  console.log(`\n${colors.yellow}5️⃣ Recomendaciones:${colors.reset}`);
  console.log(`${colors.cyan}
Para que el test funcione necesitas:

1. Backend ejecutándose:
   ${colors.green}cd api && npm run dev${colors.reset}

2. Base de datos con datos iniciales:
   - Tabla: ruta (con id_ruta=1 y geom válida)
   - Tabla: paraderos (con geom válida)
   - Tabla: ubicacion (vacía o con datos de prueba)

3. Coordenadas válidas dentro del corredor de la ruta 1
   (ajusta en test-cluster-union.js línea ~64)

4. Verificar variables de entorno en api/.env:
   - PROXIMITY_THRESHOLD=35 (distancia para unirse a cluster)
   - ROUTE_OFFSET_METERS=80 (tolerancia de desviación)
   - ROUTE_HEADING_DELTA=120 (tolerancia de dirección)

5. Ver logs del backend mientras se ejecuta el test
${colors.reset}`);

  console.log(`${colors.bright}${colors.blue}═══════════════════════════════════════════════════════════════${colors.reset}\n`);
}

main().catch(err => {
  console.error(`${colors.red}Error: ${err.message}${colors.reset}`);
  process.exit(1);
});
