/**
 * Configuración de la aplicación Zorem
 * Este archivo se puede modificar para cambiar la URL de la API según el entorno
 */

// Detectar automáticamente la URL de la API
function getApiBaseUrl() {
  // Si estamos en localhost, usar localhost:3000
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:3000';
  }
  
  // En producción, usar la URL de tu API en Render
  // IMPORTANTE: Reemplaza 'zorem-api' con el nombre real de tu servicio en Render
  // Ejemplo: https://zorem-api.onrender.com
  const apiServiceName = 'zorem-api'; // Cambia esto por el nombre de tu servicio en Render
  
  // Si estás usando Render
  if (window.location.hostname.includes('render.com') || window.location.hostname.includes('onrender.com')) {
    return `https://${apiServiceName}.onrender.com`;
  }
  
  // Si tienes un dominio personalizado, ajusta esto
  // Ejemplo: return 'https://api.tudominio.com';
  
  // Fallback: asume que la API está en el mismo dominio
  return window.location.origin;
}

export const config = {
  apiBaseUrl: getApiBaseUrl()
};

