import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/theme/app_theme.dart';
import '../../core/api/api_client.dart';
import '../../models/product.dart';
import '../../providers/space_provider.dart';
import 'product_gallery_screen.dart';

class CatalogScreen extends StatefulWidget {
  const CatalogScreen({super.key});

  @override
  State<CatalogScreen> createState() => _CatalogScreenState();
}

class _CatalogScreenState extends State<CatalogScreen> {
  List<Product> _produits = [];
  bool _chargement = true;

  @override
  void initState() {
    super.initState();
    _charger();
  }

  Future<void> _charger() async {
    final shopId = context.read<SpaceProvider>().maBoutique?.id;
    if (shopId == null) return;
    try {
      final data = await ApiClient.get('/products/shop/$shopId');
      setState(() => _produits = (data as List).map((p) => Product.fromJson(p)).toList());
    } catch (_) {
    } finally {
      setState(() => _chargement = false);
    }
  }

  void _ouvrirFormulaireAjout() {
    final shopId = context.read<SpaceProvider>().maBoutique?.id;
    if (shopId == null) return;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => _FormulaireAjoutProduit(shopId: shopId, onCree: _charger),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      floatingActionButton: FloatingActionButton(
        backgroundColor: AppColors.or,
        onPressed: _ouvrirFormulaireAjout,
        child: const Icon(Icons.add, color: AppColors.noir),
      ),
      body: _chargement
          ? const Center(child: CircularProgressIndicator())
          : _produits.isEmpty
              ? const Center(child: Text('Aucun produit. Ajoute ton premier article !'))
              : RefreshIndicator(
                  onRefresh: _charger,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(12),
                    itemCount: _produits.length,
                    itemBuilder: (context, index) {
                      final p = _produits[index];
                      final stockFaible = p.stockQuantite <= 5;
                      return Card(
                        child: ListTile(
                          onTap: () async {
                            await Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => ProductGalleryScreen(productId: p.id, productNom: p.nom),
                              ),
                            );
                            _charger(); // recharger au retour pour rafraîchir la miniature
                          },
                          leading: ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: p.images.isNotEmpty
                                ? Image.network(p.images.first, width: 48, height: 48, fit: BoxFit.cover)
                                : Container(
                                    width: 48, height: 48, color: AppColors.creme,
                                    child: const Icon(Icons.image_outlined, color: AppColors.grisTexte, size: 20),
                                  ),
                          ),
                          title: Text(p.nom),
                          subtitle: Text('${p.prix.toStringAsFixed(0)} F CFA · Stock: ${p.stockQuantite}'),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              if (stockFaible)
                                const Padding(
                                  padding: EdgeInsets.only(right: 6),
                                  child: Icon(Icons.warning_amber_rounded, color: AppColors.rouge, size: 20),
                                ),
                              const Icon(Icons.chevron_right, color: AppColors.grisTexte),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}

/// Formulaire d'ajout de produit, avec choix de photo (galerie ou appareil photo).
/// La photo est envoyée au backend juste après la création du produit.
class _FormulaireAjoutProduit extends StatefulWidget {
  final String shopId;
  final VoidCallback onCree;

  const _FormulaireAjoutProduit({required this.shopId, required this.onCree});

  @override
  State<_FormulaireAjoutProduit> createState() => _FormulaireAjoutProduitState();
}

class _FormulaireAjoutProduitState extends State<_FormulaireAjoutProduit> {
  final _nomController = TextEditingController();
  final _prixController = TextEditingController();
  final _stockController = TextEditingController();
  File? _photoChoisie;
  bool _envoiEnCours = false;
  String? _erreur;

  Future<void> _choisirPhoto(ImageSource source) async {
    final picker = ImagePicker();
    final fichier = await picker.pickImage(source: source, imageQuality: 80, maxWidth: 1200);
    if (fichier != null) {
      setState(() => _photoChoisie = File(fichier.path));
    }
  }

  void _afficherOptionsPhoto() {
    showModalBottomSheet(
      context: context,
      builder: (context) => SafeArea(
        child: Wrap(
          children: [
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: const Text('Prendre une photo'),
              onTap: () { Navigator.pop(context); _choisirPhoto(ImageSource.camera); },
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Choisir depuis la galerie'),
              onTap: () { Navigator.pop(context); _choisirPhoto(ImageSource.gallery); },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _soumettre() async {
    if (_nomController.text.isEmpty || _prixController.text.isEmpty) {
      setState(() => _erreur = 'Le nom et le prix sont obligatoires.');
      return;
    }
    setState(() { _envoiEnCours = true; _erreur = null; });
    try {
      // 1. Créer le produit
      final produitCree = await ApiClient.post('/products/shop/${widget.shopId}', {
        'nom': _nomController.text.trim(),
        'prix': double.tryParse(_prixController.text) ?? 0,
        'stock_quantite': int.tryParse(_stockController.text) ?? 0,
      });

      // 2. Si une photo a été choisie, l'envoyer juste après (le produit a déjà un ID)
      if (_photoChoisie != null) {
        await ApiClient.uploadFile('/products/${produitCree['id']}/images', _photoChoisie!);
      }

      if (mounted) Navigator.pop(context);
      widget.onCree();
    } on ApiException catch (e) {
      setState(() => _erreur = e.message);
    } catch (e) {
      setState(() => _erreur = 'Une erreur est survenue. Vérifie ta connexion.');
    } finally {
      if (mounted) setState(() => _envoiEnCours = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20, right: 20, top: 20, bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('Nouveau produit', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),

          // Sélecteur de photo
          GestureDetector(
            onTap: _afficherOptionsPhoto,
            child: Container(
              height: 140,
              decoration: BoxDecoration(
                color: AppColors.creme,
                borderRadius: BorderRadius.circular(12),
                image: _photoChoisie != null
                    ? DecorationImage(image: FileImage(_photoChoisie!), fit: BoxFit.cover)
                    : null,
              ),
              child: _photoChoisie == null
                  ? const Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.add_a_photo_outlined, color: AppColors.grisTexte, size: 28),
                        SizedBox(height: 6),
                        Text('Ajouter une photo', style: TextStyle(color: AppColors.grisTexte, fontSize: 13)),
                      ],
                    )
                  : Align(
                      alignment: Alignment.topRight,
                      child: Padding(
                        padding: const EdgeInsets.all(6),
                        child: CircleAvatar(
                          radius: 14, backgroundColor: Colors.black54,
                          child: IconButton(
                            padding: EdgeInsets.zero,
                            icon: const Icon(Icons.close, size: 16, color: Colors.white),
                            onPressed: () => setState(() => _photoChoisie = null),
                          ),
                        ),
                      ),
                    ),
            ),
          ),
          const SizedBox(height: 16),

          TextField(controller: _nomController, decoration: const InputDecoration(hintText: 'Nom du produit')),
          const SizedBox(height: 12),
          TextField(controller: _prixController, keyboardType: TextInputType.number,
              decoration: const InputDecoration(hintText: 'Prix (F CFA)')),
          const SizedBox(height: 12),
          TextField(controller: _stockController, keyboardType: TextInputType.number,
              decoration: const InputDecoration(hintText: 'Quantité en stock')),

          if (_erreur != null) ...[
            const SizedBox(height: 12),
            Text(_erreur!, style: const TextStyle(color: AppColors.rouge)),
          ],

          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: _envoiEnCours ? null : _soumettre,
            child: _envoiEnCours
                ? const SizedBox(height: 20, width: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.noir))
                : const Text('Ajouter'),
          ),
        ],
      ),
    );
  }
}
