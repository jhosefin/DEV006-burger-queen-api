const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const config = require('../config');

const {
  requireAuth,
  requireAdmin,
} = require('../middleware/auth');

const {
  getUsers,
} = require('../controller/users');

const initAdminUser = async (app, next) => {
  const { adminEmail, adminPassword, dbUrl } = app.get('config');
  if (!adminEmail || !adminPassword) {
    return next();
  }

  const adminUser = {
    email: adminEmail,
    password: bcrypt.hashSync(adminPassword, 10),
    role: 'admin',
  };

  try {
    const client = new MongoClient(dbUrl);
    await client.connect();
    const db = client.db();
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ email: adminUser.email });
    if (!user) {
      await usersCollection.insertOne(adminUser);
      /* console.log('Admin user created successfully'); */
    } else {
      /* console.log('Admin user already exists'); */
    }

    client.close();
    return next();
  } catch (err) {
    console.error(err);
    next(err);
  }
};

/*
 * Diagrama de flujo de una aplicación y petición en node - express :
 *
 * request  -> middleware1 -> middleware2 -> route
 *                                             |
 * response <- middleware4 <- middleware3   <---
 *
 * la gracia es que la petición va pasando por cada una de las funciones
 * intermedias o 'middlewares' hasta llegar a la función de la ruta, luego esa
 * función genera la respuesta y esta pasa nuevamente por otras funciones
 * intermedias hasta responder finalmente a la usuaria.
 *
 * Un ejemplo de middleware podría ser una función que verifique que una usuaria
 * está realmente registrado en la aplicación y que tiene permisos para usar la
 * ruta. O también un middleware de traducción, que cambie la respuesta
 * dependiendo del idioma de la usuaria.
 *
 * Es por lo anterior que siempre veremos los argumentos request, response y
 * next en nuestros middlewares y rutas. Cada una de estas funciones tendrá
 * la oportunidad de acceder a la consulta (request) y hacerse cargo de enviar
 * una respuesta (rompiendo la cadena), o delegar la consulta a la siguiente
 * función en la cadena (invocando next). De esta forma, la petición (request)
 * va pasando a través de las funciones, así como también la respuesta
 * (response).
 */

/** @module users */
module.exports = (app, next) => {
  /**
   * @name GET /users
   * @description Lista usuarias
   * @path {GET} /users
   * @query {String} [page=1] Página del listado a consultar
   * @query {String} [limit=10] Cantitad de elementos por página
   * @header {Object} link Parámetros de paginación
   * @header {String} link.first Link a la primera página
   * @header {String} link.prev Link a la página anterior
   * @header {String} link.next Link a la página siguiente
   * @header {String} link.last Link a la última página
   * @auth Requiere `token` de autenticación y que la usuaria sea **admin**
   * @response {Array} users
   * @response {String} users[]._id
   * @response {Object} users[].email
   * @response {Object} users[].roles
   * @response {Boolean} users[].roles.admin
   * @code {200} si la autenticación es correcta
   * @code {401} si no hay cabecera de autenticación
   * @code {403} si no es ni admin
   */
  app.get('/users', requireAdmin, getUsers);

  /**
   * @name GET /users/:uid
   * @description Obtiene información de una usuaria
   * @path {GET} /users/:uid
   * @params {String} :uid `id` o `email` de la usuaria a consultar
   * @auth Requiere `token` de autenticación y que la usuaria sea **admin** o la usuaria a consultar
   * @response {Object} user
   * @response {String} user._id
   * @response {Object} user.email
   * @response {Object} user.roles
   * @response {Boolean} user.roles.admin
   * @code {200} si la autenticación es correcta
   * @code {401} si no hay cabecera de autenticación
   * @code {403} si no es ni admin o la misma usuaria
   * @code {404} si la usuaria solicitada no existe
   */
  app.get('/users/:uid', requireAuth, async (req, resp) => {
    const { uid } = req.params;
    const email = uid;

    const client = new MongoClient(config.dbUrl);
    await client.connect();
    const db = client.db();
    const usersCollection = db.collection('users');
    let users;

    // Verificar si el token pertenece a una usuaria administradora
    const isAdmin = req.isAdmin === true;

    // Verificar si el token pertenece a la misma usuaria o si es una usuaria administradora
    const isAuthorized = req.userId === uid || isAdmin || req.thisEmail === uid;

    if (!isAuthorized) {
      await client.close();
      return resp.status(403).json({
        error: 'No tienes autorización para hacer esta petición',
      });
    }
    // Verificar si ya existe una usuaria con el id o email insertado
    if (uid.includes('@')) {
      users = await usersCollection.findOne({ email });
    } else if (uid === Number) {
      const _id = new ObjectId(uid);
      users = await usersCollection.findOne({ _id });
    }

    if (users) {
      await client.close();
      resp.status(200).json({
        id: users._id,
        email: users.email,
        role: users.role,
      });
    } else {
      await client.close();
      resp.status(404).json({
        error: 'Usuario no encontrado',
      });
    }
  });

  /**
   * @name POST /users
   * @description Crea una usuaria
   * @path {POST} /users
   * @body {String} email Correo
   * @body {String} password Contraseña
   * @body {Object} [roles]
   * @body {Boolean} [roles.admin]
   * @auth Requiere `token` de autenticación y que la usuaria sea **admin**
   * @response {Object} user
   * @response {String} user._id
   * @response {Object} user.email
   * @response {Object} user.roles
   * @response {Boolean} user.roles.admin
   * @code {200} si la autenticación es correcta
   * @code {400} si no se proveen `email` o `password` o ninguno de los dos
   * @code {401} si no hay cabecera de autenticación
   * @code {403} si ya existe usuaria con ese `email`
   */
  app.post('/users', requireAdmin, async (req, resp, next) => {
    // TODO: implementar la ruta para agregar
    // nuevos usuarios
    const { email, password, role } = req.body;
    if (!email || !password || !role) {
      return next(400);
    }

    const client = new MongoClient(config.dbUrl);
    await client.connect();
    /* console.log('Connected successfully to server'); */
    const db = client.db();
    const usersCollection = db.collection('users');

    // Verificar si el token pertenece a una usuaria administradora
    const isAdmin = req.isAdmin === true;

    if (!isAdmin) {
      await client.close();
      return resp.status(403).json({
        error: 'No tienes autorización para postear un usuario',
      });
    }

    // Verificar si ya existe una usuaria con el mismo email
    const user = await usersCollection.findOne({ email });

    if (!user) {
      const newUser = {
        email,
        password: bcrypt.hashSync(password, 10),
        role,
      };

      const insertedUser = await usersCollection.insertOne(newUser);

      await client.close();
      resp.status(200).json({
        id: insertedUser.insertedId,
        email,
        role,
      });
    }
    if (user) {
      await client.close();
      resp.status(403).json({
        error: 'Usuario existe ',
      });
    }
  });

  /**
   * @name PATCH /users
   * @description Modifica una usuaria
   * @params {String} :uid `id` o `email` de la usuaria a modificar
   * @path {PUT} /users
   * @body {String} email Correo
   * @body {String} password Contraseña
   * @body {Object} [roles]
   * @body {Boolean} [roles.admin]
   * @auth Requiere `token` de autenticación y que la usuaria sea **admin** o la usuaria a modificar
   * @response {Object} user
   * @response {String} user._id
   * @response {Object} user.email
   * @response {Object} user.roles
   * @response {Boolean} user.roles.admin
   * @code {200} si la autenticación es correcta
   * @code {400} si no se proveen `email` o `password` o ninguno de los dos
   * @code {401} si no hay cabecera de autenticación
   * @code {403} si no es ni admin o la misma usuaria
   * @code {403} una usuaria no admin intenta de modificar sus `roles`
   * @code {404} si la usuaria solicitada no existe
   */
  app.patch('/users/:uid', requireAuth, async (req, resp/* , next */) => {
    const { uid } = req.params;
    const { email, password, role } = req.body;

    const client = new MongoClient(config.dbUrl);
    await client.connect();
    const db = client.db();
    const usersCollection = db.collection('users');
    let user;

    if (email === '' || password === '' || Object.keys(req.body).length === 0) {
      await client.close();
      resp.status(400).json({
        error: 'Los valores a actualizar no pueden estar vacios',
      });
    } else {
      // Verificar si el token pertenece a una usuaria administradora
      const isAdmin = req.isAdmin === true;
      const isUser = req.userId === uid || req.thisEmail === uid;
      // Verificar si el token pertenece a la misma usuaria o si es una usuaria administradora
      const isAuthorized = isUser || isAdmin;

      if (!isAuthorized) {
        await client.close();
        return resp.status(403).json({
          error: 'No tienes autorización para modificar este usuario',
        });
      }

      if (!isAdmin && role && role !== req.isAdmin) {
        await client.close();
        return resp.status(403).json({
          error: 'No tienes autorización para cambiar el role del usuario',
        });
      }

      // Verificar si la contraseña se está actualizando
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10); // Encriptar la nueva contraseña
        req.body.password = hashedPassword; // Actualizar la contraseña en req.body
      }

      // Verificar si ya existe una usuaria con el id o email insertado
      if (uid.includes('@')) {
        user = await usersCollection.findOneAndUpdate(
          { email: uid },
          { $set: req.body },
          { returnOriginal: false },
        );
      } else {
        const userId = new ObjectId(uid);
        user = await usersCollection.findOneAndUpdate(
          { _id: userId },
          { $set: req.body },
          { returnOriginal: false },
        );
      }

      if (user.value) {
        await client.close();
        return resp.status(200).json({
          id: user.value._id,
          email: user.value.email,
          role: user.value.role,
        });
      }
      // Si el usuario no existe y el usuario es administrador, devolver un error 404
      if (isAdmin) {
        await client.close();
        return resp.status(404).json({
          error: 'Usuario no encontrado',
        });
      }
      await client.close();
      return resp.status(404).json({
        error: 'Usuario no encontrado',
      });
    }
  });

  /**
   * @name DELETE /users
   * @description Elimina una usuaria
   * @params {String} :uid `id` o `email` de la usuaria a modificar
   * @path {DELETE} /users
   * @auth Requiere `token` de autenticación y que la usuaria sea **admin** o la usuaria a eliminar
   * @response {Object} user
   * @response {String} user._id
   * @response {Object} user.email
   * @response {Object} user.roles
   * @response {Boolean} user.roles.admin
   * @code {200} si la autenticación es correcta
   * @code {401} si no hay cabecera de autenticación
   * @code {403} si no es ni admin o la misma usuaria
   * @code {404} si la usuaria solicitada no existe
   */
  app.delete('/users/:uid', requireAuth, async (req, resp/* , next */) => {
    const { uid } = req.params;

    const client = new MongoClient(config.dbUrl);
    await client.connect();
    const db = client.db();
    const usersCollection = db.collection('users');

    // Verificar si el token pertenece a una usuaria administradora
    const isAdmin = req.isAdmin === true;

    // Verificar si el token pertenece a la misma usuaria o si es una usuaria administradora
    const isAuthorized = req.userId === uid || isAdmin || req.thisEmail === uid;

    if (!isAuthorized) {
      await client.close();
      return resp.status(403).json({
        error: 'No tienes autorización para eliminar este usuario',
      });
    }

    // Verificar si ya existe una usuaria con el id o email insertado
    let user;
    if (uid.includes('@')) {
      user = await usersCollection.findOneAndDelete({ email: uid });
    } else {
      const userId = new ObjectId(uid);
      user = await usersCollection.findOneAndDelete({ _id: userId });
    }
    if (user.value) {
      await client.close();
      return resp.status(200).json({
        id: user.value._id,
        email: user.value.email,
        role: user.value.role,
      });
    }
    await client.close();
    return resp.status(404).json({
      error: 'Usuario no encontrado',
    });
  });
  initAdminUser(app, next);
};
