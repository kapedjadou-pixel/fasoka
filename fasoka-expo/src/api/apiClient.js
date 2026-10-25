import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './config';

export class ApiException extends Error {
  constructor(message) {
    super(message);
    this.name = 'ApiException';
  }
}

// Sur l'hébergement gratuit, le serveur s'endort après un moment d'inactivité :
// le premier appel peut prendre près d'une minute. On attend donc assez longtemps
// avant d'abandonner, puis on explique clairement ce qui se passe.
const DELAI_MAX_MS = 60000;

const MESSAGE_DELAI =
  'Le serveur met du temps à répondre (il est peut-être en train de se réveiller). Réessaie dans un instant.';
const MESSAGE_RESEAU =
  'Impossible de joindre le serveur. Vérifie ta connexion internet puis réessaie.';
const MESSAGE_SERVEUR_INDISPONIBLE =
  'Le serveur démarre ou est momentanément indisponible. Réessaie dans un instant.';

async function getToken() {
  return AsyncStorage.getItem('auth_token');
}

async function headers() {
  const token = await getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// fetch avec délai maximal, et messages d'erreur compréhensibles pour l'utilisateur
async function requete(url, options) {
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), DELAI_MAX_MS);
  try {
    return await fetch(url, { ...options, signal: controleur.signal });
  } catch (e) {
    if (e && e.name === 'AbortError') throw new ApiException(MESSAGE_DELAI);
    throw new ApiException(MESSAGE_RESEAU);
  } finally {
    clearTimeout(minuteur);
  }
}

async function handle(response) {
  const text = await response.text();

  // Le serveur (ou son proxy) peut répondre autre chose que du JSON, par exemple une page d'erreur HTML
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = null;
    }
  }

  if (response.ok) return data;

  if (data && data.error) throw new ApiException(data.error);
  if (response.status === 502 || response.status === 503 || response.status === 504) {
    throw new ApiException(MESSAGE_SERVEUR_INDISPONIBLE);
  }
  throw new ApiException(`Erreur (${response.status})`);
}

export const ApiClient = {
  async get(path, query) {
    const qs = query ? '?' + new URLSearchParams(query).toString() : '';
    const response = await requete(`${API_BASE_URL}${path}${qs}`, { headers: await headers() });
    return handle(response);
  },

  async post(path, body) {
    const response = await requete(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: await headers(),
      body: JSON.stringify(body),
    });
    return handle(response);
  },

  async patch(path, body) {
    const response = await requete(`${API_BASE_URL}${path}`, {
      method: 'PATCH',
      headers: await headers(),
      body: JSON.stringify(body),
    });
    return handle(response);
  },

  async delete(path) {
    const response = await requete(`${API_BASE_URL}${path}`, {
      method: 'DELETE',
      headers: await headers(),
    });
    return handle(response);
  },

  async uploadImage(path, asset) {
    const token = await getToken();
    const formData = new FormData();

    if (Platform.OS === 'web') {
      const fichier = asset.file || (await (await fetch(asset.uri)).blob());
      formData.append('image', fichier, asset.fileName || 'photo.jpg');
    } else {
      const nomFichier = asset.uri.split('/').pop();
      const extension = nomFichier.split('.').pop();
      formData.append('image', {
        uri: asset.uri,
        name: nomFichier,
        type: `image/${extension === 'jpg' ? 'jpeg' : extension}`,
      });
    }

    const response = await requete(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    return handle(response);
  },
};
