import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { db } from "./db";
import { missedCalls, jobs, settings, smsTemplates, DEFAULT_SERVICES } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { sendInitialMissedCallSms, handleIncomingReply } from "./sms-conversation";

export async function registerRoutes(app: Express): Promise<Server> {
  await seedDefaults();

  app.get("/api/config", async (req: Request, res: Response) => {
    const domains = process.env.REPLIT_DOMAINS || "";
    const primaryDomain = domains.split(",")[0]?.trim() || "";
    const protocol = req.protocol || "https";
    const hostFromHeader = req.get("host") || "";
    const appUrl = primaryDomain
      ? `https://${primaryDomain}`
      : hostFromHeader
        ? `${protocol}://${hostFromHeader}`
        : "";
    res.json({
      revenueCatApiKey: process.env.REVENUECAT_API_KEY || "",
      webhookUrl: appUrl ? `${appUrl}/api/twilio/webhook` : "",
      voiceWebhookUrl: appUrl ? `${appUrl}/api/twilio/voice` : "",
      appUrl,
    });
  });

  app.get("/api/missed-calls", async (_req: Request, res: Response) => {
    const rows = await db.select().from(missedCalls).orderBy(desc(missedCalls.timestamp));
    res.json(rows);
  });

  app.post("/api/missed-calls", async (req: Request, res: Response) => {
    const { callerName, phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ error: "phoneNumber is required" });
    }
    const [call] = await db.insert(missedCalls).values({
      callerName: callerName || "Unknown Caller",
      phoneNumber,
      timestamp: new Date(),
    }).returning();
    res.json(call);
  });

  app.delete("/api/missed-calls/:id", async (req: Request, res: Response) => {
    await db.delete(missedCalls).where(eq(missedCalls.id, req.params.id));
    res.json({ ok: true });
  });

  app.post("/api/missed-calls/:id/send-sms", async (req: Request, res: Response) => {
    try {
      await sendInitialMissedCallSms(req.params.id);
      const [call] = await db.select().from(missedCalls).where(eq(missedCalls.id, req.params.id));
      res.json(call);
    } catch (err: any) {
      console.error("Send SMS error:", err);
      res.status(500).json({ error: err.message || "Failed to send SMS" });
    }
  });

  app.get("/api/missed-calls/:id", async (req: Request, res: Response) => {
    const [call] = await db.select().from(missedCalls).where(eq(missedCalls.id, req.params.id));
    if (!call) return res.status(404).json({ error: "Not found" });
    res.json(call);
  });

  app.post("/api/twilio/webhook", async (req: Request, res: Response) => {
    const from = req.body.From || "";
    const body = req.body.Body || "";

    console.log(`Incoming SMS from ${from}: ${body}`);

    try {
      await handleIncomingReply(from, body);
    } catch (err) {
      console.error("Webhook handler error:", err);
    }

    res.set("Content-Type", "text/xml");
    res.send("<Response></Response>");
  });

  app.post("/api/twilio/voice", async (req: Request, res: Response) => {
    const from = req.body.From || req.body.Caller || "";
    const callStatus = req.body.CallStatus || "";
    const callerName = req.body.CallerName || "Unknown Caller";

    console.log(`Incoming call from ${from} (status: ${callStatus}, name: ${callerName})`);

    try {
      const [existingCall] = await db.select().from(missedCalls)
        .where(eq(missedCalls.phoneNumber, from))
        .orderBy(desc(missedCalls.timestamp))
        .limit(1);

      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      const isDuplicate = existingCall && new Date(existingCall.timestamp) > fiveMinAgo;

      if (!isDuplicate) {
        const [newCall] = await db.insert(missedCalls).values({
          callerName: callerName || "Unknown Caller",
          phoneNumber: from,
          timestamp: new Date(),
        }).returning();

        console.log(`Missed call logged: ${from} (id: ${newCall.id})`);

        const [settingsRow] = await db.select().from(settings).where(eq(settings.id, "default"));
        if (settingsRow?.autoReplyEnabled) {
          try {
            await sendInitialMissedCallSms(newCall.id);
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

    const [settingsRow] = await db.select().from(settings).where(eq(settings.id, "default"));
    const businessName = settingsRow?.businessName || "us";

    res.set("Content-Type", "text/xml");
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Sorry we can't take your call right now. We'll send you a text shortly so we can help you out. Thanks for calling ${businessName}.</Say>
  <Hangup/>
</Response>`);
  });

  app.get("/api/jobs", async (_req: Request, res: Response) => {
    const rows = await db.select().from(jobs).orderBy(desc(jobs.createdAt));
    res.json(rows);
  });

  app.post("/api/jobs", async (req: Request, res: Response) => {
    const { callerName, phoneNumber, jobType, date, time, address, notes, status, missedCallId, isUrgent } = req.body;
    const [job] = await db.insert(jobs).values({
      callerName: callerName || "Unknown",
      phoneNumber: phoneNumber || "",
      jobType: jobType || "General",
      date, time, address, notes,
      status: status || "pending",
      missedCallId,
      isUrgent: isUrgent || false,
    }).returning();

    if (missedCallId) {
      await db.update(missedCalls).set({ jobBooked: true }).where(eq(missedCalls.id, missedCallId));
    }

    res.json(job);
  });

  app.patch("/api/jobs/:id", async (req: Request, res: Response) => {
    const [job] = await db.update(jobs).set(req.body).where(eq(jobs.id, req.params.id)).returning();
    res.json(job);
  });

  app.delete("/api/jobs/:id", async (req: Request, res: Response) => {
    await db.delete(jobs).where(eq(jobs.id, req.params.id));
    res.json({ ok: true });
  });

  app.get("/api/services", async (_req: Request, res: Response) => {
    const [row] = await db.select().from(settings).where(eq(settings.id, "default"));
    const services = (row?.services as string[]) || DEFAULT_SERVICES;
    res.json(services);
  });

  app.put("/api/services", async (req: Request, res: Response) => {
    const { services: newServices } = req.body;
    if (!Array.isArray(newServices) || newServices.length === 0) {
      return res.status(400).json({ error: "Services must be a non-empty array" });
    }
    const cleaned = newServices.map((s: string) => s.trim()).filter((s: string) => s.length > 0);
    const [row] = await db.update(settings).set({ services: cleaned }).where(eq(settings.id, "default")).returning();
    res.json((row.services as string[]) || cleaned);
  });

  app.get("/api/settings", async (_req: Request, res: Response) => {
    const [row] = await db.select().from(settings).where(eq(settings.id, "default"));
    res.json(row || { id: "default", businessName: "", autoReplyEnabled: true, services: DEFAULT_SERVICES });
  });

  app.patch("/api/settings", async (req: Request, res: Response) => {
    const existing = await db.select().from(settings).where(eq(settings.id, "default"));
    if (existing.length === 0) {
      const [row] = await db.insert(settings).values({
        id: "default",
        businessName: req.body.businessName || "",
        autoReplyEnabled: req.body.autoReplyEnabled !== undefined ? req.body.autoReplyEnabled : true,
      }).returning();
      return res.json(row);
    }
    const [row] = await db.update(settings).set(req.body).where(eq(settings.id, "default")).returning();
    res.json(row);
  });

  app.get("/api/templates", async (_req: Request, res: Response) => {
    const rows = await db.select().from(smsTemplates);
    res.json(rows);
  });

  app.post("/api/templates", async (req: Request, res: Response) => {
    const [template] = await db.insert(smsTemplates).values({
      name: req.body.name,
      message: req.body.message,
      isDefault: req.body.isDefault || false,
    }).returning();
    res.json(template);
  });

  app.patch("/api/templates/:id", async (req: Request, res: Response) => {
    const [template] = await db.update(smsTemplates).set(req.body).where(eq(smsTemplates.id, req.params.id)).returning();
    res.json(template);
  });

  app.delete("/api/templates/:id", async (req: Request, res: Response) => {
    await db.delete(smsTemplates).where(eq(smsTemplates.id, req.params.id));
    res.json({ ok: true });
  });

  app.post("/api/templates/:id/set-default", async (req: Request, res: Response) => {
    await db.update(smsTemplates).set({ isDefault: false }).where(eq(smsTemplates.isDefault, true));
    const [template] = await db.update(smsTemplates).set({ isDefault: true }).where(eq(smsTemplates.id, req.params.id)).returning();
    res.json(template);
  });

  const httpServer = createServer(app);
  return httpServer;
}

async function seedDefaults() {
  const existingSettings = await db.select().from(settings);
  if (existingSettings.length === 0) {
    await db.insert(settings).values({
      id: "default",
      businessName: "",
      autoReplyEnabled: true,
      services: DEFAULT_SERVICES,
    });
  } else if (!existingSettings[0].services) {
    await db.update(settings).set({ services: DEFAULT_SERVICES }).where(eq(settings.id, "default"));
  }

  const existingTemplates = await db.select().from(smsTemplates);
  if (existingTemplates.length === 0) {
    await db.insert(smsTemplates).values([
      {
        name: "Missed Call Auto-Reply",
        message: "Hi! Sorry we missed your call. We'll get back to you shortly.",
        isDefault: true,
      },
    ]);
  }
}
