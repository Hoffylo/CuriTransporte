// Test: Crear cluster y unirse con patente BXJK12
const http = require('http');

function makeRequest(data, description) {
  return new Promise((resolve, reject) => {
    const jsonData = JSON.stringify(data);
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/v1/telemetria/registrar',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(jsonData)
      }
    };

    const req = http.request(options, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log('\n' + '='.repeat(60));
        console.log(description);
        console.log('='.repeat(60));
        try {
          const parsed = JSON.parse(body);
          console.log('Status:', res.statusCode);
          console.log('Respuesta:', JSON.stringify(parsed, null, 2));
          resolve(parsed);
        } catch (e) {
          console.log('Raw:', body);
          resolve(body);
        }
      });
    });

    req.on('error', reject);
    req.write(jsonData);
    req.end();
  });
}

async function runTests() {
  try {
    // PASO 1: Usuario 1 crea cluster con patente BXJK12
    console.log('\n🚀 INICIANDO PRUEBA DE CLUSTERS CON PATENTE\n');
    
    const result1 = await makeRequest({
      identidad: 'usuario_test_1',
      latitude: -34.9850,
      longitude: -71.2400,
      speed: 25,
      accuracy: 10,
      heading: 90,
      esta_en_bus: true,
      confirmado_usuario: true,
      id_ruta: 3,
      es_registrado: false,
      id_bus: 'BXJK12'
    }, '📍 PASO 1: Usuario 1 crea cluster con patente BXJK12');

    await new Promise(r => setTimeout(r, 1000));

    // PASO 2: Usuario 2 intenta unirse con MISMA patente (debe funcionar)
    const result2 = await makeRequest({
      identidad: 'usuario_test_2',
      latitude: -34.9851,  // Muy cerca del usuario 1
      longitude: -71.2401,
      speed: 25,
      accuracy: 10,
      heading: 90,
      esta_en_bus: true,
      confirmado_usuario: true,
      id_ruta: 3,
      es_registrado: false,
      id_bus: 'BXJK12'  // MISMA patente
    }, '✅ PASO 2: Usuario 2 intenta unirse con MISMA patente BXJK12');

    await new Promise(r => setTimeout(r, 1000));

    // PASO 3: Usuario 3 intenta unirse con DIFERENTE patente (debe fallar)
    const result3 = await makeRequest({
      identidad: 'usuario_test_3',
      latitude: -34.9852,  // También cerca
      longitude: -71.2402,
      speed: 25,
      accuracy: 10,
      heading: 90,
      esta_en_bus: true,
      confirmado_usuario: true,
      id_ruta: 3,
      es_registrado: false,
      id_bus: 'XXXX99'  // DIFERENTE patente
    }, '❌ PASO 3: Usuario 3 intenta unirse con DIFERENTE patente XXXX99');

    await new Promise(r => setTimeout(r, 1000));

    // PASO 4: Usuario 4 intenta unirse SIN patente (debe fallar)
    const result4 = await makeRequest({
      identidad: 'usuario_test_4',
      latitude: -34.9853,
      longitude: -71.2403,
      speed: 25,
      accuracy: 10,
      heading: 90,
      esta_en_bus: true,
      confirmado_usuario: true,
      id_ruta: 3,
      es_registrado: false
      // Sin id_bus
    }, '❌ PASO 4: Usuario 4 intenta unirse SIN patente');

    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DE PRUEBAS');
    console.log('='.repeat(60));
    console.log('Usuario 1 (BXJK12):', result1?.data?.accion || result1?.accion || 'Error');
    console.log('Usuario 2 (BXJK12):', result2?.data?.accion || result2?.accion || 'Error');
    console.log('Usuario 3 (XXXX99):', result3?.data?.accion || result3?.accion || 'Error');
    console.log('Usuario 4 (sin patente):', result4?.data?.accion || result4?.accion || 'Error');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

runTests();
