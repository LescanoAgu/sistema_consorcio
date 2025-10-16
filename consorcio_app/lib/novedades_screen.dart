import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

class NovedadesScreen extends StatefulWidget {
  const NovedadesScreen({super.key});

  @override
  State<NovedadesScreen> createState() => _NovedadesScreenState();
}

class _NovedadesScreenState extends State<NovedadesScreen> {
  late Future<List<dynamic>> _futureNovedades;

  @override
  void initState() {
    super.initState();
    _futureNovedades = fetchNovedades();
  }

  Future<List<dynamic>> fetchNovedades() async {
    // ¡¡¡RECUERDA USAR TU IP LOCAL!!!
    const url = 'http://192.168.1.35:4000/api/comunicados';
    try {
      final response = await http.get(Uri.parse(url));
      if (response.statusCode == 200) {
        return json.decode(response.body);
      } else {
        throw Exception('Falló la carga de novedades');
      }
    } catch (e) {
      throw Exception('Error de conexión: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: FutureBuilder<List<dynamic>>(
        future: _futureNovedades,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          } else if (snapshot.hasError) {
            return Center(child: Text('Error: ${snapshot.error}'));
          } else if (snapshot.hasData) {
            final novedades = snapshot.data!;
            return ListView.builder(
              itemCount: novedades.length,
              itemBuilder: (context, index) {
                final novedad = novedades[index];
                return Card(
                  margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
                  child: ListTile(
                    leading: const Icon(Icons.article_outlined),
                    title: Text(novedad['titulo'], style: const TextStyle(fontWeight: FontWeight.bold)),
                    subtitle: Text(novedad['contenido']),
                    trailing: Text(novedad['fecha']),
                  ),
                );
              },
            );
          }
          return const Center(child: Text('No hay novedades.'));
        },
      ),
    );
  }
}