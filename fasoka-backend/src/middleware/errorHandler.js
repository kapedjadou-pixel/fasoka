function errorHandler(err, req, res, next) {
  console.error(err.stack);

  // Erreurs Multer (upload de fichiers)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Image trop volumineuse (5 Mo maximum).' });
  }

  // Erreurs PostgreSQL courantes
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Cette donnée existe déjà (doublon).' });
  }
  // Identifiant (UUID) mal formé, ou valeur numérique hors limites : erreur du client, pas du serveur
  if (err.code === '22P02' || err.code === '22003') {
    return res.status(400).json({ error: 'Valeur invalide dans la requête.' });
  }
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Référence invalide (donnée liée introuvable).' });
  }

  // Les erreurs d'upload (format refusé) et JSON mal formé sont des erreurs client
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Corps de requête JSON invalide.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Requête trop volumineuse.' });
  }

  // En production, ne jamais renvoyer le message d'une erreur interne (requête SQL, chemin, etc.)
  const status = err.status && err.status < 500 ? err.status : 500;
  if (status === 500 && process.env.NODE_ENV === 'production') {
    return res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
  res.status(status).json({
    error: err.message || 'Erreur interne du serveur.',
  });
}

module.exports = errorHandler;
