import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../providers/auth_provider.dart';
import '../auth/login_screen.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        CircleAvatar(
          radius: 40,
          backgroundColor: AppColors.or,
          child: Text(
            user != null ? user.prenom[0].toUpperCase() : '?',
            style: const TextStyle(fontSize: 32, color: AppColors.noir, fontWeight: FontWeight.bold),
          ),
        ),
        const SizedBox(height: 12),
        Text(user?.nomComplet ?? '', textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
        if (user?.email != null)
          Text(user!.email!, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.grisTexte)),
        const SizedBox(height: 32),
        const Divider(),
        ListTile(leading: const Icon(Icons.favorite_border), title: const Text('Mes favoris'), onTap: () {}),
        ListTile(leading: const Icon(Icons.notifications_none), title: const Text('Notifications'), onTap: () {}),
        ListTile(leading: const Icon(Icons.help_outline), title: const Text('Aide'), onTap: () {}),
        const Divider(),
        ListTile(
          leading: const Icon(Icons.logout, color: AppColors.rouge),
          title: const Text('Se déconnecter', style: TextStyle(color: AppColors.rouge)),
          onTap: () async {
            await context.read<AuthProvider>().deconnexion();
            if (context.mounted) {
              Navigator.of(context).pushAndRemoveUntil(
                MaterialPageRoute(builder: (_) => const LoginScreen()),
                (route) => false,
              );
            }
          },
        ),
      ],
    );
  }
}
