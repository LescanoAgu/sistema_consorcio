import 'package:flutter/material.dart';
import 'novedades_screen.dart'; // Separaremos Novedades en su propio archivo
import 'reclamos_screen.dart';
import 'nuevo_reclamo_screen.dart';
import 'login_screen.dart';

void main() {
  runApp(const ConsorcioApp());
}

class ConsorcioApp extends StatelessWidget {
  const ConsorcioApp({super.key});

  @override
Widget build(BuildContext context) {
  return MaterialApp(
    title: 'Gestión Consorcio',
    theme: ThemeData(primarySwatch: Colors.indigo),
    home: const LoginScreen(), // <-- ¡AQUÍ ESTÁ EL CAMBIO!
    debugShowCheckedModeBanner: false,
    );
  }
}

// El nuevo widget principal que contiene la barra de navegación
class MainScreen extends StatefulWidget {
  const MainScreen({super.key});

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  int _selectedIndex = 0; // Índice de la pestaña seleccionada (0: Novedades, 1: Reclamos)

  // Lista de las pantallas que mostraremos
  static const List<Widget> _widgetOptions = <Widget>[
    NovedadesScreen(),
    ReclamosScreen(),
  ];

  void _onItemTapped(int index) {
    setState(() {
      _selectedIndex = index;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_selectedIndex == 0 ? 'Novedades' : 'Reclamos'),
      ),
      body: Center(
        child: _widgetOptions.elementAt(_selectedIndex),
      ),
      // La nueva barra de navegación inferior
      bottomNavigationBar: BottomNavigationBar(
        items: const <BottomNavigationBarItem>[
          BottomNavigationBarItem(
            icon: Icon(Icons.article_outlined),
            label: 'Novedades',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.build_circle_outlined),
            label: 'Reclamos',
          ),
        ],
        currentIndex: _selectedIndex,
        selectedItemColor: Colors.indigo,
        onTap: _onItemTapped,
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          Navigator.of(context).push(
            MaterialPageRoute(builder: (ctx) => const NuevoReclamoScreen()),
          );
        },
        child: const Icon(Icons.add),
      ),
    );
  }
}