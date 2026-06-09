import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env, isProd } from './config/env';
import { authRouter } from './routes/auth';
import { catalogRouter } from './routes/catalog';
import { libraryRouter } from './routes/library';
import { errorHandler, notFoundHandler } from './middleware/error';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',').map((s) => s.trim()),
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan(isProd ? 'combined' : 'dev'));

  // Health check — Render pings this; also handy for the app to detect reachability.
  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'radar-backend' });
  });

  // ── Routes ──────────────────────────────────────────────────────────────────
  app.use('/auth', authRouter);
  // Public catalog (feed/content/topics) + per-user state (saved/playback/prefs).
  // Both mount at root because their paths are top-level (/feed, /saved, …).
  app.use(catalogRouter);
  app.use(libraryRouter);
  // Knowledge graph, SRS, quiz, weekly review, and the AI pipeline mount here
  // in the next build chunks.

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
