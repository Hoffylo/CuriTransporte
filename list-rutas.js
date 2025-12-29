#!/usr/bin/env node

/**
 * Script: Listar rutas disponibles en la BD
 */

const http = require('http');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m'
};

const log = {
  header: (msg) => console.log(`\n${colors.bright}${colors.blue}${msg}${colors.reset}\n`)
};

function makeRequest(endpoint) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: `/api/v1${endpoint}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
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
          resolve({ success: false, data: null, status: res.statusCode });
        }
      });
    });

    req.on('error', (error) => {
      console.log(`${colors.green}❌${colors.reset} Error de conexión: ${error.message}`);
      console.log(`${colors.green}⚠️${colors.reset} ¿Está corriendo el backend en puerto 3001?`);
      process.exit(1);
    });

    req.end();
  });
}

async function main() {
  log.header('╔════════════════════════════════════════════════════════════╗');
  log.header('║          Script: Listar Rutas Disponibles                  ║');
  log.header('╚════════════════════════════════════════════════════════════╝');

  console.log(`${colors.cyan}Consultando: GET /api/v1/ruta${colors.reset}\n`);

  const resp = await makeRequest('/ruta');

  if (!resp.success) {
    console.log(`${colors.green}❌${colors.reset} Error en la respuesta`);
    console.log(JSON.stringify(resp.data, null, 2));
    process.exit(1);
  }

  const rutas = resp.data?.data || [];

  if (rutas.length === 0) {
    console.log(`${colors.green}⚠️${colors.reset} ${colors.bright}No hay rutas en la base de datos${colors.reset}`);
    console.log('\nNecesitas insertar rutas primero. Contacta al administrador.');
    process.exit(0);
  }

  console.log(`${colors.green}✅${colors.reset} ${colors.bright}${rutas.length} rutas encontradas:${colors.reset}\n`);

  rutas.forEach((ruta, idx) => {
    console.log(`${idx + 1}. ID: ${colors.bright}${ruta.id_ruta}${colors.reset}`);
    if (ruta.nombre) console.log(`   Nombre: ${ruta.nombre}`);
    if (ruta.descripcion) console.log(`   Descripción: ${ruta.descripcion}`);
    console.log('');
  });

  console.log(`${colors.green}📝${colors.reset} ${colors.bright}Para los tests, usa uno de estos IDs:${colors.reset}`);
  console.log(`${colors.cyan}   const RUTA_1 = ${rutas[0]?.id_ruta};${colors.reset}`);
  if (rutas[1]) {
    console.log(`${colors.cyan}   const RUTA_2 = ${rutas[1]?.id_ruta};${colors.reset}`);
  }
  console.log('');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
