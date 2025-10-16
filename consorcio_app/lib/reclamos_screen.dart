import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

class ReclamosScreen extends StatefulWidget {
  const ReclamosScreen({super.key});

  @override
  State<ReclamosScreen> createState() => _ReclamosScreenState();
}

class _ReclamosScreenState extends State<ReclamosScreen> {
  late Future<List<dynamic>> _futureReclamos;

  @override
  void initState() {
    super.initState();
    _futureReclamos = fetchReclamos();
  }

  Future<List<dynamic>> fetchReclamos() async {
    // ¡¡¡RECUERDA USAR TU IP LOCAL!!!
    const url = 'http://192.168.1.35:4000/api/reclamos';
    try {
      final response = await http.get(Uri.parse(url));
      if (response.statusCode == 200) {
        return json.decode(response.body);
      } else {
        throw Exception('Falló la carga de reclamos desde el servidor');
      }
    } catch (e) {
      throw Exception('Error de conexión: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: FutureBuilder<List<dynamic>>(
        future: _futureReclamos,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          } else if (snapshot.hasError) {
            return Center(child: Text('Error: ${snapshot.error}'));
          } else if (snapshot.hasData) {
            final reclamos = snapshot.data!;
            return ListView.builder(
              itemCount: reclamos.length,
              itemBuilder: (context, index) {
                final reclamo = reclamos[index];
                return Card(
                  margin: const EdgeInsets.symmetric(
                    vertical: 8,
                    horizontal: 16,
                  ),
                  child: ListTile(
                    title: Text(reclamo['titulo']),
                    subtitle: Text(
                      reclamo['descripcion'] ?? 'Sin descripción.',
                    ),
                    trailing: Chip(
                      label: Text(reclamo['estado']),
                      backgroundColor: reclamo['estado'] == 'Abierto'
                          ? Colors.orange.shade100
                          : Colors.green.shade100,
                    ),
                  ),
                );
              },
            );
          }
          return const Center(child: Text('No hay reclamos.'));
        },
      ),
    );
  }
}
