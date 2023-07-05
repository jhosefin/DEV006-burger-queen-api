const { MongoClient } = require('mongodb');
const config = require('../config');

const { dbUrl } = config;
const client = new MongoClient(dbUrl);

module.exports = {
  getUsers: async (req, resp, next) => {
    try {
      await client.connect();
      const db = client.db();
      const collection = db.collection('users');

      // Obtener los parámetros de consulta de página y límite
      const { page = 1, limit = 10 } = req.query;
      const pageNumber = parseInt(page);
      const limitNumber = parseInt(limit);

      // Calcular el número total de usuarios
      const totalUsers = await collection.countDocuments();

      // Calcular el número total de páginas
      const totalPages = Math.ceil(totalUsers / limitNumber);

      // Calcular el índice de inicio y fin para la consulta
      const startIndex = (pageNumber - 1) * limitNumber;
      const endIndex = startIndex + limitNumber;

      // Obtener la lista de usuarios paginada
      const users = await collection.find({}).skip(startIndex).limit(limitNumber).toArray();

      // Crear los encabezados de enlace (link headers)
      const linkHeaders = {
        first: `</users?page=1&limit=${limitNumber}>; rel="first"`,
        prev: `</users?page=${pageNumber - 1}&limit=${limitNumber}>; rel="prev"`,
        next: `</users?page=${pageNumber + 1}&limit=${limitNumber}>; rel="next"`,
        last: `</users?page=${totalPages}&limit=${limitNumber}>; rel="last"`,
      };

      // Agregar los encabezados de enlace a la respuesta
      resp.set('link', Object.values(linkHeaders).join(', '));

      // Enviar la respuesta con la lista de usuarios
      resp.send(users);
    } catch (err) {
      /* console.log("mostrar error al traer usuarios de la colección", err); */
      next(err);
    } finally {
      client.close();
    }
  },
};
