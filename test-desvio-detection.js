require('dotenv').config({ path: './api/.env' });
const http = require('http');

const API_HOST = 'localhost';
const API_PORT = 3000;

async function sendTelemetry(userId, lat, lng, heading, ruta) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      usuario_id: userId,
      es_registrado: false,
      latitud: lat,
      longitud: lng,
      velocidad: 5,
      precision_metros: 10,
      direccion: heading,
      esta_en_bus: true,
      confirmado_usuario: false,
      id_ruta: ruta
    });

    const options = {
      hostname: API_HOST,
      port: API_PORT,
      path: '/api/v1/telemetria/registrar',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function testDesvioDetection() {
  console.log('\n🧪 TEST: Detección de Desvío de Ruta');
  console.log('='.repeat(80));
  
  const userId = `anon_test_desvio_${Date.now()}`;
  
  try {
    // Paso 1: Crear ubicación en ruta 2 (posición normal)
    console.log('\n📍 Paso 1: Usuario en ruta 2 (posición normal)');
    const pos1 = await sendTelemetry(
      userId,
      -34.9756482,  // Lat
      -71.2601483,  // Lng
      266,          // Heading correcto para ruta 2
      2             // Ruta 2
    );
    
    console.log(`   Status: ${pos1.status}`);
    console.log(`   Acción: ${pos1.data.data?.accion || pos1.data.error}`);
    console.log(`   En bus: ${pos1.data.data?.enBus}`);
    console.log(`   Cluster: ${pos1.data.data?.clusterId || 'N/A'}`);
    
    await new Promise(r => setTimeout(r, 500));
    
    // Paso 2: Usuario se desvía (cambia a ruta 3)
    console.log('\n🚨 Paso 2: Usuario se desvía (posición que coincide con ruta 3)');
    const pos2 = await sendTelemetry(
      userId,
      -34.9748394,  // Lat (posición que coincide con ruta 3)
      -71.2652998,  // Lng
      111,          // Heading que coincide con ruta 3, no con ruta 2
      2             // Usuario reporta ruta 2, pero está en ruta 3
    );
    
    console.log(`   Status: ${pos2.status}`);
    console.log(`   Acción: ${pos2.data.data?.accion || pos2.data.error}`);
    console.log(`   En bus: ${pos2.data.data?.enBus}`);
    console.log(`   Motivo: ${pos2.data.data?.motivo || 'N/A'}`);
    console.log(`   Ruta original: ${pos2.data.data?.ruta_original || 'N/A'}`);
    console.log(`   Ruta detectada: ${pos2.data.data?.ruta_detectada || 'N/A'}`);
    console.log(`   Cluster desactivado: ${pos2.data.data?.cluster_desactivado || 'N/A'}`);
    
    console.log('\n' + '='.repeat(80));
    
    if (pos2.data.data?.accion === 'DESVIO_DETECTADO') {
      console.log('✅ TEST EXITOSO: Desvío detectado correctamente');
      console.log('   - Usuario desvinculado del cluster');
      console.log('   - Cluster marcado como inactivo');
      console.log('   - Usuario marcado como NO en bus');
    } else {
      console.log('❌ TEST FALLIDO: Desvío NO detectado');
      console.log('   Se esperaba acción "DESVIO_DETECTADO"');
    }
    
  } catch (error) {
    console.error('\n❌ Error durante el test:', error.message);
  }
  
  console.log('\n');
}

console.log('\n🚀 Iniciando test de detección de desvío...');
console.log(`⚠️  Asegúrate de que el servidor esté corriendo en ${API_HOST}:${API_PORT}\n`);

testDesvioDetection();
