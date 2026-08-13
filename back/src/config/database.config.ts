export default () => ({
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USER ?? 'prediction_app',
    password: process.env.DB_PASSWORD,
    name: process.env.DB_NAME ?? 'prediction',
    ssl: process.env.DB_SSL === 'true',
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
  },
});
