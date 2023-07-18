exports.port = process.argv[2] || process.env.PORT || 8080;
exports.dbUrl = process.env.MONGO_URL || process.env.DB_URL || 'mongodb+srv://vercel-admin-user:B2fG28wOqrNGyeGH@cluster0.yk3gjec.mongodb.net/test';
// mongodb+srv://vercel-admin-user:cKVajIYSxWCTT6l9@cluster0.m0qufsq.mongodb.net/rebeca
exports.secret = process.env.JWT_SECRET || 'esta-es-la-api-burger-queen';
exports.adminEmail = process.env.ADMIN_EMAIL || 'admin@localhost';
exports.adminPassword = process.env.ADMIN_PASSWORD || 'changeme';
