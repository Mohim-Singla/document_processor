/* eslint-disable import/first */
// eslint-disable-next-line import/newline-after-import
import { serviceConfig } from './config/index.js';
serviceConfig;
import express from 'express';
import cors from 'cors';
import { routeMap } from './route/index.js';
import { responseHandler } from './middleware/responseHandler.js';
import { debugLogger } from './middleware/debug.js';
import { mongoConnection } from './db/mongo/connection/index.js';
import { mysqlConnection } from './db/mysql/connection/index.js';
import http from 'http';

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

async function main() {
  try {
    app.use(cors({
      origin: 'http://localhost:3000',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }));
    app.use(express.json({ limit: '60mb', extended: true }));
    app.use(express.urlencoded({ extended: true }));
    app.use(debugLogger);
    app.use(responseHandler);

    await Promise.all([
      mongoConnection.init(),
      mysqlConnection.init(),
    ]);

    app.get('/ping', (req, res) => {
      return res.success('Server is working fine.', { timestamp: Date.now() });
    });

    app.use('', routeMap);

    server.listen(PORT, (error) => {
      if (error) {
        throw error;
      }
      console.info('App is listening on PORT:', PORT);
    });
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();
