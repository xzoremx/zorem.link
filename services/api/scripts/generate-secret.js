#!/usr/bin/env node

/**
 * Script para generar un JWT_SECRET seguro
 * Uso: node scripts/generate-secret.js
 */

import crypto from 'crypto';

const secret = crypto.randomBytes(32).toString('hex');

console.log('\n JWT_SECRET generado:');
console.log('─'.repeat(50));
console.log(secret);
console.log('─'.repeat(50));
console.log('\n Copia este valor y úsalo como JWT_SECRET en Render');
console.log('   o en tu archivo .env local\n');
