import { Platform } from 'react-native';

const LAN_BACKEND_URL = 'http://192.168.3.1:4000';

export const API_BASE_URL = (() => {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/+$/, '');
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return LAN_BACKEND_URL;
    }
    return `${window.location.protocol}//${window.location.hostname}:4000`;
  }

  return LAN_BACKEND_URL;
})();

export const requestJson = async (path: string, options: RequestInit = {}) => {
  const headers = new Headers(options.headers);

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with ${response.status}`);
  }

  return response.json();
};
