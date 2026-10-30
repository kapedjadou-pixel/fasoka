const multer = require('multer');
const { TAILLE_MAX_OCTETS, classerFichier } = require('../services/piecesJointes');

// Réception d'une pièce jointe de la messagerie (champ « fichier »), gardée en mémoire puis envoyée à Cloudinary
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TAILLE_MAX_OCTETS, files: 1 },
  fileFilter: (req, file, cb) => {
    if (classerFichier(file.mimetype)) cb(null, true);
    else cb(new Error('FORMAT_NON_ACCEPTE'));
  },
});

// Même chose, avec des réponses d'erreur claires (fichier trop gros, type refusé)
function recevoirFichier(req, res, next) {
  upload.single('fichier')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Fichier trop volumineux (10 Mo maximum).' });
    }
    if (err.message === 'FORMAT_NON_ACCEPTE') {
      return res.status(400).json({
        error: "Ce type de fichier n'est pas accepté. Envoie une photo, un message vocal ou un document (PDF, Word, Excel, PowerPoint, texte).",
      });
    }
    return next(err);
  });
}

module.exports = { recevoirFichier };
