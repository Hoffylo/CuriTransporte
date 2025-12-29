require('dotenv').config({ path: './api/.env' });

// Script para simular el problema de requests duplicados
// Esto nos ayudará a determinar si el problema es del backend o frontend

const http = require('http');

const API_HOST = 'localhost';
const API_PORT = 3000;

async function sendTelemetryRequest(userId, lat, lng, ruta, delay = 0) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const postData = JSON.stringify({
        usuario_id: userId,
        es_registrado: false,
        latitud: lat,
        longitud: lng,
        velocidad: 0,
        precision_metros: 10,
        direccion: 266,
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
    }, delay);
  });
}

async function testDuplicateRequests() {
  const userId = `anon_test_${Date.now()}`;
  const lat = -34.9756482;
  const lng = -71.2601483;
  const ruta = 2;

  console.log('\n🧪 TEST: Enviando 2 requests SIMULTÁNEOS (sin delay)');
  console.log('='  .repeat(80));
  console.log(`Usuario: ${userId}`);
  console.log(`Posición: (${lat}, ${lng})`);
  console.log(`Ruta: ${ruta}\n`);

  try {
    // Enviar 2 requests simultáneos
    const [result1, result2] = await Promise.all([
      sendTelemetryRequest(userId, lat, lng, ruta, 0),
      sendTelemetryRequest(userId, lat, lng, ruta, 0)
    ]);

    console.log('📊 Resultado Request 1:');
    console.log(`   Status: ${result1.status}`);
    console.log(`   Acción: ${result1.data.data?.accion || 'N/A'}`);
    console.log(`   Cluster: ${result1.data.data?.clusterId || 'N/A'}\n`);

    console.log('📊 Resultado Request 2:');
    console.log(`   Status: ${result2.status}`);
    console.log(`   Acción: ${result2.data.data?.accion || result2.data.error}`);
    console.log(`   Cluster: ${result2.data.data?.clusterId || 'N/A'}\n`);

    // Verificar si se crearon clusters duplicados
    if (result1.data.data?.clusterId && result2.data.data?.clusterId) {
      if (result1.data.data.clusterId === result2.data.data.clusterId) {
        console.log('✅ OK: Ambos requests se unieron al MISMO cluster');
        console.log(`   Cluster ID: ${result1.data.data.clusterId}`);
      } else {
        console.log('❌ ERROR: Se crearon DOS clusters diferentes');
        console.log(`   Cluster 1: ${result1.data.data.clusterId}`);
        console.log(`   Cluster 2: ${result2.data.data.clusterId}`);
      }
    } else if (result2.status === 429) {
      console.log('✅ OK: Request 2 fue rechazado por deduplicación (429)');
    } else {
      console.log('⚠️ Resultado inesperado - revisar manualmente');
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n🧪 TEST: Enviando 2 requests SECUENCIALES (100ms delay)');
    console.log('='.repeat(80));
    
    const userId2 = `anon_test_seq_${Date.now()}`;
    const lat2 = -34.9757;
    const lng2 = -71.2602;
    
    const seq1 = await sendTelemetryRequest(userId2, lat2, lng2, ruta, 0);
    await new Promise(r => setTimeout(r, 100));
    const seq2 = await sendTelemetryRequest(userId2, lat2, lng2, ruta, 0);

    console.log('\n📊 Resultado Request 1:');
    console.log(`   Status: ${seq1.status}`);
    console.log(`   Acción: ${seq1.data.data?.accion || 'N/A'}`);
    console.log(`   Cluster: ${seq1.data.data?.clusterId || 'N/A'}\n`);

    console.log('📊 Resultado Request 2 (+100ms):');
    console.log(`   Status: ${seq2.status}`);
    console.log(`   Acción: ${seq2.data.data?.accion || seq2.data.error}`);
    console.log(`   Cluster: ${seq2.data.data?.clusterId || 'N/A'}\n`);

    console.log('='.repeat(80));
    console.log('\n✅ Test completado\n');

  } catch (error) {
    console.error('❌ Error durante el test:', error.message);
  }
}

// Ejecutar test
console.log('\n🚀 Iniciando test de requests duplicados...');
console.log('⚠️  Asegúrate de que el servidor esté corriendo en', `${API_HOST}:${API_PORT}\n`);

testDuplicateRequests();
