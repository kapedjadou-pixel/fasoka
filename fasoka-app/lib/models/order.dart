import 'product.dart';

class ShopOrder {
  final String id;
  final String statut;
  final double montantTotal;
  final String modeLivraison;
  final DateTime createdAt;
  final String? nomBoutique;

  ShopOrder({
    required this.id,
    required this.statut,
    required this.montantTotal,
    required this.modeLivraison,
    required this.createdAt,
    this.nomBoutique,
  });

  factory ShopOrder.fromJson(Map<String, dynamic> json) {
    return ShopOrder(
      id: json['id'],
      statut: json['statut'],
      montantTotal: double.tryParse(json['montant_total'].toString()) ?? 0,
      modeLivraison: json['mode_livraison'] ?? 'retrait',
      createdAt: DateTime.parse(json['created_at']),
      nomBoutique: json['nom_boutique'],
    );
  }
}

class CartItem {
  final Product product;
  int quantite;
  CartItem({required this.product, this.quantite = 1});
  double get sousTotal => product.prix * quantite;
}
