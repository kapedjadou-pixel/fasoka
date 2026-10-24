class Shop {
  final String id;
  final String nomBoutique;
  final String? logoUrl;
  final String? description;
  final String? categorie;
  final String ville;
  final String plan;
  final bool badgeVerifie;
  final double scoreConfiance;
  final int nombreVentes;
  final int nombreAbonnes;

  Shop({
    required this.id,
    required this.nomBoutique,
    this.logoUrl,
    this.description,
    this.categorie,
    this.ville = 'Lomé',
    this.plan = 'gratuit',
    this.badgeVerifie = false,
    this.scoreConfiance = 0.0,
    this.nombreVentes = 0,
    this.nombreAbonnes = 0,
  });

  factory Shop.fromJson(Map<String, dynamic> json) {
    return Shop(
      id: json['id'],
      nomBoutique: json['nom_boutique'],
      logoUrl: json['logo_url'],
      description: json['description'],
      categorie: json['categorie'],
      ville: json['ville'] ?? 'Lomé',
      plan: json['plan'] ?? 'gratuit',
      badgeVerifie: json['badge_verifie'] ?? false,
      scoreConfiance: double.tryParse(json['score_confiance']?.toString() ?? '0') ?? 0.0,
      nombreVentes: json['nombre_ventes'] ?? 0,
      nombreAbonnes: json['nombre_abonnes'] ?? 0,
    );
  }
}
