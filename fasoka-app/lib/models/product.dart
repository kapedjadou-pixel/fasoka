/// Représente une photo produit avec son identifiant, utile pour la supprimer
/// ou la réordonner (contrairement à la liste de simples URLs renvoyée dans le fil d'accueil).
class ProductImage {
  final String id;
  final String url;
  final int ordre;

  ProductImage({required this.id, required this.url, this.ordre = 0});

  factory ProductImage.fromJson(Map<String, dynamic> json) {
    return ProductImage(
      id: json['id'],
      url: json['image_url'],
      ordre: json['ordre'] ?? 0,
    );
  }
}

class Product {
  final String id;
  final String shopId;
  final String nom;
  final String? description;
  final double prix;
  final int stockQuantite;
  final String? categorie;
  final bool misEnAvant;
  final List<String> images;
  final String? nomBoutique;

  Product({
    required this.id,
    required this.shopId,
    required this.nom,
    this.description,
    required this.prix,
    this.stockQuantite = 0,
    this.categorie,
    this.misEnAvant = false,
    this.images = const [],
    this.nomBoutique,
  });

  factory Product.fromJson(Map<String, dynamic> json) {
    return Product(
      id: json['id'],
      shopId: json['shop_id'],
      nom: json['nom'],
      description: json['description'],
      prix: double.tryParse(json['prix'].toString()) ?? 0,
      stockQuantite: json['stock_quantite'] ?? 0,
      categorie: json['categorie'],
      misEnAvant: json['mis_en_avant'] ?? false,
      images: json['images'] != null ? List<String>.from(json['images']) : [],
      nomBoutique: json['nom_boutique'],
    );
  }
}
