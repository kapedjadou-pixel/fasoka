const multer = require('multer');

// Stockage en mémoire : le fichier est directement transmis à Cloudinary sans être écrit sur disque
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 Mo max par image
  fileFilter: (req, file, cb) => {
    const typesAutorises = ['image/jpeg', 'image/png', 'image/webp'];
    if (typesAutorises.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Format d\'image non supporté. Utilise JPEG, PNG ou WEBP.'));
    }
  },
});

module.exports = upload;
