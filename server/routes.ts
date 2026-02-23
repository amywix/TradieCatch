import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { db } from "./db";
import { missedCalls, jobs, settings, smsTemplates, users, DEFAULT_SERVICES } from "@shared/schema";
import { eq, desc, and, SQL } from "drizzle-orm";
import { sendInitialMissedCallSms, handleIncomingReply } from "./sms-conversation";
import { register, login, getMe, requireAuth, type AuthRequest } from "./auth";

function paramId(req: Request | AuthRequest): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

export async function registerRoutes(app: Express): Promise<Server> {

  app.post("/api/auth/register", register);
  app.post("/api/auth/login", login);
  app.get("/api/auth/me", requireAuth, getMe as any);

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

  app.get("/api/missed-calls", requireAuth, async (req: AuthRequest, res: Response) => {
    const rows = await db.select().from(missedCalls)
      .where(eq(missedCalls.userId, req.userId!))
      .orderBy(desc(missedCalls.timestamp));
    res.json(rows);
  });

  app.post("/api/missed-calls", requireAuth, async (req: AuthRequest, res: Response) => {
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

    res.set("Content-Type", "text/xml");
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Sorry we can't take your call right now. We'll send you a text shortly so we can help you out. Thanks for calling ${businessName}.</Say>
  <Hangup/>
</Response>`);
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
