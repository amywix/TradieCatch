import type { Express, Request, Response } from "express";
import { db } from "./db";
import { eq, desc, asc, and } from "drizzle-orm";
import { leads, leadMessages, salesSettings, LEAD_STAGES, SALES_SETTINGS_ID } from "@shared/schema";
import { requireAuth, requireOperator, type AuthRequest } from "./auth";
import {
  sendIntroSmsToLead,
  sendLeadSms,
  createSetupFeeCheckout,
  getSalesSettingsRow,
  handleSalesCalendlyEvent,
} from "./sales-flow";

function getBaseUrl(req: Request): string {
  const domains = process.env.REPLIT_DOMAINS || "";
  const primary = domains.split(",")[0]?.trim();
  return primary ? `https://${primary}` : `${req.protocol}://${req.get("host")}`;
}

export function registerSalesRoutes(app: Express) {
  // ---- Leads CRUD ----

  app.get("/api/sales/leads", requireAuth, requireOperator, async (req: AuthRequest, res: Response) => {
    try {
      const stage = (req.query.stage as string) || "";
      const all = await db.select().from(leads).orderBy(desc(leads.updatedAt));
      const filtered = stage ? all.filter(l => l.stage === stage) : all;
      res.json(filtered);
    } catch (err) {
      console.error("Sales list leads error:", err);
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });

  app.post("/api/sales/leads", requireAuth, requireOperator, async (req: AuthRequest, res: Response) => {
    try {
      const { name, phone, email, address, jobNotes, stage } = req.body || {};
      if (!phone || typeof phone !== "string" || phone.trim().length < 6) {
        return res.status(400).json({ error: "Phone number is required" });
      }
      const stageValue = LEAD_STAGES.includes(stage) ? stage : "new";
      const [created] = await db.insert(leads).values({
        name: (name || "").trim(),
        phone: phone.trim(),
        email: (email || "").trim(),
        address: (address || "").trim(),
        jobNotes: (jobNotes || "").trim(),
        stage: stageValue,
      }).returning();
      res.json(created);
    } catch (err) {
      console.error("Sales create lead error:", err);
      res.status(500).json({ error: "Failed to create lead" });
    }
  });

  app.get("/api/sales/leads/:id", requireAuth, requireOperator, async (req: AuthRequest, res: Response) => {
    try {
      const [lead] = await db.select().from(leads).where(eq(leads.id, req.params.id));
      if (!lead) return res.status(404).json({ error: "Lead not found" });
      res.json(lead);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch lead" });
    }
  });

  app.patch("/api/sales/leads/:id", requireAuth, requireOperator, async (req: AuthRequest, res: Response) => {
    try {
      const allowed = ["name", "phone", "email", "address", "jobNotes", "stage", "paid", "outcome"];
      const updates: Record<string, any> = { updatedAt: new Date() };
      for (const k of allowed) {
        if (req.body[k] !== undefined) updates[k] = req.body[k];
      }
      if (updates.stage && !LEAD_STAGES.includes(updates.stage)) {
        return res.status(400).json({ error: "Invalid stage" });
      }
      const [updated] = await db.update(leads).set(updates).where(eq(leads.id, req.params.id)).returning();
      if (!updated) return res.status(404).json({ error: "Lead not found" });
      res.json(updated);
    } catch (err) {
      console.error("Sales update lead error:", err);
      res.status(500).json({ error: "Failed to update lead" });
    }
  });

  app.delete("/api/sales/leads/:id", requireAuth, requireOperator, async (req: AuthRequest, res: Response) => {
    try {
      await db.delete(leadMessages).where(eq(leadMessages.leadId, req.params.id));
      await db.delete(leads).where(eq(leads.id, req.params.id));
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete lead" });
    }
  });

  // ---- Messages ----

  app.get("/api/sales/leads/:id/messages", requireAuth, requireOperator, async (req: AuthRequest, res: Response) => {
    try {
      const list = await db.select().from(leadMessages)
        .where(eq(leadMessages.leadId, req.params.id))
        .orderBy(asc(leadMessages.createdAt));
      res.json(list);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/sales/leads/:id/intro-sms", requireAuth, requireOperator, async (req: AuthRequest, res: Response) => {
    try {
      await sendIntroSmsToLead(req.params.id);
      res.json({ ok: true });
    } catch (err: any) {
      console.error("Sales intro SMS error:", err);
      res.status(500).json({ error: err?.message || "Failed to send intro SMS" });
    }
  });

  app.post("/api/sales/leads/:id/send", requireAuth, requireOperator, async (req: AuthRequest, res: Response) => {
    try {
      const { body } = req.body || {};
      if (!body || typeof body !== "string" || !body.trim()) {
        return res.status(400).json({ error: "Message body required" });
      }
      await sendLeadSms(req.params.id, body.trim());
      res.json({ ok: true });
    } catch (err: any) {
      console.error("Sales send SMS error:", err);
      res.status(500).json({ error: err?.message || "Failed to send SMS" });
    }
  });

  app.post("/api/sales/leads/:id/checkout", requireAuth, requireOperator, async (req: AuthRequest, res: Response) => {
    try {
      const url = await createSetupFeeCheckout(req.params.id, getBaseUrl(req));
      res.json({ url });
    } catch (err: any) {
      console.error("Sales checkout error:", err);
      res.status(500).json({ error: err?.message || "Failed to create checkout" });
    }
  });

  // ---- Settings ----

  app.get("/api/sales/settings", requireAuth, requireOperator, async (_req: AuthRequest, res: Response) => {
    try {
      const row = await getSalesSettingsRow();
      const baseUrl = getBaseUrl(_req as any);
      res.json({
        ...row,
        webhooks: {
          calendly: `${baseUrl}/api/sales/calendly/webhook`,
          twilioInbound: `${baseUrl}/api/twilio/webhook`,
          stripe: `${baseUrl}/api/stripe/webhook`,
        },
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.patch("/api/sales/settings", requireAuth, requireOperator, async (req: AuthRequest, res: Response) => {
    try {
      const allowed = ["demoVideoUrl", "calendlyUrl", "setupFeeAmountCents", "setupFeeProductName"];
      const updates: Record<string, any> = { updatedAt: new Date() };
      for (const k of allowed) {
        if (req.body[k] !== undefined) updates[k] = req.body[k];
      }
      // Ensure singleton row exists, then update
      await getSalesSettingsRow();
      const [row] = await db.update(salesSettings).set(updates).where(eq(salesSettings.id, SALES_SETTINGS_ID)).returning();
      res.json(row);
    } catch (err) {
      console.error("Sales settings update error:", err);
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  // ---- Calendly webhook (public) ----

  app.post("/api/sales/calendly/webhook", async (req: Request, res: Response) => {
    try {
      const event = req.body?.event || "";
      const payload = req.body?.payload || {};
      console.log(`Sales Calendly webhook event: ${event}`);
      if (event !== "invitee.created") {
        return res.status(200).json({ ok: true, ignored: event });
      }
      const result = await handleSalesCalendlyEvent(payload);
      res.status(200).json({ ok: true, ...result });
    } catch (err) {
      console.error("Sales Calendly webhook error:", err);
      res.status(200).json({ ok: false });
    }
  });

  // ---- Agenda (upcoming demos) ----

  app.get("/api/sales/agenda", requireAuth, requireOperator, async (_req: AuthRequest, res: Response) => {
    try {
      const all = await db.select().from(leads);
      const upcoming = all
        .filter(l => l.calendlyEventTime && new Date(l.calendlyEventTime).getTime() > Date.now() - 60 * 60 * 1000)
        .sort((a, b) => new Date(a.calendlyEventTime as any).getTime() - new Date(b.calendlyEventTime as any).getTime());
      res.json(upcoming);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch agenda" });
    }
  });
}
