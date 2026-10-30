const crypto = require('crypto');
const streamifier = require('streamifier');
const cloudinary = require('../config/cloudinary');

// Pièces jointes de la messagerie : photos, messages vocaux et documents, stockés chez Cloudinary.
// Le type de chaque fichier est déterminé ici (liste blanche) : un type non prévu est refusé, et l'extension
// des documents est choisie par le serveur, jamais d'après le nom donné par l'utilisateur.

const TAILLE_MAX_OCTETS = 10 * 1024 * 1024; // 10 Mo

const IMAGES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']);

const DOCUMENTS = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.oasis.opendocument.text': 'odt',
  'application/vnd.oasis.opendocument.spreadsheet': 'ods',
  'application/rtf': 'rtf',
  'text/plain': 'txt',
  'text/csv': 'csv',
};

function mimeDeBase(mime) {
  return String(mime || '').split(';')[0].trim().toLowerCase();
}

// { type: 'image' | 'audio' | 'document', extension? } ou null si le type de fichier n'est pas accepté
function classerFichier(mime) {
  const base = mimeDeBase(mime);
  if (IMAGES.has(base)) return { type: 'image' };
  if (base.startsWith('audio/')) return { type: 'audio' };
  if (DOCUMENTS[base]) return { type: 'document', extension: DOCUMENTS[base] };
  return null;
}

function cloudinaryConfigure() {
  return Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

// Nom affiché dans la discussion : sans chemin ni caractères de contrôle, 120 caractères maximum
function nettoyerNom(nomBrut, extensionParDefaut) {
  let nom = String(nomBrut || '');
  // multer lit les noms de fichier en latin1 : on retrouve les accents (UTF-8)
  const decode = Buffer.from(nom, 'latin1').toString('utf8');
  if (!decode.includes('\uFFFD')) nom = decode;
  nom = nom.split(/[\\/]/).pop().replace(/[\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim();
  if (nom.length > 120) {
    const point = nom.lastIndexOf('.');
    const extension = point > 0 && nom.length - point <= 10 ? nom.slice(point) : '';
    nom = nom.slice(0, 120 - extension.length) + extension;
  }
  return nom || (extensionParDefaut ? 'document.' + extensionParDefaut : 'fichier');
}

// Envoie le fichier vers Cloudinary (flux, sans écriture sur disque) et renvoie le résultat (secure_url, width, height...)
function envoyerVersCloudinary(buffer, { type, extension }) {
  const identifiant = crypto.randomUUID(); // nom aléatoire : l'adresse du fichier ne se devine pas
  const options = { folder: 'fasoka/messagerie' };

  if (type === 'image') {
    options.resource_type = 'image';
    options.public_id = identifiant;
    options.transformation = [{ width: 1600, height: 1600, crop: 'limit', quality: 'auto' }];
  } else if (type === 'audio') {
    options.resource_type = 'video'; // chez Cloudinary, l'audio est rangé avec la vidéo
    options.public_id = identifiant;
  } else {
    options.resource_type = 'raw';
    options.public_id = identifiant + '.' + extension;
  }

  return new Promise((resolve, reject) => {
    const flux = cloudinary.uploader.upload_stream(options, (err, resultat) => {
      if (err) reject(err);
      else resolve(resultat);
    });
    streamifier.createReadStream(buffer).pipe(flux);
  });
}

module.exports = { TAILLE_MAX_OCTETS, classerFichier, cloudinaryConfigure, nettoyerNom, envoyerVersCloudinary };
