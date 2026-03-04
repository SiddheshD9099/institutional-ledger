console.log("APP FILE PATH:", __filename);
require('dotenv').config();
if (!process.env.DB_HOST ||
    !process.env.DB_USER ||
    !process.env.DB_PASSWORD ||
    !process.env.DB_NAME) {
  throw new Error('Missing required database environment variables');
}
const express = require('express');
const pool = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const accountRoutes = require('./routes/accountRoutes');
const transferRoutes = require('./routes/transferRoutes');

const app = express();

app.use(express.json());
app.use('/accounts', accountRoutes);
app.use('/transfer', transferRoutes);
console.log("Transfer route mounted");


app.get('/health', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.status(200).json({
      status: 'OK',
      dbTime: result.rows[0].now
    });
  } catch (err) {
    next(err);
  }
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');

  server.close(async () => {
    await pool.end();
    console.log('Closed HTTP server and DB pool');
    process.exit(0);
  });
});
