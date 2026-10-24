const streamifier = require('streamifier');
const cloudinary = require('../config/cloudinary');
const db = require('../config/database');

// Envoie un buffer vers Cloudinary via un flux (pas besoin d'écrire de fichier temporaire)
function envoyerVersCloudinary(buffer, dossier) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: dossier, transformation: [{ width: 1000, height: 1000, crop: 'fill', gravity: 'auto', quality: 'auto' }] },
      (err, result) => {
        if (err) reject(err);
        else resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

// POST /api/products/:productId/images  (multipart/form-data, champ "image")
async function uploadProductImage(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucune image reçue.' });
    }

    // Vérifie que le produit existe et appartient bien à une boutique de l'utilisateur
    const produit = await db.query(
      `SELECT p.id, p.shop_id FROM products p
       JOIN shop_team_members tm ON tm.shop_id = p.shop_id
       WHERE p.id = $1 AND tm.user_id = $2`,
      [req.params.productId, req.userId]
    );
    if (produit.rows.length === 0) {
      return res.status(403).json({ error: 'Accès non autorisé à ce produit.' });
    }

    const resultat = await envoyerVersCloudinary(req.file.buffer, 'fasoka/produits');

    const nombreImages = await db.query(
      `SELECT COUNT(*) FROM product_images WHERE product_id = $1`, [req.params.productId]
    );

    const inserted = await db.query(
      `INSERT INTO product_images (product_id, image_url, ordre) VALUES ($1, $2, $3) RETURNING *`,
      [req.params.productId, resultat.secure_url, parseInt(nombreImages.rows[0].count)]
    );

    res.status(201).json(inserted.rows[0]);
  } catch (err) {
    if (err.message && err.message.includes('format')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
}

// DELETE /api/products/:productId/images/:imageId
async function deleteProductImage(req, res, next) {
  try {
    const image = await db.query(
      `SELECT pi.* FROM product_images pi
       JOIN products p ON p.id = pi.product_id
       JOIN shop_team_members tm ON tm.shop_id = p.shop_id
       WHERE pi.id = $1 AND tm.user_id = $2`,
      [req.params.imageId, req.userId]
    );
    if (image.rows.length === 0) {
      return res.status(404).json({ error: 'Image introuvable.' });
    }

    // Extrait le public_id Cloudinary depuis l'URL pour pouvoir la supprimer côté Cloudinary aussi
    const url = image.rows[0].image_url;
    const match = url.match(/fasoka\/produits\/[^./]+/);
    if (match) {
      await cloudinary.uploader.destroy(match[0]).catch(() => {});
    }

    await db.query(`DELETE FROM product_images WHERE id = $1`, [req.params.imageId]);
    res.json({ message: 'Image supprimée.' });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/products/:productId/images/reorder
// body: { image_ids: [...] } dans le nouvel ordre souhaité
async function reorderProductImages(req, res, next) {
  try {
    const { image_ids } = req.body;
    if (!Array.isArray(image_ids)) {
      return res.status(400).json({ error: 'image_ids doit être un tableau.' });
    }

    // Vérifie l'accès à ce produit avant de toucher aux images
    const acces = await db.query(
      `SELECT p.id FROM products p
       JOIN shop_team_members tm ON tm.shop_id = p.shop_id
       WHERE p.id = $1 AND tm.user_id = $2`,
      [req.params.productId, req.userId]
    );
    if (acces.rows.length === 0) {
      return res.status(403).json({ error: 'Accès non autorisé à ce produit.' });
    }

    await Promise.all(
      image_ids.map((id, index) =>
        db.query(`UPDATE product_images SET ordre = $1 WHERE id = $2 AND product_id = $3`,
          [index, id, req.params.productId])
      )
    );

    res.json({ message: 'Ordre des photos mis à jour.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { uploadProductImage, deleteProductImage, reorderProductImages };
