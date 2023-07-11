const { MongoClient, ObjectId } = require('mongodb');
const {
  requireAuth,
} = require('../middleware/auth');
const config = require('../config');

/** @module orders */
module.exports = (app, nextMain) => {
  /**
   * @name GET /orders
   * @description Lista órdenes
   * @path {GET} /orders
   * @query {String} [page=1] Página del listado a consultar
   * @query {String} [limit=10] Cantitad de elementos por página
   * @header {Object} link Parámetros de paginación
   * @header {String} link.first Link a la primera página
   * @header {String} link.prev Link a la página anterior
   * @header {String} link.next Link a la página siguiente
   * @header {String} link.last Link a la última página
   * @auth Requiere `token` de autenticación
   * @response {Array} orders
   * @response {String} orders[]._id Id
   * @response {String} orders[].userId Id usuaria que creó la orden
   * @response {String} orders[].client Clienta para quien se creó la orden
   * @response {Array} orders[].products Productos
   * @response {Object} orders[].products[] Producto
   * @response {Number} orders[].products[].qty Cantidad
   * @response {Object} orders[].products[].product Producto
   * @response {String} orders[].status Estado: `pending`, `canceled`, `delivering` o `delivered`
   * @response {Date} orders[].dateEntry Fecha de creación
   * @response {Date} [orders[].dateProcessed] Fecha de cambio de `status` a `delivered`
   * @code {200} si la autenticación es correcta
   * @code {401} si no hay cabecera de autenticación
   */
  app.get('/orders', requireAuth, async (req, resp/* , next */) => {
    const client = new MongoClient(config.dbUrl);
    await client.connect();
    const db = client.db();
    const collection = db.collection('orders');

    const { page = 1, limit = 10 } = req.query;
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);

    // Calcular el número total de usuarios
    const totalOrders = await collection.countDocuments();
    // Aquí puedes implementar la lógica para obtener las órdenes desde la base de datos
    const totalPages = Math.ceil(totalOrders / limitNumber);
    const startIndex = (pageNumber - 1) * limitNumber;
    const findOrders = await collection.find({}).skip(startIndex).limit(limitNumber).toArray();

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
    resp.send(findOrders);
  });

  /**
   * @name GET /orders/:orderId
   * @description Obtiene los datos de una orden especifico
   * @path {GET} /orders/:orderId
   * @params {String} :orderId `id` de la orden a consultar
   * @auth Requiere `token` de autenticación
   * @response {Object} order
   * @response {String} order._id Id
   * @response {String} order.userId Id usuaria que creó la orden
   * @response {String} order.client Clienta para quien se creó la orden
   * @response {Array} order.products Productos
   * @response {Object} order.products[] Producto
   * @response {Number} order.products[].qty Cantidad
   * @response {Object} order.products[].product Producto
   * @response {String} order.status Estado: `pending`, `canceled`, `delivering` o `delivered`
   * @response {Date} order.dateEntry Fecha de creación
   * @response {Date} [order.dateProcessed] Fecha de cambio de `status` a `delivered`
   * @code {200} si la autenticación es correcta
   * @code {401} si no hay cabecera de autenticación
   * @code {404} si la orden con `orderId` indicado no existe
   */
  app.get('/orders/:orderId', requireAuth, async (req, resp/* , next */) => {
    const { orderId } = req.params;

    const client = new MongoClient(config.dbUrl);
    await client.connect();
    const db = client.db();
    const collection = db.collection('orders');
    let order;

    if (typeof orderId === 'string' && /^[0-9a-fA-F]{24}$/.test(orderId)) {
      const _id = new ObjectId(orderId);
      order = await collection.findOne({ _id });
    }

    if (order) {
      await client.close();
      resp.status(200).json({
        id: order.insertedId,
        userId: order.userId,
        client: order.client,
        products: order.products.map((product) => ({
          qty: product.qty,
          product: product.product,
        })),
        status: order.status,
        dateEntry: order.dateEntry,
        dateProcessed: order.dateProcessed,
      });
    } else {
      await client.close();
      resp.status(404).json({
        error: 'Producto no encontrado',
      });
    }
  });

  /**
   * @name POST /orders
   * @description Crea una nueva orden
   * @path {POST} /orders
   * @auth Requiere `token` de autenticación
   * @body {String} userId Id usuaria que creó la orden
   * @body {String} client Clienta para quien se creó la orden
   * @body {Array} products Productos
   * @body {Object} products[] Producto
   * @body {String} products[].productId Id de un producto
   * @body {Number} products[].qty Cantidad de ese producto en la orden
   * @response {Object} order
   * @response {String} order._id Id
   * @response {String} order.userId Id usuaria que creó la orden
   * @response {String} order.client Clienta para quien se creó la orden
   * @response {Array} order.products Productos
   * @response {Object} order.products[] Producto
   * @response {Number} order.products[].qty Cantidad
   * @response {Object} order.products[].product Producto
   * @response {String} order.status Estado: `pending`, `canceled`, `delivering` o `delivered`
   * @response {Date} order.dateEntry Fecha de creación
   * @response {Date} [order.dateProcessed] Fecha de cambio de `status` a `delivered`
   * @code {200} si la autenticación es correcta
   * @code {400} no se indica `userId` o se intenta crear una orden sin productos
   * @code {401} si no hay cabecera de autenticación
   */
  app.post('/orders', requireAuth, async (req, resp, next) => {
    const { userId, client, products } = req.body;

    // Validar los parámetros de solicitud
    if (!userId || !products || products.length === 0) {
      return resp.status(400).json({ error: 'Se requiere userId y productos para crear una orden' });
    }

    const cliente = new MongoClient(config.dbUrl);
    try {
      await cliente.connect();
      const db = cliente.db();
      const collection = db.collection('orders');

      // Crear una nueva orden
      const newOrder = {
        userId,
        client,
        products,
        status: 'pending',
        dateEntry: new Date(),
        dateProcessed: new Date(),
      };

      const result = await collection.insertOne(newOrder);

      // Devolver la respuesta con el orden creado
      resp.status(200).json({
        _id: result.insertedId,
        userId: newOrder.userId,
        client: newOrder.client,
        products: newOrder.products.map((product) => ({
          qty: product.qty,
          product: product.product,
        })),
        status: newOrder.status,
        dateEntry: newOrder.dateEntry,
        dateProcessed: newOrder.dateProcessed,
      });
    } catch (error) {
      next(error);
    } finally {
      cliente.close();
    }
  });

  /**
   * @name PATCH /orders
   * @description Modifica una orden
   * @path {PUT} /products
   * @params {String} :orderId `id` de la orden
   * @auth Requiere `token` de autenticación
   * @body {String} [userId] Id usuaria que creó la orden
   * @body {String} [client] Clienta para quien se creó la orden
   * @body {Array} [products] Productos
   * @body {Object} products[] Producto
   * @body {String} products[].productId Id de un producto
   * @body {Number} products[].qty Cantidad de ese producto en la orden
   * @body {String} [status] Estado: `pending`, `canceled`, `delivering` o `delivered`
   * @response {Object} order
   * @response {String} order._id Id
   * @response {String} order.userId Id usuaria que creó la orden
   * @response {Array} order.products Productos
   * @response {Object} order.products[] Producto
   * @response {Number} order.products[].qty Cantidad
   * @response {Object} order.products[].product Producto
   * @response {String} order.status Estado: `pending`, `canceled`, `delivering` o `delivered`
   * @response {Date} order.dateEntry Fecha de creación
   * @response {Date} [order.dateProcessed] Fecha de cambio de `status` a `delivered`
   * @code {200} si la autenticación es correcta
   * @code {400} si no se indican ninguna propiedad a modificar o la propiedad `status` no es valida
   * @code {401} si no hay cabecera de autenticación
   * @code {404} si la orderId con `orderId` indicado no existe
   */
  app.patch('/orders/:orderId', requireAuth, async (req, resp/* , next */) => {
    const { orderId } = req.params;
    const {
      userId,
      client,
      products,
      status,
      dateEntry,
      dateProcessed,
    } = req.body;

    const cliente = new MongoClient(config.dbUrl);
    await cliente.connect();
    const db = cliente.db();
    const usersCollection = db.collection('orders');
    let order;

    if (Object.keys(req.body).length === 0 || userId === '' || client === '' || dateEntry === '' || products === '' || status === '' || dateProcessed === '') {
      await cliente.close();
      resp.status(400).json({
        error: 'Los valores a actualizar no pueden estar vacios',
      });
    } else {
      // Verificar si el token pertenece a una usuaria administradora
      const isAdmin = req.isAdmin === true;

      if (!isAdmin) {
        await cliente.close();
        return resp.status(403).json({
          error: 'No tienes autorización para modificar este usuario',
        });
      }

      // Verificar si ya existe una usuaria con el id o email insertado
      if (typeof orderId === 'string' && /^[0-9a-fA-F]{24}$/.test(orderId)) {
        if (status !== 'delivered' && status !== 'pending' && status !== 'canceled' && status !== 'delivering' && status !== 'preparing') {
          await cliente.close();
          return resp.status(400).json({
            error: 'El status no es el correcto',
          });
        }
        const _id = new ObjectId(orderId);
        order = await usersCollection.findOneAndUpdate(
          { _id },
          { $set: req.body },
          { returnOriginal: false },
        );
      } else {
        await cliente.close();
        return resp.status(404).json({
          error: 'Producto no encontrado',
        });
      }

      if (order.value) {
        await cliente.close();
        return resp.status(200).json({
          _id: order.value._id,
          userId: order.value.userId,
          client: order.value.client,
          products: order.value.products.map((product) => ({
            qty: product.qty,
            product: product.product,
          })),
          status: order.value.status,
          dateEntry: order.value.dateEntry,
          dateProcessed: order.value.dateProcessed,
        });
      }
      await cliente.close();
      return resp.status(404).json({
        error: 'Producto no encontrado',
      });
    }
  });

  /**
   * @name DELETE /orders
   * @description Elimina una orden
   * @path {DELETE} /orders
   * @params {String} :orderId `id` del producto
   * @auth Requiere `token` de autenticación
   * @response {Object} order
   * @response {String} order._id Id
   * @response {String} order.userId Id usuaria que creó la orden
   * @response {String} order.client Clienta para quien se creó la orden
   * @response {Array} order.products Productos
   * @response {Object} order.products[] Producto
   * @response {Number} order.products[].qty Cantidad
   * @response {Object} order.products[].product Producto
   * @response {String} order.status Estado: `pending`, `canceled`, `delivering` o `delivered`
   * @response {Date} order.dateEntry Fecha de creación
   * @response {Date} [order.dateProcessed] Fecha de cambio de `status` a `delivered`
   * @code {200} si la autenticación es correcta
   * @code {401} si no hay cabecera de autenticación
   * @code {404} si el producto con `orderId` indicado no existe
   */
  app.delete('/orders/:orderId', requireAuth, async (req, resp/* , next */) => {
    const { orderId } = req.params;

    const client = new MongoClient(config.dbUrl);
    await client.connect();
    const db = client.db();
    const productsCollection = db.collection('orders');
    let order;
    // Verificar si el token pertenece a una usuaria administradora
    const isAdmin = req.isAdmin === true;

    if (!isAdmin) {
      await client.close();
      return resp.status(403).json({
        error: 'No tienes autorización para eliminar este producto',
      });
    }

    if (typeof orderId === 'string' && /^[0-9a-fA-F]{24}$/.test(orderId)) {
      const _id = new ObjectId(orderId);
      // Verificar si el producto existe
      order = await productsCollection.findOneAndDelete({ _id });
    } else {
      await client.close();
      return resp.status(404).json({
        error: 'Producto no encontrado',
      });
    }

    if (order.value) {
      await client.close();
      return resp.status(200).json(order.value);
    }

    await client.close();
    return resp.status(404).json({
      error: 'Producto no encontrado',
    });
  });

  nextMain();
};
