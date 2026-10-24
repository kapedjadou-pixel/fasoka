import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/theme/app_theme.dart';
import '../../core/api/api_client.dart';
import '../../models/product.dart';

/// Écran de gestion des photos d'un produit : ajouter, supprimer, réordonner.
/// On y accède en tapant sur un produit dans le catalogue.
class ProductGalleryScreen extends StatefulWidget {
  final String productId;
  final String productNom;

  const ProductGalleryScreen({super.key, required this.productId, required this.productNom});

  @override
  State<ProductGalleryScreen> createState() => _ProductGalleryScreenState();
}

class _ProductGalleryScreenState extends State<ProductGalleryScreen> {
  List<ProductImage> _images = [];
  bool _chargement = true;
  bool _envoiEnCours = false;

  @override
  void initState() {
    super.initState();
    _charger();
  }

  Future<void> _charger() async {
    try {
      final data = await ApiClient.get('/products/${widget.productId}');
      final images = (data['images'] as List).map((i) => ProductImage.fromJson(i)).toList();
      setState(() => _images = images);
    } catch (_) {
      // silencieux, la liste reste vide si erreur
    } finally {
      setState(() => _chargement = false);
    }
  }

  Future<void> _ajouterPhoto(ImageSource source) async {
    final picker = ImagePicker();
    final fichier = await picker.pickImage(source: source, imageQuality: 80, maxWidth: 1200);
    if (fichier == null) return;

    setState(() => _envoiEnCours = true);
    try {
      await ApiClient.uploadFile('/products/${widget.productId}/images', File(fichier.path));
      await _charger();
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Impossible d\'envoyer la photo. Vérifie ta connexion.')),
        );
      }
    } finally {
      if (mounted) setState(() => _envoiEnCours = false);
    }
  }

  void _proposerSourcePhoto() {
    showModalBottomSheet(
      context: context,
      builder: (context) => SafeArea(
        child: Wrap(
          children: [
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: const Text('Prendre une photo'),
              onTap: () { Navigator.pop(context); _ajouterPhoto(ImageSource.camera); },
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Choisir depuis la galerie'),
              onTap: () { Navigator.pop(context); _ajouterPhoto(ImageSource.gallery); },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _supprimerPhoto(ProductImage image) async {
    final confirme = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Supprimer cette photo ?'),
        content: const Text('Cette action est définitive.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Annuler')),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Supprimer', style: TextStyle(color: AppColors.rouge)),
          ),
        ],
      ),
    );
    if (confirme != true) return;

    setState(() => _images.removeWhere((i) => i.id == image.id)); // retrait optimiste
    try {
      await ApiClient.delete('/products/${widget.productId}/images/${image.id}');
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      _charger(); // on recharge pour resynchroniser en cas d'échec
    }
  }

  Future<void> _reordonner(int oldIndex, int newIndex) async {
    setState(() {
      if (newIndex > oldIndex) newIndex -= 1;
      final item = _images.removeAt(oldIndex);
      _images.insert(newIndex, item);
    });
    try {
      await ApiClient.patch('/products/${widget.productId}/images/reorder', {
        'image_ids': _images.map((i) => i.id).toList(),
      });
    } catch (_) {
      // Pas bloquant pour l'utilisateur ; on pourrait notifier discrètement si besoin.
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Photos — ${widget.productNom}')),
      body: _chargement
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                if (_images.isNotEmpty)
                  const Padding(
                    padding: EdgeInsets.all(12),
                    child: Text(
                      'Maintiens et fais glisser une photo pour changer son ordre. La première photo est celle affichée dans le catalogue.',
                      style: TextStyle(fontSize: 12, color: AppColors.grisTexte),
                    ),
                  ),
                Expanded(
                  child: _images.isEmpty
                      ? const Center(child: Text('Aucune photo pour ce produit.'))
                      : ReorderableListView.builder(
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          itemCount: _images.length,
                          onReorder: _reordonner,
                          itemBuilder: (context, index) {
                            final image = _images[index];
                            return Card(
                              key: ValueKey(image.id),
                              child: ListTile(
                                leading: ClipRRect(
                                  borderRadius: BorderRadius.circular(8),
                                  child: Image.network(image.url, width: 48, height: 48, fit: BoxFit.cover),
                                ),
                                title: Text(index == 0 ? 'Photo principale' : 'Photo ${index + 1}'),
                                trailing: IconButton(
                                  icon: const Icon(Icons.delete_outline, color: AppColors.rouge),
                                  onPressed: () => _supprimerPhoto(image),
                                ),
                              ),
                            );
                          },
                        ),
                ),
              ],
            ),
      floatingActionButton: FloatingActionButton(
        backgroundColor: AppColors.or,
        onPressed: _envoiEnCours ? null : _proposerSourcePhoto,
        child: _envoiEnCours
            ? const SizedBox(height: 20, width: 20,
                child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.noir))
            : const Icon(Icons.add_a_photo_outlined, color: AppColors.noir),
      ),
    );
  }
}
