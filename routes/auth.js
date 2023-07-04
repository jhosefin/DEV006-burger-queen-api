const { MongoClient } = require('mongodb');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const config = require('../config');

const { secret } = config;

/** @module auth */
module.exports = (app, nextMain) => {
  /**
   * @name /auth
   * @description Crea token de autenticación.
   * @path {POST} /auth
   * @body {String} email Correo
   * @body {String} password Contraseña
   * @response {Object} resp
   * @response {String} resp.token Token a usar para los requests sucesivos
   * @code {200} si la autenticación es correcta
   * @code {400} si no se proveen `email` o `password` o ninguno de los dos
   * @auth No requiere autenticación
   */
  app.post('/login', async (req, resp, next) => {
    const { email, password } = req.body;
    const { dbUrl } = app.get('config');
    if (!email || !password) {
      return next(400);
    }
    const client = new MongoClient(dbUrl);
    await client.connect();
    const db = client.db();
    const usersCollection = db.collection('users');
    // TODO: autenticar a la usuarix
    // Hay que confirmar si el email y password
    // coinciden con un user en la base de datos
    // Si coinciden, manda un access token creado con jwt

    // Fetch user data from the database based on the email
    const user = await usersCollection.findOne({ email });

    if (!user) {
      return next(404); // User not found
    }

    // Compare the provided password with the hashed password stored in the database
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return next(400); // Invalid password
    }

    // Generate a JWT token
    const accessToken = jwt.sign({ userId: user._id, rol: user.role, email: user.email }, secret);
    // Include the token in the response
    resp.status(200).json({ accessToken });
  });

  return nextMain();
};
