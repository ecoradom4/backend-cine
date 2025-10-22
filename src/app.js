// src/app.js
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { swaggerUi, specs } = require('../docs/swagger');
const routes = require('./routes');
const { initializeServices } = require('./services');
const { sequelize } = require('./models');

class App {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 4000;

    this.initializeDatabase();
    this.initializeMiddlewares();
    this.initializeServices();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  // 🔹 Inicializar base de datos
  async initializeDatabase() {
    try {
      await sequelize.authenticate();
      console.log('✅ Conexión a la base de datos establecida correctamente');
    } catch (error) {
      console.error('❌ Error conectando a la base de datos:', error);
      process.exit(1);
    }
  }

  // 🔹 Inicializar middlewares
  initializeMiddlewares() {
    // 🟩 Orígenes permitidos
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://frontend-cine-jade.vercel.app',
      'https://frontend-cine.onrender.com',
      'https://www.devumg.online',
      'https://devumg.online',
      ...(process.env.FRONTEND_URL
        ? process.env.FRONTEND_URL.split(',').map((url) => url.trim())
        : []),
    ];

    // ✅ CORS flexible
    this.app.use((req, res, next) => {
      const origin = req.headers.origin;
      if (origin && allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
      }

      res.header(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, PATCH, OPTIONS'
      );
      res.header(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Requested-With'
      );
      res.header('Access-Control-Allow-Credentials', 'true');

      // ⚙️ Preflight requests
      if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
      }
      next();
    });

    // ✅ Parser
    this.app.use(bodyParser.json({ limit: '10mb' }));
    this.app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

    // ✅ Archivos estáticos (ej. recibos, imágenes, QR)
    this.app.use(
      '/storage',
      express.static(path.resolve(__dirname, '../storage'), {
        maxAge: '7d',
        setHeaders: (res) => {
          // Permitir acceso a archivos estáticos desde cualquier origen (solo lectura)
          res.setHeader('Access-Control-Allow-Origin', '*');
        },
      })
    );

    // ✅ Logging
    this.app.use((req, res, next) => {
      console.log(
        `${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${req.ip}`
      );
      next();
    });

    // ✅ Cabeceras de seguridad
    this.app.use((req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains'
      );
      next();
    });

    // ✅ Forzar HTTPS en producción (Render usa proxy)
    if (process.env.NODE_ENV === 'production') {
      this.app.use((req, res, next) => {
        if (req.headers['x-forwarded-proto'] !== 'https') {
          return res.redirect(`https://${req.headers.host}${req.url}`);
        }
        next();
      });
    }
  }

  // 🔹 Inicializar servicios
  async initializeServices() {
    try {
      await initializeServices();
    } catch (error) {
      console.error('❌ Error inicializando servicios:', error);
    }
  }

  // 🔹 Inicializar rutas
  initializeRoutes() {
    this.app.use('/api', routes);

    // Swagger UI
    this.app.use(
      '/api-docs',
      swaggerUi.serve,
      swaggerUi.setup(specs, {
        explorer: true,
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'CineConnect API Documentation',
        swaggerOptions: {
          persistAuthorization: true,
          displayRequestDuration: true,
        },
      })
    );

    // Swagger JSON
    this.app.get('/api-docs.json', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(specs);
    });

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        success: true,
        message: '🎬 Bienvenido a CineConnect API',
        version: '1.0.0',
        documentation: '/api-docs',
        endpoints: {
          auth: '/api/auth',
          movies: '/api/movies',
          rooms: '/api/rooms',
          showtimes: '/api/showtimes',
          bookings: '/api/bookings',
          dashboard: '/api/dashboard',
        },
        timestamp: new Date().toISOString(),
      });
    });
  }

  // 🔹 Manejo de errores
  initializeErrorHandling() {
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        message: `Ruta no encontrada: ${req.originalUrl}`,
        suggestion: 'Consulta la documentación en /api-docs',
      });
    });

    this.app.use((error, req, res, next) => {
      console.error('🚨 Error no manejado:', error);

      if (error.name === 'SequelizeValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Error de validación',
          errors: error.errors.map((err) => ({
            field: err.path,
            message: err.message,
          })),
        });
      }

      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
          success: false,
          message: 'El recurso ya existe',
          field: error.errors[0]?.path,
        });
      }

      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ success: false, message: 'Token inválido' });
      }

      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Token expirado' });
      }

      const statusCode = error.statusCode || 500;
      const message = error.message || 'Error interno del servidor';

      res.status(statusCode).json({
        success: false,
        message:
          process.env.NODE_ENV === 'production'
            ? 'Error interno del servidor'
            : message,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
      });
    });
  }

  // 🔹 Iniciar servidor
  start() {
    this.server = this.app.listen(this.port, () => {
      console.log(`
🎬 CINECONNECT BACKEND INICIADO CORRECTAMENTE

📍 Servidor: http://localhost:${this.port}
📚 Documentación: http://localhost:${this.port}/api-docs
🗄️  Base de datos: ${
        process.env.DATABASE_URL ? 'Conectada' : 'No configurada'
      }
🌍 Entorno: ${process.env.NODE_ENV || 'development'}

¡Listo para recibir peticiones! 🚀
      `);
    });

    this.setupGracefulShutdown();
  }

  // 🔹 Apagado graceful
  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      console.log(`\n📴 Recibido ${signal}. Cerrando servidor...`);

      this.server.close(async () => {
        console.log('✅ Servidor HTTP cerrado');

        try {
          await sequelize.close();
          console.log('✅ Conexión a la base de datos cerrada');
        } catch (error) {
          console.error('❌ Error cerrando conexión a BD:', error);
        }

        console.log('👋 Servidor apagado correctamente');
        process.exit(0);
      });

      setTimeout(() => {
        console.log('⏰ Forzando cierre del servidor...');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2'));
  }

  getApp() {
    return this.app;
  }
}

module.exports = App;
