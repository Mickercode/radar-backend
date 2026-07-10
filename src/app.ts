import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env, isProd } from './config/env';
import { accountRouter } from './routes/account';
import { authRouter } from './routes/auth';
import { googleAuthRouter } from './routes/google-auth';
import { catalogRouter } from './routes/catalog';
import { contentRouter } from './routes/content';
import { libraryRouter } from './routes/library';
import { insightsRouter } from './routes/insights';
import { pushRouter } from './routes/push';
import { reviewsRouter } from './routes/reviews';
import { subscriptionRouter } from './routes/subscription';
import { weeklyRouter } from './routes/weekly';
import { knowledgeWebRouter } from './routes/knowledge-web';
import { podcastsRouter } from './routes/podcasts';
import { captureRouter } from './routes/capture';
import { notesRouter } from './routes/notes';
import { adminRouter } from './routes/admin';
import { clipsRouter } from './routes/clips';
import { aiRouter } from './routes/ai';
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
  app.use('/auth', googleAuthRouter);
  app.use('/account', accountRouter);
  // Public catalog (feed/content/topics) + per-user state (saved/playback/prefs).
  // Both mount at root because their paths are top-level (/feed, /saved, …).
  app.use(catalogRouter);
  app.use('/content', contentRouter);
  app.use(libraryRouter);
  // Knowledge graph + quiz, spaced repetition, weekly review.
  app.use('/insights', insightsRouter);
  app.use('/reviews', reviewsRouter);
  app.use('/push', pushRouter);
  app.use('/subscription', subscriptionRouter);
  app.use('/knowledge-web', knowledgeWebRouter);
  app.use('/podcasts', podcastsRouter);
  app.use('/notes', notesRouter);
  app.use(weeklyRouter);
  // AI pipeline: /capture (quiz generation + embedding auto-link live under
  // /insights). Needs GEMINI_API_KEY; routes 503 cleanly without it.
  app.use(captureRouter);
  app.use(adminRouter);
  app.use(clipsRouter);
  app.use('/ai', aiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
