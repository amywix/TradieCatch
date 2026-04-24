import express from "express";
import type { Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { runMigrations } from 'stripe-replit-sync';
import { getStripeSync } from './stripeClient';
import { WebhookHandlers } from './webhookHandlers';
import { db } from './db';
import { users, settings, smsTemplates, missedCalls, jobs, leads, salesSettings, DEFAULT_SERVICES } from '@shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { markLeadPaid } from './sales-flow';
import * as fs from "fs";
import * as path from "path";

const app = express();
const log = console.log;

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

function setupCors(app: express.Application) {
  app.use((req, res, next) => {
    const origins = new Set<string>();

    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }

    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }

    const origin = req.header("origin");

    // Allow localhost origins for Expo web development (any port)
    const isLocalhost =
      origin?.startsWith("http://localhost:") ||
      origin?.startsWith("http://127.0.0.1:");

    if (origin && (origins.has(origin) || isLocalhost)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      );
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.header("Access-Control-Allow-Credentials", "true");
    }

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    next();
  });
}

function setupBodyParsing(app: express.Application) {
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(express.urlencoded({ extended: false }));
}

function setupRequestLogging(app: express.Application) {
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, unknown> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      if (!path.startsWith("/api")) return;

      const duration = Date.now() - start;

      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    });

    next();
  });
}

function getAppName(): string {
  try {
    const appJsonPath = path.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}

function serveExpoManifest(platform: string, res: Response) {
  const manifestPath = path.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json",
  );

  if (!fs.existsSync(manifestPath)) {
    return res
      .status(404)
      .json({ error: `Manifest not found for platform: ${platform}` });
  }

  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");

  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}

function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName,
}: {
  req: Request;
  res: Response;
  landingPageTemplate: string;
  appName: string;
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;

  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);

  const html = landingPageTemplate
    .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
    .replace(/EXPS_URL_PLACEHOLDER/g, expsUrl)
    .replace(/APP_NAME_PLACEHOLDER/g, appName);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}

function configureExpoAndLanding(app: express.Application) {
  const templatePath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html",
  );
  const landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
  const appName = getAppName();

  log("Serving static Expo files with dynamic manifest routing");

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api")) {
      return next();
    }

    if (req.path !== "/" && req.path !== "/manifest") {
      return next();
    }

    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, res);
    }

    const webBuildPath = path.resolve(process.cwd(), "web-build", "index.html");
    const hasWebBuild = fs.existsSync(webBuildPath);

    if (req.path === "/" && hasWebBuild) {
      return res.sendFile(webBuildPath);
    }

    if (req.path === "/") {
      try {
        return serveLandingPage({
          req,
          res,
          landingPageTemplate,
          appName,
        });
      } catch (err) {
        console.error("Landing page error:", err);
        return res.status(200).send("OK");
      }
    }

    next();
  });

  app.use("/assets", express.static(path.resolve(process.cwd(), "assets")));
  app.use(express.static(path.resolve(process.cwd(), "web-build")));
  app.use(express.static(path.resolve(process.cwd(), "static-build")));

  app.get("/{*path}", (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api")) return next();
    const webIndex = path.resolve(process.cwd(), "web-build", "index.html");
    if (fs.existsSync(webIndex)) {
      return res.sendFile(webIndex);
    }
    next();
  });

  log("Expo routing: Checking expo-platform header on / and /manifest");
}

function setupErrorHandler(app: express.Application) {
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    const error = err as {
      status?: number;
      statusCode?: number;
      message?: string;
    };

    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });
}

async function bootstrapDefaultUser() {
  const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
  if (!twilioPhone) {
    log('No TWILIO_PHONE_NUMBER env var set, skipping bootstrap');
    return;
  }

  try {
    // One-shot: remove the demo@ account if it still exists (sales/demo flow has been retired)
    const demoToDelete = await db.select().from(users).where(eq(users.email, 'demo@tradiecatch.com'));
    if (demoToDelete.length > 0) {
      const demoId = demoToDelete[0].id;
      await db.delete(missedCalls).where(eq(missedCalls.userId, demoId));
      await db.delete(jobs).where(eq(jobs.userId, demoId));
      await db.delete(smsTemplates).where(eq(smsTemplates.userId, demoId));
      await db.delete(settings).where(eq(settings.userId, demoId));
      await db.delete(users).where(eq(users.id, demoId));
      log('Bootstrap: deleted demo@tradiecatch.com account and all associated data');
    }

    const allUsers = await db.select().from(users);
    if (allUsers.length > 0) {
      const allSettings = await db.select().from(settings);
      const firstUser = allUsers[0];
      const userSettings = allSettings.find(s => s.userId === firstUser.id);

      if (userSettings && !userSettings.bookingCalendarEnabled) {
        await db.update(settings)
          .set({
            bookingCalendarEnabled: true,
            bookingSlots: userSettings.bookingSlots || ["8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM"],
          })
          .where(eq(settings.userId, firstUser.id));
        log(`Bootstrap: Enabled booking calendar for user ${firstUser.email}`);
      }

      const hasMatchingNumber = allSettings.some(s => s.twilioPhoneNumber === twilioPhone);
      if (hasMatchingNumber) {
        log(`Bootstrap: Twilio number ${twilioPhone} already configured`);
        return;
      }

      if (userSettings && !userSettings.twilioPhoneNumber) {
        await db.update(settings)
          .set({
            twilioPhoneNumber: twilioPhone,
            twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
            twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
            businessName: userSettings.businessName || 'TradieCatch',
          })
          .where(eq(settings.userId, firstUser.id));
        log(`Bootstrap: Updated user ${firstUser.email} with Twilio number ${twilioPhone}`);
      }
      log('Bootstrap: Users exist but Twilio number not matched to any');

      // One-shot admin password reset (remove ADMIN_PASSWORD_RESET env var after use)
      const resetPwd = process.env.ADMIN_PASSWORD_RESET;
      if (resetPwd) {
        const adminUser = allUsers.find(u => u.email === 'admin@tradiecatch.com');
        if (adminUser) {
          const newHash = await bcrypt.hash(resetPwd, 12);
          await db.update(users).set({ password: newHash }).where(eq(users.id, adminUser.id));
          log(`Bootstrap: admin password was reset via ADMIN_PASSWORD_RESET env var`);
        }
      }
      return;
    }

    log('Bootstrap: No users found, creating default account...');
    const hashedPassword = await bcrypt.hash('test123456', 12);
    const [user] = await db.insert(users).values({
      email: 'admin@tradiecatch.com',
      username: 'TradieCatch Admin',
      password: hashedPassword,
    }).returning();

    await db.insert(settings).values({
      userId: user.id,
      businessName: 'TradieCatch',
      autoReplyEnabled: true,
      bookingCalendarEnabled: true,
      bookingSlots: ["8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM"],
      services: DEFAULT_SERVICES,
      twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
      twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
      twilioPhoneNumber: twilioPhone,
    });

    await db.insert(smsTemplates).values({
      userId: user.id,
      name: 'Missed Call Auto-Reply',
      message: "Hi! Sorry we missed your call. We'll get back to you shortly.",
      isDefault: true,
    });

    log(`Bootstrap: Created default user (admin@tradiecatch.com) with Twilio number ${twilioPhone}`);
  } catch (err) {
    console.error('Bootstrap error:', err);
  }
}

async function bootstrapSalesOperator() {
  try {
    const isProd = process.env.NODE_ENV === 'production';
    const envEmail = process.env.SALES_OPERATOR_EMAIL;
    const envPwd = process.env.SALES_OPERATOR_PASSWORD;

    // In production, REQUIRE both env vars — never seed a default password.
    // In development, fall back to a known-default for convenience.
    if (isProd && (!envEmail || !envPwd)) {
      const existingOperators = await db.select().from(users).where(eq(users.isOperator, true));
      if (existingOperators.length === 0) {
        console.error('━'.repeat(70));
        console.error('⚠ SALES PIPELINE DISABLED');
        console.error('No operator accounts exist and SALES_OPERATOR_EMAIL/SALES_OPERATOR_PASSWORD');
        console.error('are not set. The sales pipeline will be inaccessible until you either:');
        console.error('  • Set SALES_OPERATOR_EMAIL + SALES_OPERATOR_PASSWORD env vars and restart, or');
        console.error('  • Manually mark an existing user as operator (UPDATE users SET is_operator=true ...)');
        console.error('━'.repeat(70));
      } else {
        log(`Bootstrap: SALES_OPERATOR_* env vars not set in production; using ${existingOperators.length} existing operator account(s).`);
      }
      // Still ensure singleton sales_settings row exists.
      const existing = await db.select().from(salesSettings).where(eq(salesSettings.id, 'sales-singleton'));
      if (existing.length === 0) {
        await db.insert(salesSettings).values({
          id: 'sales-singleton',
          demoVideoUrl: process.env.DEMO_VIDEO_URL || '',
          calendlyUrl: process.env.CALENDLY_URL || '',
        });
      }
      return;
    }

    const operatorEmail = (envEmail || 'operator@tradiecatch.com').toLowerCase();
    const operatorPwd = envPwd || 'operator123';

    const existingByEmail = await db.select().from(users).where(eq(users.email, operatorEmail));
    if (existingByEmail.length > 0) {
      const u = existingByEmail[0];
      if (!u.isOperator) {
        await db.update(users).set({ isOperator: true }).where(eq(users.id, u.id));
        log(`Bootstrap: marked existing user ${operatorEmail} as operator`);
      }
    } else {
      const hash = await bcrypt.hash(operatorPwd, 12);
      await db.insert(users).values({
        email: operatorEmail,
        username: 'Sales Operator',
        password: hash,
        isOperator: true,
      });
      log(`Bootstrap: created sales operator ${operatorEmail}`);
    }

    // Also flag the admin as operator (so they can use both apps with one login if they want)
    const admin = await db.select().from(users).where(eq(users.email, 'admin@tradiecatch.com'));
    if (admin[0] && !admin[0].isOperator) {
      await db.update(users).set({ isOperator: true }).where(eq(users.id, admin[0].id));
      log('Bootstrap: marked admin@tradiecatch.com as operator');
    }

    // Ensure sales_settings row exists
    const existing = await db.select().from(salesSettings).where(eq(salesSettings.id, 'sales-singleton'));
    if (existing.length === 0) {
      await db.insert(salesSettings).values({
        id: 'sales-singleton',
        demoVideoUrl: process.env.DEMO_VIDEO_URL || '',
        calendlyUrl: process.env.CALENDLY_URL || '',
      });
      log('Bootstrap: created default sales_settings row');
    }
  } catch (err) {
    console.error('Sales operator bootstrap error:', err);
  }
}

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL required for Stripe integration');
    return;
  }

  try {
    log('Initializing Stripe schema...');
    await runMigrations({ databaseUrl, schema: 'stripe' });
    log('Stripe schema ready');

    const stripeSync = await getStripeSync();

    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
    const webhookResult = await stripeSync.findOrCreateManagedWebhook(
      `${webhookBaseUrl}/api/stripe/webhook`
    );
    log(`Stripe webhook configured: ${JSON.stringify(webhookResult?.webhook?.url || 'ok')}`);

    stripeSync.syncBackfill()
      .then(() => log('Stripe data synced'))
      .catch((err: any) => console.error('Error syncing Stripe data:', err));
  } catch (error) {
    console.error('Failed to initialize Stripe:', error);
  }
}

(async () => {
  setupCors(app);

  app.get('/healthz', (_req, res) => {
    res.status(200).send('ok');
  });

  app.post(
    '/api/stripe/webhook',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
      const signature = req.headers['stripe-signature'];
      if (!signature) {
        return res.status(400).json({ error: 'Missing stripe-signature' });
      }
      try {
        const sig = Array.isArray(signature) ? signature[0] : signature;
        if (!Buffer.isBuffer(req.body)) {
          console.error('STRIPE WEBHOOK ERROR: req.body is not a Buffer');
          return res.status(500).json({ error: 'Webhook processing error' });
        }
        await WebhookHandlers.processWebhook(req.body as Buffer, sig);

        // Sales setup-fee side-effect: mark the lead paid when their checkout completes.
        try {
          const evt = JSON.parse(req.body.toString('utf8'));
          if (evt?.type === 'checkout.session.completed') {
            const session = evt?.data?.object || {};
            const meta = session?.metadata || {};
            if (meta.type === 'sales_setup_fee' && meta.leadId) {
              await markLeadPaid(String(meta.leadId));
              log(`Sales: marked lead ${meta.leadId} as paid (setup fee)`);
            }
          }
        } catch (e) {
          console.error('Lead paid hook error (non-fatal):', e);
        }

        res.status(200).json({ received: true });
      } catch (error: any) {
        console.error('Webhook error:', error.message);
        res.status(400).json({ error: 'Webhook processing error' });
      }
    }
  );

  setupBodyParsing(app);
  setupRequestLogging(app);

  configureExpoAndLanding(app);

  const server = await registerRoutes(app);

  setupErrorHandler(app);

  const port = parseInt(process.env.PORT || process.env.CLOUD_RUN_PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`express server serving on port ${port}`);
      bootstrapDefaultUser()
        .then(() => bootstrapSalesOperator())
        .then(() => initStripe())
        .catch(err => console.error('Startup init error (non-fatal):', err));
    },
  );
})();
