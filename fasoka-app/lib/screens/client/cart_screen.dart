import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../core/api/api_client.dart';
import '../../providers/cart_provider.dart';

class CartScreen extends StatefulWidget {
  const CartScreen({super.key});

  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen> {
  bool _envoiEnCours = false;

  Future<void> _validerCommande() async {
    final panier = context.read<CartProvider>();
    if (panier.items.isEmpty) return;

    setState(() => _envoiEnCours = true);
    try {
      await ApiClient.post('/orders', {
        'shop_id': panier.shopId,
        'mode_livraison': 'retrait',
        'operateur': 'especes', // remplacer par le choix réel Mixx/Flooz une fois branché
        'items': panier.items.map((item) => {
          'product_id': item.product.id,
          'quantite': item.quantite,
        }).toList(),
      });
      panier.vider();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Commande passée avec succès !'), backgroundColor: AppColors.or),
        );
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _envoiEnCours = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final panier = context.watch<CartProvider>();

    if (panier.items.isEmpty) {
      return const Center(child: Text('Ton panier est vide.'));
    }

    return Column(
      children: [
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.all(12),
            itemCount: panier.items.length,
            itemBuilder: (context, index) {
              final item = panier.items[index];
              return Card(
                child: ListTile(
                  title: Text(item.product.nom),
                  subtitle: Text('${item.product.prix.toStringAsFixed(0)} F CFA'),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        icon: const Icon(Icons.remove_circle_outline),
                        onPressed: () => panier.changerQuantite(item.product.id, item.quantite - 1),
                      ),
                      Text('${item.quantite}'),
                      IconButton(
                        icon: const Icon(Icons.add_circle_outline),
                        onPressed: () => panier.changerQuantite(item.product.id, item.quantite + 1),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: const BoxDecoration(
            color: Colors.white,
            boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 8, offset: Offset(0, -2))],
          ),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Total', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  Text('${panier.total.toStringAsFixed(0)} F CFA',
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.rouge)),
                ],
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _envoiEnCours ? null : _validerCommande,
                  child: _envoiEnCours
                      ? const SizedBox(height: 20, width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.noir))
                      : const Text('Valider la commande'),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
