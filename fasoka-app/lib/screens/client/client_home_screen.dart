import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../core/api/api_client.dart';
import '../../models/product.dart';
import '../../providers/cart_provider.dart';
import '../../widgets/space_switcher.dart';
import 'cart_screen.dart';
import 'history_screen.dart';
import 'profile_screen.dart';

class ClientHomeScreen extends StatefulWidget {
  const ClientHomeScreen({super.key});

  @override
  State<ClientHomeScreen> createState() => _ClientHomeScreenState();
}

class _ClientHomeScreenState extends State<ClientHomeScreen> {
  int _ongletActif = 0;
  List<Product> _produits = [];
  bool _chargement = true;
  String? _erreur;
  final _rechercheController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _chargerFil();
  }

  Future<void> _chargerFil({String? recherche}) async {
    setState(() { _chargement = true; _erreur = null; });
    try {
      final data = await ApiClient.get('/products/feed',
          query: recherche != null && recherche.isNotEmpty ? {'recherche': recherche} : null);
      setState(() {
        _produits = (data as List).map((p) => Product.fromJson(p)).toList();
      });
    } on ApiException catch (e) {
      setState(() => _erreur = e.message);
    } catch (e) {
      setState(() => _erreur = 'Impossible de charger les produits.');
    } finally {
      setState(() => _chargement = false);
    }
  }

  Widget _corpsAccueil() {
    return RefreshIndicator(
      onRefresh: () => _chargerFil(recherche: _rechercheController.text),
      child: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: TextField(
                controller: _rechercheController,
                onSubmitted: (v) => _chargerFil(recherche: v),
                decoration: InputDecoration(
                  hintText: 'Rechercher un produit...',
                  prefixIcon: const Icon(Icons.search),
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                ),
              ),
            ),
          ),
          if (_chargement)
            const SliverFillRemaining(child: Center(child: CircularProgressIndicator()))
          else if (_erreur != null)
            SliverFillRemaining(child: Center(child: Text(_erreur!)))
          else if (_produits.isEmpty)
            const SliverFillRemaining(child: Center(child: Text('Aucun produit trouvé.')))
          else
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              sliver: SliverGrid(
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2, mainAxisSpacing: 12, crossAxisSpacing: 12, childAspectRatio: 0.72,
                ),
                delegate: SliverChildBuilderDelegate(
                  (context, index) => _carteProduit(_produits[index]),
                  childCount: _produits.length,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _carteProduit(Product produit) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Container(
              width: double.infinity,
              color: AppColors.creme,
              child: produit.images.isNotEmpty
                  ? Image.network(produit.images.first, fit: BoxFit.cover)
                  : const Icon(Icons.shopping_bag_outlined, size: 40, color: AppColors.grisTexte),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(produit.nom, maxLines: 1, overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w600)),
                if (produit.nomBoutique != null)
                  Text(produit.nomBoutique!, maxLines: 1, overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 12, color: AppColors.grisTexte)),
                const SizedBox(height: 4),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('${produit.prix.toStringAsFixed(0)} F',
                        style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.rouge)),
                    InkWell(
                      onTap: () {
                        context.read<CartProvider>().ajouter(produit);
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Ajouté au panier'), duration: Duration(seconds: 1)),
                        );
                      },
                      child: const CircleAvatar(radius: 14, backgroundColor: AppColors.or,
                          child: Icon(Icons.add, size: 16, color: AppColors.noir)),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final ecrans = [_corpsAccueil(), const CartScreen(), const HistoryScreen(), const ProfileScreen()];
    final panier = context.watch<CartProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Fasoka'),
        actions: const [SpaceSwitcher(), SizedBox(width: 8)],
      ),
      body: ecrans[_ongletActif],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _ongletActif,
        onTap: (i) => setState(() => _ongletActif = i),
        items: [
          const BottomNavigationBarItem(icon: Icon(Icons.storefront_outlined), label: 'Accueil'),
          BottomNavigationBarItem(
            icon: Badge(
              label: Text('${panier.nombreArticles}'),
              isLabelVisible: panier.nombreArticles > 0,
              child: const Icon(Icons.shopping_cart_outlined),
            ),
            label: 'Panier',
          ),
          const BottomNavigationBarItem(icon: Icon(Icons.receipt_long_outlined), label: 'Historique'),
          const BottomNavigationBarItem(icon: Icon(Icons.person_outline), label: 'Profil'),
        ],
      ),
    );
  }
}
