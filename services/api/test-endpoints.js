/**
 * Script de prueba para endpoints de Zorem API
 * Ejecutar con: node test-endpoints.js
 */

const API_URL = 'http://localhost:3000';

async function testEndpoint(name, method, path, body = null, headers = {}) {
  console.log(`\n🧪 Testing: ${name}`);
  console.log(`   ${method} ${path}`);
  
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_URL}${path}`, options);
    const data = await response.json();

    if (response.ok) {
      console.log(`   ✅ Success (${response.status})`);
      console.log(`   Response:`, JSON.stringify(data, null, 2));
      return data;
    } else {
      console.log(`   ❌ Error (${response.status})`);
      console.log(`   Response:`, JSON.stringify(data, null, 2));
      return null;
    }
  } catch (error) {
    console.log(`   ❌ Exception:`, error.message);
    return null;
  }
}

async function runTests() {
  console.log('🚀 Starting API Tests...\n');
  console.log('='.repeat(50));

  // 1. Health Check
  await testEndpoint('Health Check', 'GET', '/health');

  // 2. Request Magic Link
  const magicLinkResponse = await testEndpoint(
    'Request Magic Link',
    'POST',
    '/api/auth/request-magic-link',
    { email: 'test@example.com' }
  );

  let token = null;
  if (magicLinkResponse && magicLinkResponse.token) {
    token = magicLinkResponse.token;
    console.log(`\n   📝 Token obtenido: ${token.substring(0, 20)}...`);
  }

  // 3. Verify Magic Link (si tenemos token)
  if (token) {
    const verifyResponse = await testEndpoint(
      'Verify Magic Link',
      'GET',
      `/api/auth/verify-magic-link?token=${token}`
    );

    if (verifyResponse && verifyResponse.token) {
      token = verifyResponse.token; // Actualizar con session token
      console.log(`\n   📝 Session Token obtenido: ${token.substring(0, 20)}...`);
    }
  }

  // 4. Get User Info (si tenemos token)
  if (token) {
    await testEndpoint(
      'Get User Info',
      'GET',
      '/api/auth/me',
      null,
      { 'Authorization': `Bearer ${token}` }
    );
  }

  // 5. Create Room (si tenemos token)
  if (token) {
    const roomResponse = await testEndpoint(
      'Create Room',
      'POST',
      '/api/rooms',
      { duration: '24h', allow_uploads: true },
      { 'Authorization': `Bearer ${token}` }
    );

    if (roomResponse && roomResponse.code) {
      const roomCode = roomResponse.code;
      console.log(`\n   📝 Room Code: ${roomCode}`);

      // 6. Validate Room Code
      await testEndpoint('Validate Room Code', 'GET', `/api/rooms/${roomCode}`);

      // 7. Join Room as Viewer
      await testEndpoint(
        'Join Room as Viewer',
        'POST',
        '/api/viewer/join',
        { code: roomCode, nickname: 'TestViewer' }
      );
    }
  }

  // 8. Test invalid code
  await testEndpoint('Validate Invalid Code', 'GET', '/api/rooms/INVALID');

  console.log('\n' + '='.repeat(50));
  console.log('✅ Tests completed!\n');
}

// Ejecutar tests
runTests().catch(console.error);
