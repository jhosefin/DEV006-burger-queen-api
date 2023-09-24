const { MongoClient } = require('mongodb');
const config = require('../config');

const { dbUrl } = config;
const client = new MongoClient(dbUrl);

module.exports = {
  getProducts: async (req, resp, next) => {
    try {
      await client.connect();
      const db = client.db();
      const collection = db.collection('products');

      const { page = 1, limit = 10 } = req.query;
      const pageNumber = parseInt(page, 10);
      const limitNumber = parseInt(limit, 10);

      // Calcular el número total de usuarios
      const totalProducts = await collection.countDocuments();
      // Aquí puedes implementar la lógica para obtener las órdenes desde la base de datos
      const totalPages = Math.ceil(totalProducts / limitNumber);
      const startIndex = (pageNumber - 1) * limitNumber;
     const products = await collection.find({}).sort({ _id: -1 }).skip(startIndex).limit(limitNumber)
        .toArray();

      // Utiliza la información de paginación para aplicar la paginación en los resultados
      const linkHeaders = {
        first: `</users?page=1&limit=${limitNumber}>; rel="first"`,
        prev: `</users?page=${pageNumber - 1}&limit=${limitNumber}>; rel="prev"`,
        next: `</users?page=${pageNumber + 1}&limit=${limitNumber}>; rel="next"`,
        last: `</users?page=${totalPages}&limit=${limitNumber}>; rel="last"`,
      };
      // Ejemplo de respuesta con datos de prueba
      // Agregar los encabezados de enlace a la respuesta
      resp.set('link', Object.values(linkHeaders).join(', '));
      resp.send(products);
    } catch (err) {
      /* console.log("mostrar error al traer usuarios de la colección", err); */
      next(err);
    } finally {
      client.close();
    }
  },
};
