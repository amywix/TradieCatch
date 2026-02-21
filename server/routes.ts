import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { db } from "./db";
import { missedCalls, jobs, settings, smsTemplates } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { sendInitialMissedCallSms, handleIncomingReply } from "./sms-conversation";

export async function registerRoutes(app: Express): Promise<Server> {
  await seedDefaults();

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

  app.get("/api/settings", async (_req: Request, res: Response) => {
    const [row] = await db.select().from(settings).where(eq(settings.id, "default"));
    res.json(row || { id: "default", businessName: "", autoReplyEnabled: true });
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
    });
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
