/**
 * Configuración de la aplicación Zorem
 * Este archivo se puede modificar para cambiar la URL de la API según el entorno
 */

// Detectar automáticamente la URL de la API
function getApiBaseUrl() {
  const hostname = window.location.hostname;

  // Si estamos en localhost, usar localhost:3000
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3000';
  }

  // Permite override desde el HTML (opcional)
  if (typeof window.API_BASE_URL === 'string' && window.API_BASE_URL.trim()) {
    return window.API_BASE_URL.replace(/\/+$/, '');
  }

  // En producción, usar la URL de tu API en Render
  const apiServiceName = 'zorem-api';

  // Si estás usando Render
  if (hostname.includes('render.com') || hostname.includes('onrender.com')) {
    return `https://${apiServiceName}.onrender.com`;
  }

  // Dominio personalizado: usar api.<tu-dominio>
  const baseDomain = hostname.startsWith('www.') ? hostname.slice(4) : hostname;
  return `https://api.${baseDomain}`;
}

export const config = {
  apiBaseUrl: getApiBaseUrl()
};
