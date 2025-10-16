import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

class NuevoReclamoScreen extends StatefulWidget {
  const NuevoReclamoScreen({super.key});

  @override
  State<NuevoReclamoScreen> createState() => _NuevoReclamoScreenState();
}

class _NuevoReclamoScreenState extends State<NuevoReclamoScreen> {
  // Controladores para obtener el texto de los campos del formulario
  final _tituloController = TextEditingController();
  final _descripcionController = TextEditingController();
  bool _estaCargando = false;

  Future<void> _enviarReclamo() async {
    // Validamos que el título no esté vacío
    if (_tituloController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('El título no puede estar vacío.')),
      );
      return;
    }

    setState(() {
      _estaCargando = true;
    });

    // Reemplaza con tu IP Local
    const url = 'http://192.168.1.35:4000/api/reclamos';

    try {
      final response = await http.post(
        Uri.parse(url),
        headers: {'Content-Type': 'application/json; charset=UTF-8'},
        body: json.encode({
          'titulo': _tituloController.text,
          'descripcion': _descripcionController.text,
        }),
      );

      if (response.statusCode == 201) {
        // 201 = Created
        // Si el reclamo se creó con éxito, mostramos un mensaje y cerramos la pantalla
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Reclamo enviado con éxito')),
        );
        Navigator.of(context).pop(); // Cierra la pantalla del formulario
      } else {
        // Si el servidor dio un error, lo mostramos
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error del servidor: ${response.body}')),
        );
      }
    } catch (e) {
      // Si hubo un error de conexión
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Error de conexión: $e')));
    } finally {
      setState(() {
        _estaCargando = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Crear Nuevo Reclamo')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            TextField(
              controller: _tituloController,
              decoration: const InputDecoration(labelText: 'Título'),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _descripcionController,
              decoration: const InputDecoration(
                labelText: 'Descripción (opcional)',
              ),
              maxLines: 4,
            ),
            const SizedBox(height: 32),
            // Si está cargando, muestra el indicador, si no, muestra el botón
            _estaCargando
                ? const CircularProgressIndicator()
                : ElevatedButton(
                    onPressed: _enviarReclamo,
                    child: const Text('Enviar Reclamo'),
                  ),
          ],
        ),
      ),
    );
  }
}
