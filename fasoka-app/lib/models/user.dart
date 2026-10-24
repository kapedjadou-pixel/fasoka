class AppUser {
  final String id;
  final String nom;
  final String prenom;
  final String? email;
  final String? telephone;
  final bool compteVerifie;
  final String? photoProfilUrl;

  AppUser({
    required this.id,
    required this.nom,
    required this.prenom,
    this.email,
    this.telephone,
    this.compteVerifie = false,
    this.photoProfilUrl,
  });

  String get nomComplet => '$prenom $nom';

  factory AppUser.fromJson(Map<String, dynamic> json) {
    return AppUser(
      id: json['id'],
      nom: json['nom'],
      prenom: json['prenom'],
      email: json['email'],
      telephone: json['telephone'],
      compteVerifie: json['compte_verifie'] ?? false,
      photoProfilUrl: json['photo_profil_url'],
    );
  }
}
