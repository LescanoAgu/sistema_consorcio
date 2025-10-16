const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs'); // NUEVO: Para encriptar contraseñas
const jwt = require('jsonwebtoken'); // NUEVO: Para crear tokens de sesión

const app = express();
const PORT = 4000;
const JWT_SECRET = "este_es_un_secreto_muy_seguro_para_mi_app"; // NUEVO: Clave secreta para los tokens

app.use(cors());
app.use(express.json());

// Conexión a la DB
const db = new sqlite3.Database('./consorcio.db', (err) => {
    if (err) {
        return console.error("Error al abrir la base de datos:", err.message);
    }
    console.log('✅ Conectado a la base de datos SQLite.');
    db.run(`CREATE TABLE IF NOT EXISTS comunicados (id INTEGER PRIMARY KEY, titulo TEXT, contenido TEXT, fecha TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS reclamos (id INTEGER PRIMARY KEY, titulo TEXT, descripcion TEXT, estado TEXT)`);

    // --- NUEVO: Creación de la tabla de usuarios ---
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        nombre TEXT
    )`);
});

// --- Endpoint para REGISTRAR un nuevo usuario ---
app.post('/api/register', async (req, res) => {
    const { email, password, nombre } = req.body;
    if (!email || !password) {
        return res.status(400).json({ "error": "Email y contraseña son obligatorios." });
    }

    const hashedPassword = await bcrypt.hash(password, 10); // Encriptamos la contraseña

    const sql = `INSERT INTO usuarios (email, password, nombre) VALUES (?, ?, ?)`;
    db.run(sql, [email, hashedPassword, nombre], function(err) {
        if (err) {
            // El código 19 suele ser por 'UNIQUE constraint failed', es decir, el email ya existe
            if (err.errno === 19) {
                return res.status(409).json({ "error": "El email ya está registrado." });
            }
            return res.status(500).json({ "error": err.message });
        }
        res.status(201).json({ "message": "Usuario registrado con éxito", "userId": this.lastID });
    });
});

// --- Endpoint para HACER LOGIN ---
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const sql = `SELECT * FROM usuarios WHERE email = ?`;

    db.get(sql, [email], async (err, user) => {
        if (err) {
            return res.status(500).json({ "error": err.message });
        }
        // Si no se encuentra el usuario
        if (!user) {
            return res.status(401).json({ "error": "Credenciales inválidas" }); // 401: Unauthorized
        }

        // Comparamos la contraseña enviada con la guardada en la DB
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ "error": "Credenciales inválidas" });
        }

        // Si todo es correcto, creamos un token
        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ "message": "Login exitoso", "token": token });
    });
});


// --- Endpoints existentes (comunicados y reclamos) ---
app.get('/api/comunicados', (req, res) => { /* ...código sin cambios... */ });
app.get('/api/reclamos', (req, res) => { /* ...código sin cambios... */ });
app.post('/api/reclamos', (req, res) => { /* ...código sin cambios... */ });

app.listen(PORT, () => {
    console.log(`✅ Servidor del consorcio corriendo en http://localhost:${PORT}`);
});