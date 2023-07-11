const { MongoClient, ObjectId } = require('mongodb');
const {
  requireAuth,
  requireAdmin,
} = require('../middleware/auth');
const config = require('../config');

/** @module products */
module.exports = (app, nextMain) => {
  /**
   * @name GET /products
   * @description Lista productos
   * @path {GET} /products
   * @query {String} [page=1] Página del listado a consultar
   * @query {String} [limit=10] Cantitad de elementos por página
   * @header {Object} link Parámetros de paginación
   * @header {String} link.first Link a la primera página
   * @header {String} link.prev Link a la página anterior
   * @header {String} link.next Link a la página siguiente
   * @header {String} link.last Link a la última página
   * @auth Requiere `token` de autenticación
   * @response {Array} products
   * @response {String} products[]._id Id
   * @response {String} products[].name Nombre
   * @response {Number} products[].price Precio
   * @response {URL} products[].image URL a la imagen
   * @response {String} products[].type Tipo/Categoría
   * @response {Date} products[].dateEntry Fecha de creación
   * @code {200} si la autenticación es correcta
   * @code {401} si no hay cabecera de autenticación
   */
  app.get('/products', requireAuth, async (req, resp/* , next */) => {
    const client = new MongoClient(config.dbUrl);
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
    const products = await collection.find({}).skip(startIndex).limit(limitNumber).toArray();

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
  });

  /**
   * @name GET /products/:productId
   * @description Obtiene los datos de un producto especifico
   * @path {GET} /products/:productId
   * @params {String} :productId `id` del producto
   * @auth Requiere `token` de autenticación
   * @response {Object} product
   * @response {String} product._id Id
   * @response {String} product.name Nombre
   * @response {Number} product.price Precio
   * @response {URL} product.image URL a la imagen
   * @response {String} product.type Tipo/Categoría
   * @response {Date} product.dateEntry Fecha de creación
   * @code {200} si la autenticación es correcta
   * @code {401} si no hay cabecera de autenticación
   * @code {404} si el producto con `productId` indicado no existe
   */
  app.get('/products/:productId', requireAuth, async (req, resp/* , next */) => {
    const { productId } = req.params;

    const client = new MongoClient(config.dbUrl);
    await client.connect();
    const db = client.db();
    const collection = db.collection('products');
    let product;

    if (typeof productId === 'string' && /^[0-9a-fA-F]{24}$/.test(productId)) {
      const _id = new ObjectId(productId);
      product = await collection.findOne({ _id });
    }

    if (product) {
      await client.close();
      resp.status(200).json({
        id: product._id,
        name: product.name,
        price: product.price,
        image: product.image,
        type: product.type,
        dateEntry: product.dateEntry,
      });
    } else {
      await client.close();
      resp.status(404).json({
        error: 'Producto no encontrado',
      });
    }
  });

  /**
   * @name POST /products
   * @description Crea un nuevo producto
   * @path {POST} /products
   * @auth Requiere `token` de autenticación y que la usuaria sea **admin**
   * @body {String} name Nombre
   * @body {Number} price Precio
   * @body {String} [imagen]  URL a la imagen
   * @body {String} [type] Tipo/Categoría
   * @response {Object} product
   * @response {String} products._id Id
   * @response {String} product.name Nombre
   * @response {Number} product.price Precio
   * @response {URL} product.image URL a la imagen
   * @response {String} product.type Tipo/Categoría
   * @response {Date} product.dateEntry Fecha de creación
   * @code {200} si la autenticación es correcta
   * @code {400} si no se indican `name` o `price`
   * @code {401} si no hay cabecera de autenticación
   * @code {403} si no es admin
   * @code {404} si el producto con `productId` indicado no existe
   */
  app.post('/products', requireAdmin, async (req, resp, next) => {
    const {
      name,
      price,
      image,
      type,
    } = req.body;

    if (!name || !price) {
      return resp.status(400).json({
        error: 'Debes proporcionar un nombre y un precio para el producto.',
      });
    }

    const client = new MongoClient(config.dbUrl);
    await client.connect();
    const db = client.db();
    const collection = db.collection('products');

    // Verificar si el token pertenece a una usuaria administradora
    const isAdmin = req.isAdmin === true;

    if (!isAdmin) {
      await client.close();
      return resp.status(403).json({
        error: 'No tienes autorización para hacer esta petición',
      });
    }
    try {
      const product = {
        name,
        price,
        image,
        type,
        dateEntry: new Date(),
      };

      const result = await collection.insertOne(product);

      resp.status(200).json({
        id: result.insertedId,
        name: product.name,
        price: product.price,
        image: product.image,
        type: product.type,
        dateEntry: product.dateEntry,
      });
    } catch (error) {
      next(error);
    } finally {
      client.close();
    }
  });

  /**
   * @name PATCH /products
   * @description Modifica un producto
   * @path {PUT} /products
   * @params {String} :productId `id` del producto
   * @auth Requiere `token` de autenticación y que el usuario sea **admin**
   * @body {String} [name] Nombre
   * @body {Number} [price] Precio
   * @body {String} [imagen]  URL a la imagen
   * @body {String} [type] Tipo/Categoría
   * @response {Object} product
   * @response {String} product._id Id
   * @response {String} product.name Nombre
   * @response {Number} product.price Precio
   * @response {URL} product.image URL a la imagen
   * @response {String} product.type Tipo/Categoría
   * @response {Date} product.dateEntry Fecha de creación
   * @code {200} si la autenticación es correcta
   * @code {400} si no se indican ninguna propiedad a modificar
   * @code {401} si no hay cabecera de autenticación
   * @code {403} si no es admin
   * @code {404} si el producto con `productId` indicado no existe
   */
  app.patch('/products/:productId', requireAdmin, async (req, resp/* , next */) => {
    const { productId } = req.params;
    const {
      name,
      price,
      image,
      type,
    } = req.body;

    const client = new MongoClient(config.dbUrl);
    await client.connect();
    const db = client.db();
    const usersCollection = db.collection('products');
    let product;

    if (Object.keys(req.body).length === 0 || name === '' || price === '' || typeof price !== 'number' || image === '' || type === '') {
      await client.close();
      resp.status(400).json({
        error: 'Los valores a actualizar no pueden estar vacios',
      });
    } else {
      // Verificar si el token pertenece a una usuaria administradora
      const isAdmin = req.isAdmin === true;

      if (!isAdmin) {
        await client.close();
        return resp.status(403).json({
          error: 'No tienes autorización para modificar este usuario',
        });
      }

      // Verificar si ya existe una usuaria con el id o email insertado
      if (typeof productId === 'string' && /^[0-9a-fA-F]{24}$/.test(productId)) {
        const id = new ObjectId(productId);
        product = await usersCollection.findOneAndUpdate(
          { _id: id },
          { $set: req.body },
          { returnOriginal: false },
        );
      } else {
        await client.close();
        return resp.status(404).json({
          error: 'Producto no encontrado',
        });
      }

      if (product.value) {
        await client.close();
        return resp.status(200).json({
          id: product.value._id,
          name: product.value.name,
          price: product.value.price,
          image: product.value.image,
          type: product.value.type,
        });
      }
      await client.close();
      return resp.status(404).json({
        error: 'Producto no encontrado',
      });
    }
  });

  /**
   * @name DELETE /products
   * @description Elimina un producto
   * @path {DELETE} /products
   * @params {String} :productId `id` del producto
   * @auth Requiere `token` de autenticación y que el usuario sea **admin**
   * @response {Object} product
   * @response {String} product._id Id
   * @response {String} product.name Nombre
   * @response {Number} product.price Precio
   * @response {URL} product.image URL a la imagen
   * @response {String} product.type Tipo/Categoría
   * @response {Date} product.dateEntry Fecha de creación
   * @code {200} si la autenticación es correcta
   * @code {401} si no hay cabecera de autenticación
   * @code {403} si no es ni admin
   * @code {404} si el producto con `productId` indicado no existe
   */
  app.delete('/products/:productId', requireAdmin, async (req, resp/* , next */) => {
    const { productId } = req.params;

    const client = new MongoClient(config.dbUrl);
    await client.connect();
    const db = client.db();
    const productsCollection = db.collection('products');
    let product;
    // Verificar si el token pertenece a una usuaria administradora
    const isAdmin = req.isAdmin === true;

    if (!isAdmin) {
      await client.close();
      return resp.status(403).json({
        error: 'No tienes autorización para eliminar este producto',
      });
    }

    if (typeof productId === 'string' && /^[0-9a-fA-F]{24}$/.test(productId)) {
      const _id = new ObjectId(productId);
      // Verificar si el producto existe
      product = await productsCollection.findOneAndDelete({ _id });
    } else {
      await client.close();
      return resp.status(404).json({
        error: 'Producto no encontrado',
      });
    }

    if (product.value) {
      await client.close();
      return resp.status(200).json(product.value);
    }

    await client.close();
    return resp.status(404).json({
      error: 'Producto no encontrado',
    });
  });

  nextMain();
};
