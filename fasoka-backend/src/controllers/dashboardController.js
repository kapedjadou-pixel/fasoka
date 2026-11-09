const db = require('../config/database');

// Tableau de bord d'une boutique : tout est calculé à partir des commandes, produits et avis réellement enregistrés.
// Règles :
//  - chiffre d'affaires = total des commandes LIVRÉES, daté du jour de la livraison (dernier changement de statut) ;
//  - commandes reçues / annulées = créées pendant la période ;
//  - commandes en cours, produits actifs, ruptures = état actuel (indépendant de la période) ;
//  - évolution = comparaison avec la période précédente de même durée ;
//  - note : seulement s'il existe des avis (jamais de fausse note).
// Les dates sont en UTC, soit l'heure locale du Togo (GMT).

const JOURS_MAX = 92;
const DATE_MINIMALE = '2020-01-01';
const MS_PAR_JOUR = 24 * 60 * 60 * 1000;

const versTexte = (date) => date.toISOString().slice(0, 10);

function depuisTexte(texte) {
  const [annee, mois, jour] = texte.split('-').map(Number);
  return new Date(Date.UTC(annee, mois - 1, jour));
}

function dateValide(texte) {
  return typeof texte === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(texte) && versTexte(depuisTexte(texte)) === texte;
}

const ajouterJours = (texte, n) => versTexte(new Date(depuisTexte(texte).getTime() + n * MS_PAR_JOUR));
const nombreDeJours = (du, au) => Math.round((depuisTexte(au) - depuisTexte(du)) / MS_PAR_JOUR) + 1;

// Transforme la période demandée en dates : { type, du, au, jours } ou { erreur }
function resoudrePeriode(requete, maintenant = new Date()) {
  const aujourdhui = versTexte(maintenant);
  const type = requete.periode || '7j';

  let du;
  let au;
  if (type === 'aujourdhui') {
    du = aujourdhui;
    au = aujourdhui;
  } else if (type === '7j') {
    du = ajouterJours(aujourdhui, -6);
    au = aujourdhui;
  } else if (type === '30j') {
    du = ajouterJours(aujourdhui, -29);
    au = aujourdhui;
  } else if (type === 'perso') {
    if (!dateValide(requete.du) || !dateValide(requete.au)) {
      return { erreur: 'Choisis une date de début et une date de fin valides.' };
    }
    du = requete.du;
    au = requete.au > aujourdhui ? aujourdhui : requete.au; // pas de données dans le futur
    if (du < DATE_MINIMALE) return { erreur: 'La date de début est trop ancienne.' };
    if (du > au) return { erreur: 'La date de début doit précéder la date de fin.' };
    if (nombreDeJours(du, au) > JOURS_MAX) {
      return { erreur: `La période ne peut pas dépasser ${JOURS_MAX} jours.` };
    }
  } else {
    return { erreur: 'Période inconnue.' };
  }
  return { type, du, au, jours: nombreDeJours(du, au) };
}

const nombre = (valeur) => Number(valeur) || 0;

// Série du graphique : une barre par heure pour une seule journée, sinon une barre par jour (jours sans vente = 0)
function construireSerie(periode, lignes) {
  const parCle = new Map(lignes.map((l) => [String(l.cle), l]));
  const points = [];
  if (periode.du === periode.au) {
    for (let h = 0; h < 24; h += 1) {
      const l = parCle.get(String(h));
      points.push({ cle: String(h), libelle: String(h).padStart(2, '0') + 'h', montant: l ? nombre(l.montant) : 0, commandes: l ? nombre(l.commandes) : 0 });
    }
    return { granularite: 'heure', points };
  }
  for (let jour = periode.du; jour <= periode.au; jour = ajouterJours(jour, 1)) {
    const l = parCle.get(jour);
    const [, mois, j] = jour.split('-');
    points.push({ cle: jour, libelle: `${j}/${mois}`, montant: l ? nombre(l.montant) : 0, commandes: l ? nombre(l.commandes) : 0 });
  }
  return { granularite: 'jour', points };
}

// GET /api/shops/:shopId/dashboard?periode=aujourdhui|7j|30j|perso[&du=AAAA-MM-JJ&au=AAAA-MM-JJ]
async function dashboard(req, res, next) {
  try {
    const periode = resoudrePeriode(req.query);
    if (periode.erreur) {
      return res.status(400).json({ error: periode.erreur });
    }
    const shopId = req.params.shopId;
    const precedentAu = ajouterJours(periode.du, -1);
    const precedentDu = ajouterJours(precedentAu, -(periode.jours - 1));

    const serieSql =
      periode.du === periode.au
        ? `SELECT EXTRACT(HOUR FROM updated_at)::int AS cle, SUM(montant_total) AS montant, COUNT(*)::int AS commandes
           FROM orders WHERE shop_id = $1 AND statut = 'livree' AND updated_at::date = $2::date
           GROUP BY 1 ORDER BY 1`
        : `SELECT to_char(updated_at, 'YYYY-MM-DD') AS cle, SUM(montant_total) AS montant, COUNT(*)::int AS commandes
           FROM orders WHERE shop_id = $1 AND statut = 'livree' AND updated_at::date BETWEEN $2::date AND $3::date
           GROUP BY 1 ORDER BY 1`;

    const [boutique, ventes, precedent, recues, etat, catalogue, avis, serie, plusVendus, dernieres] = await Promise.all([
      db.query(
        `SELECT nom_boutique, ville, plan, plan_expire_le, badge_verifie, logo_url, nombre_abonnes FROM shops WHERE id = $1`,
        [shopId]
      ),
      db.query(
        `SELECT COALESCE(SUM(montant_total), 0) AS chiffre_affaires, COUNT(*)::int AS livrees
         FROM orders WHERE shop_id = $1 AND statut = 'livree' AND updated_at::date BETWEEN $2::date AND $3::date`,
        [shopId, periode.du, periode.au]
      ),
      db.query(
        `SELECT COALESCE(SUM(montant_total), 0) AS chiffre_affaires, COUNT(*)::int AS livrees
         FROM orders WHERE shop_id = $1 AND statut = 'livree' AND updated_at::date BETWEEN $2::date AND $3::date`,
        [shopId, precedentDu, precedentAu]
      ),
      db.query(
        `SELECT COUNT(*)::int AS recues, COUNT(*) FILTER (WHERE statut = 'annulee')::int AS annulees
         FROM orders WHERE shop_id = $1 AND created_at::date BETWEEN $2::date AND $3::date`,
        [shopId, periode.du, periode.au]
      ),
      db.query(
        `SELECT COUNT(*) FILTER (WHERE statut IN ('en_attente', 'confirmee', 'en_preparation', 'prete'))::int AS en_cours,
                COUNT(*) FILTER (WHERE statut = 'en_attente')::int AS en_attente
         FROM orders WHERE shop_id = $1`,
        [shopId]
      ),
      db.query(
        `SELECT COUNT(*)::int AS actifs,
                COUNT(*) FILTER (WHERE stock_quantite <= 0)::int AS ruptures,
                COUNT(*) FILTER (WHERE stock_quantite > 0 AND stock_quantite <= stock_alerte_seuil)::int AS stock_faible
         FROM products WHERE shop_id = $1 AND actif = TRUE`,
        [shopId]
      ),
      db.query(`SELECT COUNT(*)::int AS nombre, AVG(note) AS moyenne FROM reviews WHERE shop_id = $1`, [shopId]),
      db.query(serieSql, periode.du === periode.au ? [shopId, periode.du] : [shopId, periode.du, periode.au]),
      db.query(
        `SELECT p.id, p.nom, SUM(oi.quantite)::int AS quantite, SUM(oi.quantite * oi.prix_unitaire) AS montant,
                (SELECT image_url FROM product_images WHERE product_id = p.id ORDER BY ordre, id LIMIT 1) AS image
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         JOIN products p ON p.id = oi.product_id
         WHERE o.shop_id = $1 AND o.statut = 'livree' AND o.updated_at::date BETWEEN $2::date AND $3::date
         GROUP BY p.id, p.nom
         ORDER BY quantite DESC, montant DESC
         LIMIT 5`,
        [shopId, periode.du, periode.au]
      ),
      db.query(
        `SELECT o.id, o.statut, o.montant_total, o.mode_livraison, o.created_at, u.prenom, u.nom
         FROM orders o JOIN users u ON u.id = o.client_id
         WHERE o.shop_id = $1 ORDER BY o.created_at DESC LIMIT 5`,
        [shopId]
      ),
    ]);

    const ca = nombre(ventes.rows[0].chiffre_affaires);
    const livrees = nombre(ventes.rows[0].livrees);
    const caPrecedent = nombre(precedent.rows[0].chiffre_affaires);
    const nombreAvis = nombre(avis.rows[0].nombre);
    const b = boutique.rows[0] || {};

    res.json({
      periode: { type: periode.type, du: periode.du, au: periode.au, jours: periode.jours },
      boutique: {
        nom_boutique: b.nom_boutique,
        ville: b.ville,
        plan: b.plan,
        plan_expire_le: b.plan_expire_le,
        badge_verifie: Boolean(b.badge_verifie),
        logo_url: b.logo_url,
        abonnes: nombre(b.nombre_abonnes),
      },
      ventes: {
        chiffre_affaires: ca,
        commandes_livrees: livrees,
        panier_moyen: livrees > 0 ? Math.round(ca / livrees) : null,
        precedent: { chiffre_affaires: caPrecedent, commandes_livrees: nombre(precedent.rows[0].livrees) },
        // seulement si la période précédente avait des ventes (sinon le pourcentage n'aurait pas de sens)
        evolution_pct: caPrecedent > 0 ? Math.round(((ca - caPrecedent) / caPrecedent) * 100) : null,
      },
      commandes: {
        recues: nombre(recues.rows[0].recues),
        annulees: nombre(recues.rows[0].annulees),
        en_cours: nombre(etat.rows[0].en_cours),
        en_attente: nombre(etat.rows[0].en_attente),
      },
      catalogue: {
        actifs: nombre(catalogue.rows[0].actifs),
        ruptures: nombre(catalogue.rows[0].ruptures),
        stock_faible: nombre(catalogue.rows[0].stock_faible),
      },
      avis: {
        nombre: nombreAvis,
        note_moyenne: nombreAvis > 0 ? Math.round(nombre(avis.rows[0].moyenne) * 10) / 10 : null,
      },
      serie: construireSerie(periode, serie.rows),
      plus_vendus: plusVendus.rows.map((p) => ({
        id: p.id, nom: p.nom, quantite: nombre(p.quantite), montant: nombre(p.montant), image: p.image || null,
      })),
      dernieres_commandes: dernieres.rows.map((o) => ({
        id: o.id,
        statut: o.statut,
        montant_total: nombre(o.montant_total),
        mode_livraison: o.mode_livraison,
        created_at: o.created_at,
        client: `${o.prenom || ''} ${o.nom || ''}`.trim() || 'Client',
      })),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { dashboard, resoudrePeriode };
