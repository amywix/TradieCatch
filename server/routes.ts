import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { db } from "./db";
import { sql as rawSql } from "drizzle-orm";
import { missedCalls, jobs, settings, smsTemplates, users, DEFAULT_SERVICES } from "@shared/schema";
import { eq, desc, and, SQL } from "drizzle-orm";
import { sendInitialMissedCallSms, handleIncomingReply } from "./sms-conversation";
import { register, login, getMe, requireAuth, type AuthRequest } from "./auth";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";

function paramId(req: Request | AuthRequest): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

export async function registerRoutes(app: Express): Promise<Server> {

  app.post("/api/auth/register", register);
  app.post("/api/auth/login", login);
  app.get("/api/auth/me", requireAuth, getMe as any);

  app.get("/api/debug/twilio-numbers", async (_req: Request, res: Response) => {
    try {
      const allSettings = await db.select({
        userId: settings.userId,
        twilioPhoneNumber: settings.twilioPhoneNumber,
        businessName: settings.businessName,
      }).from(settings);
      const dbUrl = process.env.DATABASE_URL || "";
      const maskedUrl = dbUrl.replace(/\/\/.*@/, "//***@");
      res.json({
        dbConnection: maskedUrl,
        settingsCount: allSettings.length,
        configuredNumbers: allSettings.map(s => ({
          userId: s.userId?.slice(0, 8) + "...",
          number: s.twilioPhoneNumber || "(empty)",
          name: s.businessName || "(unnamed)",
        })),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/config", async (req: Request, res: Response) => {
    const domains = process.env.REPLIT_DOMAINS || "";
    const domainList = domains.split(",").map(d => d.trim()).filter(Boolean);
    const deploymentDomain = process.env.DEPLOYMENT_DOMAIN
      || domainList.find(d => d.endsWith('.replit.app'))
      || "";
    const protocol = req.protocol || "https";
    const hostFromHeader = req.get("host") || "";
    const appUrl = deploymentDomain
      ? `https://${deploymentDomain}`
      : hostFromHeader
        ? `${protocol}://${hostFromHeader}`
        : "";

    let stripePublishableKey = "";
    try {
      stripePublishableKey = await getStripePublishableKey();
    } catch (e) {
      console.log("Stripe publishable key not available:", (e as Error).message);
    }

    res.json({
      revenueCatApiKey: process.env.REVENUECAT_API_KEY || "",
      stripePublishableKey,
      webhookUrl: appUrl ? `${appUrl}/api/twilio/webhook` : "",
      voiceWebhookUrl: appUrl ? `${appUrl}/api/twilio/voice` : "",
      appUrl,
    });
  });

  app.get("/api/missed-calls", requireAuth, async (req: AuthRequest, res: Response) => {
    const rows = await db.select().from(missedCalls)
      .where(eq(missedCalls.userId, req.userId!))
      .orderBy(desc(missedCalls.timestamp));
    res.json(rows);
  });

  app.post("/api/missed-calls", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { callerName, phoneNumber } = req.body;
      if (!phoneNumber) {
        return res.status(400).json({ error: "phoneNumber is required" });
      }
      const [call] = await db.insert(missedCalls).values({
        userId: req.userId!,
        callerName: callerName || "Unknown Caller",
        phoneNumber,
        timestamp: new Date(),
      }).returning();
      res.json(call);
    } catch (err: any) {
      console.error("Error adding missed call:", err);
      res.status(500).json({ error: err?.message || "Failed to add call" });
    }
  });

  app.delete("/api/missed-calls/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    const id = paramId(req);
    await db.delete(missedCalls).where(
      and(eq(missedCalls.id, id), eq(missedCalls.userId, req.userId!))
    );
    res.json({ ok: true });
  });

  app.post("/api/missed-calls/:id/send-sms", requireAuth, async (req: AuthRequest, res: Response) => {
    const id = paramId(req);
    try {
      const [call] = await db.select().from(missedCalls).where(
        and(eq(missedCalls.id, id), eq(missedCalls.userId, req.userId!))
      );
      if (!call) return res.status(404).json({ error: "Call not found" });

      await sendInitialMissedCallSms(id, req.userId!);
      const [updated] = await db.select().from(missedCalls).where(eq(missedCalls.id, id));
      res.json(updated);
    } catch (err: any) {
      console.error("Send SMS error:", err);
      res.status(500).json({ error: err.message || "Failed to send SMS" });
    }
  });

  app.get("/api/missed-calls/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    const id = paramId(req);
    const [call] = await db.select().from(missedCalls).where(
      and(eq(missedCalls.id, id), eq(missedCalls.userId, req.userId!))
    );
    if (!call) return res.status(404).json({ error: "Not found" });
    res.json(call);
  });

  app.post("/api/twilio/webhook", async (req: Request, res: Response) => {
    const from = req.body.From || "";
    const to = req.body.To || "";
    const body = req.body.Body || "";

    console.log(`Incoming SMS from ${from} to ${to}: ${body}`);

    try {
      await handleIncomingReply(from, body, to);
    } catch (err) {
      console.error("Webhook handler error:", err);
    }

    res.set("Content-Type", "text/xml");
    res.send("<Response></Response>");
  });

  app.post("/api/twilio/voice", async (req: Request, res: Response) => {
    const from = req.body.From || req.body.Caller || "";
    const to = req.body.To || req.body.Called || "";
    const callStatus = req.body.CallStatus || "";
    const callerName = req.body.CallerName || "Unknown Caller";

    console.log(`Incoming call from ${from} to ${to} (status: ${callStatus}, name: ${callerName})`);

    let userId: string | null = null;
    let settingsRow: any = null;

    try {
      const allSettings = await db.select().from(settings);
      const configuredNumbers = allSettings.map(s => s.twilioPhoneNumber || "(empty)");
      console.log(`Looking for Twilio number ${to} among configured numbers: ${JSON.stringify(configuredNumbers)}`);
      settingsRow = allSettings.find(s => {
        const twilioNum = s.twilioPhoneNumber || "";
        return phonesMatchSimple(twilioNum, to);
      });

      if (!settingsRow) {
        console.log(`No user found for Twilio number: ${to}`);
        res.set("Content-Type", "text/xml");
        res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">Sorry, this number is not configured.</Say><Hangup/></Response>`);
        return;
      }

      userId = settingsRow.userId as string;

      const existingCalls = await db.select().from(missedCalls)
        .where(and(eq(missedCalls.userId, userId!), eq(missedCalls.phoneNumber, from)))
        .orderBy(desc(missedCalls.timestamp))
        .limit(1);

      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      const isDuplicate = existingCalls.length > 0 && new Date(existingCalls[0].timestamp) > fiveMinAgo;

      if (!isDuplicate) {
        const [newCall] = await db.insert(missedCalls).values({
          userId: userId!,
          callerName: callerName || "Unknown Caller",
          phoneNumber: from,
          timestamp: new Date(),
        }).returning();

        console.log(`Missed call logged for user ${userId}: ${from} (id: ${newCall.id})`);

        if (settingsRow?.autoReplyEnabled) {
          try {
            await sendInitialMissedCallSms(newCall.id, userId!);
            console.log(`Auto-reply SMS sent for call ${newCall.id}`);
          } catch (smsErr) {
            console.error("Auto-reply SMS failed:", smsErr);
          }
        }
      } else {
        console.log(`Duplicate call from ${from} within 5 minutes, skipping.`);
      }
    } catch (err) {
      console.error("Voice webhook error:", err);
    }

    const businessName = settingsRow?.businessName || "us";
    const voiceMessage = (settingsRow?.missedCallVoiceMessage || "Sorry we missed your call. We will SMS you now to follow up.").trim();
    const hasRecording = !!(settingsRow?.voiceRecordingData && settingsRow?.voiceRecordingMimeType);

    // Build the public URL for the recording
    const domains = process.env.REPLIT_DOMAINS || "";
    const deploymentDomain = process.env.DEPLOYMENT_DOMAIN || domains.split(",").find((d: string) => d.trim().endsWith('.replit.app'))?.trim() || "";
    const baseUrl = deploymentDomain ? `https://${deploymentDomain}` : `${req.protocol}://${req.get("host")}`;
    const recordingUrl = hasRecording && settingsRow?.userId ? `${baseUrl}/api/voice-recording/${settingsRow.userId}` : null;

    res.set("Content-Type", "text/xml");
    if (recordingUrl) {
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${recordingUrl}</Play>
  <Hangup/>
</Response>`);
    } else {
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${voiceMessage} Thanks for calling ${businessName}.</Say>
  <Hangup/>
</Response>`);
    }
  });

  // Public endpoint: Twilio fetches this to play the tradie's recorded voicemail
  app.get("/api/voice-recording/:userId", async (req: Request, res: Response) => {
    try {
      const userId = req.params.userId as string;
      const [row] = await db.select({
        voiceRecordingData: settings.voiceRecordingData,
        voiceRecordingMimeType: settings.voiceRecordingMimeType,
      }).from(settings).where(eq(settings.userId, userId));

      if (!row?.voiceRecordingData) {
        return res.status(404).json({ error: "No recording found" });
      }

      const mimeType = row.voiceRecordingMimeType || "audio/mp4";
      const audioBuffer = Buffer.from(row.voiceRecordingData, "base64");
      res.set("Content-Type", mimeType);
      res.set("Content-Length", audioBuffer.length.toString());
      res.set("Cache-Control", "no-cache");
      res.send(audioBuffer);
    } catch (err: any) {
      console.error("Serve voice recording error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Upload voice recording (base64 encoded audio from the app)
  app.post("/api/settings/voice-recording", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { audioBase64, mimeType } = req.body;
      if (!audioBase64) {
        return res.status(400).json({ error: "audioBase64 is required" });
      }
      // Validate it's actual base64
      const buffer = Buffer.from(audioBase64, "base64");
      if (buffer.length === 0) {
        return res.status(400).json({ error: "Invalid audio data" });
      }

      const [row] = await db.update(settings)
        .set({
          voiceRecordingData: audioBase64,
          voiceRecordingMimeType: mimeType || "audio/mp4",
        })
        .where(eq(settings.userId, req.userId!))
        .returning();

      res.json({ ok: true, size: buffer.length });
    } catch (err: any) {
      console.error("Upload voice recording error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Delete voice recording
  app.delete("/api/settings/voice-recording", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      await db.update(settings)
        .set({ voiceRecordingData: null, voiceRecordingMimeType: null })
        .where(eq(settings.userId, req.userId!));
      res.json({ ok: true });
    } catch (err: any) {
      console.error("Delete voice recording error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/jobs", requireAuth, async (req: AuthRequest, res: Response) => {
    const rows = await db.select().from(jobs)
      .where(eq(jobs.userId, req.userId!))
      .orderBy(desc(jobs.createdAt));
    res.json(rows);
  });

  app.post("/api/jobs", requireAuth, async (req: AuthRequest, res: Response) => {
    const { callerName, phoneNumber, jobType, date, time, address, notes, status, missedCallId, isUrgent } = req.body;
    const [job] = await db.insert(jobs).values({
      userId: req.userId!,
      callerName: callerName || "Unknown",
      phoneNumber: phoneNumber || "",
      jobType: jobType || "General",
      date, time, address, notes,
      status: status || "pending",
      missedCallId,
      isUrgent: isUrgent || false,
    }).returning();

    if (missedCallId) {
      await db.update(missedCalls).set({ jobBooked: true }).where(
        and(eq(missedCalls.id, missedCallId), eq(missedCalls.userId, req.userId!))
      );
    }

    res.json(job);
  });

  app.patch("/api/jobs/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    const id = paramId(req);
    const [job] = await db.update(jobs).set(req.body).where(
      and(eq(jobs.id, id), eq(jobs.userId, req.userId!))
    ).returning();
    res.json(job);
  });

  app.delete("/api/jobs/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    const id = paramId(req);
    await db.delete(jobs).where(
      and(eq(jobs.id, id), eq(jobs.userId, req.userId!))
    );
    res.json({ ok: true });
  });

  app.get("/api/services", requireAuth, async (req: AuthRequest, res: Response) => {
    const [row] = await db.select().from(settings).where(eq(settings.userId, req.userId!));
    const services = (row?.services as string[]) || DEFAULT_SERVICES;
    res.json(services);
  });

  app.put("/api/services", requireAuth, async (req: AuthRequest, res: Response) => {
    const { services: newServices } = req.body;
    if (!Array.isArray(newServices) || newServices.length === 0) {
      return res.status(400).json({ error: "Services must be a non-empty array" });
    }
    const cleaned = newServices.map((s: string) => s.trim()).filter((s: string) => s.length > 0);
    const [row] = await db.update(settings).set({ services: cleaned }).where(eq(settings.userId, req.userId!)).returning();
    res.json((row.services as string[]) || cleaned);
  });

  app.get("/api/settings", requireAuth, async (req: AuthRequest, res: Response) => {
    const [row] = await db.select().from(settings).where(eq(settings.userId, req.userId!));
    res.json(row || { id: "default", userId: req.userId!, businessName: "", autoReplyEnabled: true, services: DEFAULT_SERVICES });
  });

  app.patch("/api/settings", requireAuth, async (req: AuthRequest, res: Response) => {
    const existing = await db.select().from(settings).where(eq(settings.userId, req.userId!));
    if (existing.length === 0) {
      const [row] = await db.insert(settings).values({
        userId: req.userId!,
        businessName: req.body.businessName || "",
        autoReplyEnabled: req.body.autoReplyEnabled !== undefined ? req.body.autoReplyEnabled : true,
      }).returning();
      return res.json(row);
    }
    const [row] = await db.update(settings).set(req.body).where(eq(settings.userId, req.userId!)).returning();
    res.json(row);
  });

  app.get("/api/templates", requireAuth, async (req: AuthRequest, res: Response) => {
    const rows = await db.select().from(smsTemplates).where(eq(smsTemplates.userId, req.userId!));
    res.json(rows);
  });

  app.post("/api/templates", requireAuth, async (req: AuthRequest, res: Response) => {
    const [template] = await db.insert(smsTemplates).values({
      userId: req.userId!,
      name: req.body.name,
      message: req.body.message,
      isDefault: req.body.isDefault || false,
    }).returning();
    res.json(template);
  });

  app.patch("/api/templates/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    const id = paramId(req);
    const [template] = await db.update(smsTemplates).set(req.body).where(
      and(eq(smsTemplates.id, id), eq(smsTemplates.userId, req.userId!))
    ).returning();
    res.json(template);
  });

  app.delete("/api/templates/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    const id = paramId(req);
    await db.delete(smsTemplates).where(
      and(eq(smsTemplates.id, id), eq(smsTemplates.userId, req.userId!))
    );
    res.json({ ok: true });
  });

  app.post("/api/templates/:id/set-default", requireAuth, async (req: AuthRequest, res: Response) => {
    const id = paramId(req);
    await db.update(smsTemplates).set({ isDefault: false }).where(
      and(eq(smsTemplates.isDefault, true), eq(smsTemplates.userId, req.userId!))
    );
    const [template] = await db.update(smsTemplates).set({ isDefault: true }).where(
      and(eq(smsTemplates.id, id), eq(smsTemplates.userId, req.userId!))
    ).returning();
    res.json(template);
  });

  app.post("/api/stripe/create-checkout", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const stripe = await getUncachableStripeClient();
      const userId = req.userId!;

      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) return res.status(404).json({ error: "User not found" });

      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { userId },
        });
        await db.update(users).set({ stripeCustomerId: customer.id }).where(eq(users.id, userId));
        customerId = customer.id;
      }

      // Query Stripe API directly for the active recurring price
      const stripeProducts = await stripe.products.search({ query: "name:'TradieCatch Pro' AND active:'true'" });
      if (!stripeProducts.data.length) {
        return res.status(400).json({ error: "No subscription product configured yet. Please contact support." });
      }
      const product = stripeProducts.data[0];
      const stripePrices = await stripe.prices.list({ product: product.id, active: true, limit: 10 });
      const recurringPrice = stripePrices.data.find(p => p.recurring !== null);
      if (!recurringPrice) {
        return res.status(400).json({ error: "No subscription price configured yet. Please contact support." });
      }
      const priceId = recurringPrice.id;

      const domains = process.env.REPLIT_DOMAINS || "";
      const primaryDomain = domains.split(",")[0]?.trim() || "";
      const baseUrl = primaryDomain ? `https://${primaryDomain}` : `${req.protocol}://${req.get("host")}`;

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        subscription_data: {
          trial_period_days: 7,
        },
        success_url: `${baseUrl}/api/stripe/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/api/stripe/checkout-cancel`,
      });

      res.json({ url: session.url });
    } catch (err: any) {
      console.error("Stripe checkout error:", err);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  app.get("/api/stripe/checkout-success", async (req: Request, res: Response) => {
    const sessionId = req.query.session_id as string;
    if (!sessionId) return res.redirect("/?checkout=error");

    try {
      const stripe = await getUncachableStripeClient();
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.customer && session.subscription) {
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer.id;
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;

        await db.update(users)
          .set({ stripeSubscriptionId: subscriptionId })
          .where(eq(users.stripeCustomerId, customerId));
      }
    } catch (err) {
      console.error("Error processing checkout success:", err);
    }

    const domains = process.env.REPLIT_DOMAINS || "";
    const devDomain = process.env.REPLIT_DEV_DOMAIN || "";
    const primaryDomain = domains.split(",")[0]?.trim() || "";

    const redirectUrl = primaryDomain
      ? `https://${primaryDomain}/?checkout=success`
      : devDomain
      ? `https://${devDomain}:8081/?checkout=success`
      : "/?checkout=success";

    res.redirect(redirectUrl);
  });

  app.get("/api/stripe/checkout-cancel", async (req: Request, res: Response) => {
    const domains = process.env.REPLIT_DOMAINS || "";
    const devDomain = process.env.REPLIT_DEV_DOMAIN || "";
    const primaryDomain = domains.split(",")[0]?.trim() || "";

    const redirectUrl = primaryDomain
      ? `https://${primaryDomain}/?checkout=cancelled`
      : devDomain
      ? `https://${devDomain}:8081/?checkout=cancelled`
      : "/?checkout=cancelled";

    res.redirect(redirectUrl);
  });

  app.get("/api/stripe/subscription-status", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const [user] = await db.select().from(users).where(eq(users.id, userId));

      if (user?.email === 'admin@tradiecatch.com') {
        return res.json({
          active: true,
          subscription: {
            id: 'admin_pro',
            status: 'active',
            currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            cancelAtPeriodEnd: false,
          },
        });
      }

      if (!user?.stripeCustomerId) {
        return res.json({ active: false, subscription: null });
      }

      // Query Stripe API directly for up-to-date subscription status
      const stripe = await getUncachableStripeClient();
      const subscriptions = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: 'all',
        limit: 5,
      });

      const activeSub = subscriptions.data.find(
        s => s.status === 'active' || s.status === 'trialing'
      );

      if (!activeSub) {
        return res.json({ active: false, subscription: null });
      }

      // Keep local DB in sync
      if (user.stripeSubscriptionId !== activeSub.id) {
        await db.update(users)
          .set({ stripeSubscriptionId: activeSub.id })
          .where(eq(users.id, userId));
      }

      return res.json({
        active: true,
        subscription: {
          id: activeSub.id,
          status: activeSub.status,
          currentPeriodEnd: new Date(activeSub.current_period_end * 1000).toISOString(),
          cancelAtPeriodEnd: activeSub.cancel_at_period_end,
        },
      });
    } catch (err: any) {
      console.error("Subscription status error:", err);
      res.json({ active: false, subscription: null });
    }
  });

  app.post("/api/stripe/customer-portal", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const [user] = await db.select().from(users).where(eq(users.id, userId));

      if (!user?.stripeCustomerId) {
        return res.status(400).json({ error: "No Stripe customer found" });
      }

      const stripe = await getUncachableStripeClient();
      const domains = process.env.REPLIT_DOMAINS || "";
      const primaryDomain = domains.split(",")[0]?.trim() || "";
      const baseUrl = primaryDomain ? `https://${primaryDomain}` : `${req.protocol}://${req.get("host")}`;

      const portalSession = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: baseUrl,
      });

      res.json({ url: portalSession.url });
    } catch (err: any) {
      console.error("Customer portal error:", err);
      res.status(500).json({ error: "Failed to create portal session" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

function phonesMatchSimple(a: string, b: string): boolean {
  const cleanA = a.replace(/[\s\-()]/g, "");
  const cleanB = b.replace(/[\s\-()]/g, "");
  if (cleanA === cleanB) return true;
  const digitsA = cleanA.replace(/\D/g, "");
  const digitsB = cleanB.replace(/\D/g, "");
  if (digitsA === digitsB) return true;
  if (digitsA.length > 6 && digitsB.length > 6) {
    const suffixLen = Math.min(digitsA.length, digitsB.length) - 1;
    if (digitsA.slice(-suffixLen) === digitsB.slice(-suffixLen)) return true;
  }
  return false;
}
