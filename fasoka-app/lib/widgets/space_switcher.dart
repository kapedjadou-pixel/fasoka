import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/theme/app_theme.dart';
import '../providers/space_provider.dart';
import '../screens/boutique/shop_creation_screen.dart';
import '../screens/boutique/boutique_dashboard_screen.dart';
import '../screens/client/client_home_screen.dart';

/// Bouton/menu permettant de basculer entre l'espace client et l'espace boutique,
/// comme le changement de profil <-> page sur Facebook.
class SpaceSwitcher extends StatelessWidget {
  const SpaceSwitcher({super.key});

  @override
  Widget build(BuildContext context) {
    final spaceProvider = context.watch<SpaceProvider>();

    return PopupMenuButton<String>(
      icon: const Icon(Icons.swap_horiz, color: AppColors.or),
      onSelected: (value) {
        if (value == 'client') {
          spaceProvider.basculerVersClient();
          Navigator.of(context).pushAndRemoveUntil(
            MaterialPageRoute(builder: (_) => const ClientHomeScreen()),
            (route) => false,
          );
        } else if (value == 'boutique') {
          if (spaceProvider.aUneBoutique) {
            spaceProvider.basculerVersBoutique();
            Navigator.of(context).pushAndRemoveUntil(
              MaterialPageRoute(builder: (_) => const BoutiqueDashboardScreen()),
              (route) => false,
            );
          } else {
            Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const ShopCreationScreen()),
            );
          }
        }
      },
      itemBuilder: (context) => [
        const PopupMenuItem(value: 'client', child: Text('Espace Client')),
        PopupMenuItem(
          value: 'boutique',
          child: Text(spaceProvider.aUneBoutique ? 'Espace Boutique' : 'Créer ma boutique'),
        ),
      ],
    );
  }
}
