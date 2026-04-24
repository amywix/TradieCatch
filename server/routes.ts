import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { db } from "./db";
import { sql as rawSql } from "drizzle-orm";
import { missedCalls, jobs, settings, smsTemplates, users, leads, leadMessages, salesSettings, DEFAULT_SERVICES } from "@shared/schema";
import { eq, desc, and, not, SQL } from "drizzle-orm";
import { sendInitialMissedCallSms, handleIncomingReply } from "./sms-conversation";
import { register, login, getMe, requireAuth, type AuthRequest } from "./auth";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import { STAGES, sendLeadSms, buildIntroSms, createCheckoutSession, getOrCreateSalesSettings, handleInboundLeadSms, attachCalendlyBooking, clearCalendlyBooking } from "./sales-flow";

// The dedicated TradieCatch sales/demo number — all inbound SMS here goes
// through the demo booking flow, never the tradie missed-call flow.

function paramId(req: Request | AuthRequest): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

export async function registerRoutes(app: Express): Promise<Server> {

  app.post("/api/auth/register", register);
  app.post("/api/auth/login", login);
  app.get("/api/auth/me", requireAuth, getMe as any);

  app.post("/api/push-token", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { token } = req.body || {};
      if (!token || typeof token !== "string") {
        return res.status(400).json({ error: "Missing token" });
      }
      await db.update(users).set({ pushToken: token }).where(eq(users.id, req.userId!));
      res.json({ success: true });
    } catch (err: any) {
      console.error("push-token error", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/push-token", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      await db.update(users).set({ pushToken: null }).where(eq(users.id, req.userId!));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

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

  // Calendly webhook removed — sales/demo lead flow has been retired.
  // Kept as a no-op for any stale subscriptions still posting here.
  app.post("/api/calendly/webhook-disabled", async (req: Request, res: Response) => {
    try {
      const { sendSms } = await import("./sms-conversation");
      const event = req.body?.event || "";
      const payload = req.body?.payload || {};
      console.log(`Calendly webhook event: ${event}`);

      if (event !== "invitee.created") {
        return res.status(200).json({ ok: true, ignored: event });
      }

      const inviteeName: string = payload?.name || payload?.invitee?.name || "there";
      const startTimeRaw: string = payload?.scheduled_event?.start_time || payload?.event?.start_time || "";
      const eventName: string = payload?.scheduled_event?.name || payload?.event_type?.name || "your TradieCatch call";

      // Try to extract a phone number from invitee SMS reminder, custom answers, or text reminder
      let invPhone: string =
        payload?.text_reminder_number ||
        payload?.invitee?.text_reminder_number ||
        "";
      const qa: any[] = payload?.questions_and_answers || payload?.invitee?.questions_and_answers || [];
      if (!invPhone && Array.isArray(qa)) {
        for (const item of qa) {
          const ans = String(item?.answer || "");
          const m = ans.match(/\+?\d[\d\s\-().]{6,}/);
          if (m) { invPhone = m[0]; break; }
        }
      }

      // Format the booked time for the SMS
      let timeLabel = "";
      if (startTimeRaw) {
        try {
          const d = new Date(startTimeRaw);
          timeLabel = d.toLocaleString("en-AU", {
            weekday: "short", day: "numeric", month: "short",
            hour: "numeric", minute: "2-digit", hour12: true,
            timeZone: "Australia/Sydney",
          });
        } catch { timeLabel = startTimeRaw; }
      }

      // Find the most recent demo conversation awaiting Calendly booking
      const candidateStates = ["demo_awaiting_calendly", "demo_offer_sent"];
      let targetCall: any = null;

      if (invPhone) {
        const normalize = (p: string) => p.replace(/[^\d+]/g, "");
        const target = normalize(invPhone);
        const all = await db.select().from(missedCalls);
        const matched = all
          .filter(c => candidateStates.includes(c.conversationState as string))
          .filter(c => {
            const a = normalize(c.phoneNumber);
            return a.endsWith(target.slice(-9)) || target.endsWith(a.slice(-9));
          })
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        targetCall = matched[0] || null;
      }

      // Fallback: most recent awaiting-calendly conversation in the last 24h
      if (!targetCall) {
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        const all = await db.select().from(missedCalls);
        const recent = all
          .filter(c => c.conversationState === "demo_awaiting_calendly")
          .filter(c => new Date(c.timestamp).getTime() > cutoff)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        targetCall = recent[0] || null;
      }

      if (!targetCall) {
        console.log("Calendly webhook: no matching demo conversation found");
        return res.status(200).json({ ok: true, matched: false });
      }

      const confirmation = `🎉 You're all booked, ${inviteeName.split(" ")[0]}!\n\n${timeLabel ? `📅 ${timeLabel}\n\n` : ""}I'll see you on the call. If anything changes you can reschedule from your Calendly confirmation email.\n\n— Amy, TradieCatch`;

      await sendSms(targetCall.phoneNumber, confirmation, targetCall.userId);

      const log = (targetCall.conversationLog || []) as any[];
      log.push({ role: "business", message: confirmation, timestamp: new Date().toISOString() });
      await db.update(missedCalls).set({
        conversationState: "demo_completed",
        conversationLog: log as any,
      }).where(eq(missedCalls.id, targetCall.id));

      // Also create a job entry so it shows up in the Jobs list
      await db.insert(jobs).values({
        userId: targetCall.userId,
        callerName: inviteeName || targetCall.callerName || `Demo Lead (${targetCall.phoneNumber})`,
        phoneNumber: targetCall.phoneNumber,
        jobType: "TradieCatch Setup Call (Calendly)",
        date: startTimeRaw ? startTimeRaw.slice(0, 10) : "",
        time: timeLabel,
        address: "",
        notes: `Booked via Calendly: ${eventName}`,
        email: payload?.email || payload?.invitee?.email || null,
        status: "confirmed",
        missedCallId: targetCall.id,
        isUrgent: false,
      });

      res.status(200).json({ ok: true, matched: true });
    } catch (err) {
      console.error("Calendly webhook error:", err);
      res.status(200).json({ ok: false });
    }
  });

  app.post("/api/twilio/webhook", async (req: Request, res: Response) => {
    const from = req.body.From || "";
    const to = req.body.To || "";
    const body = req.body.Body || "";
    const messageSid = req.body.MessageSid || req.body.SmsSid || null;

    console.log(`Incoming SMS from ${from} to ${to}: ${body}`);

    try {
      // First try the sales flow — only if `to` matches the configured sales line AND sender is a known lead
      const handledBySales = await handleInboundLeadSms(from, to, body, messageSid);
      if (!handledBySales) {
        // Otherwise fall back to the tradie missed-call/booking flow
        await handleIncomingReply(from, body, to);
      }
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

    let settingsRow: any = await resolveOwnerSettings(to, from);
    if (!settingsRow) {
      console.log(`No user found for Twilio number: ${to}`);
      res.set("Content-Type", "text/xml");
      res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">Sorry, this number is not configured.</Say><Hangup/></Response>`);
      return;
    }
    const userId = settingsRow.userId as string;
    console.log(`Resolved to user ${userId} for Twilio number ${to}`);

    const baseUrl = getPublicBaseUrl(req);
    const mode = (settingsRow.forwardingMode as string) || "carrier_forward";
    const tradieMobile = (settingsRow.tradieMobileNumber as string || "").trim();

    res.set("Content-Type", "text/xml");

    // Option A — Twilio is the front door. Try the tradie's mobile first; if no answer, voicemail/SMS flow runs in dial-result.
    if (mode === "twilio_dial" && tradieMobile) {
      const actionUrl = `${baseUrl}/api/twilio/dial-result?ownerUserId=${encodeURIComponent(userId)}&caller=${encodeURIComponent(from)}&callerName=${encodeURIComponent(callerName)}`;
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial action="${actionUrl}" method="POST" timeout="20" callerId="${to}">
    <Number>${tradieMobile}</Number>
  </Dial>
</Response>`);
      return;
    }

    // Option B (default) — call has already been forwarded by carrier (or direct), so go straight to voicemail flow
    await handleMissedCallAndRespond(req, res, userId, settingsRow, from, callerName, baseUrl);
  });

  // Called when a Dial attempt to the tradie completes. If they answered, we hang up.
  // If they didn't, we run the missed-call/voicemail flow.
  app.post("/api/twilio/dial-result", async (req: Request, res: Response) => {
    const dialStatus = req.body.DialCallStatus || "";
    const ownerUserId = (req.query.ownerUserId as string) || "";
    const caller = (req.query.caller as string) || req.body.From || "";
    const callerName = (req.query.callerName as string) || "Unknown Caller";

    console.log(`Dial result: ${dialStatus} for owner ${ownerUserId}, caller ${caller}`);
    res.set("Content-Type", "text/xml");

    if (dialStatus === "completed" || dialStatus === "answered") {
      res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`);
      return;
    }

    const [settingsRow] = await db.select().from(settings).where(eq(settings.userId, ownerUserId));
    if (!settingsRow) {
      res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`);
      return;
    }
    const baseUrl = getPublicBaseUrl(req);
    await handleMissedCallAndRespond(req, res, ownerUserId, settingsRow, caller, callerName, baseUrl);
  });

  // Twilio posts to this when a voicemail recording is finished
  app.post("/api/twilio/recording-callback", async (req: Request, res: Response) => {
    res.status(200).send("ok");
    try {
      const missedCallId = (req.query.missedCallId as string) || "";
      const recordingUrl = req.body.RecordingUrl || "";
      const recordingDuration = req.body.RecordingDuration || "0";
      console.log(`Recording callback: missedCallId=${missedCallId}, url=${recordingUrl}, duration=${recordingDuration}s`);
      if (!missedCallId || !recordingUrl) return;

      const [call] = await db.select().from(missedCalls).where(eq(missedCalls.id, missedCallId));
      if (!call) { console.log("Recording callback: missed call not found"); return; }

      const [settingsRow] = await db.select().from(settings).where(eq(settings.userId, call.userId));
      if (!settingsRow) { console.log("Recording callback: settings not found"); return; }

      // Download the recording from Twilio (auth required)
      const sid = settingsRow.twilioAccountSid || process.env.TWILIO_ACCOUNT_SID || "";
      const token = settingsRow.twilioAuthToken || process.env.TWILIO_AUTH_TOKEN || "";
      const authHeader = "Basic " + Buffer.from(`${sid}:${token}`).toString("base64");

      const audioRes = await fetch(`${recordingUrl}.mp3`, { headers: { Authorization: authHeader } });
      if (!audioRes.ok) { console.error(`Failed to download recording: ${audioRes.status}`); return; }
      const audioBuf = Buffer.from(await audioRes.arrayBuffer());
      const audioB64 = audioBuf.toString("base64");

      await db.update(missedCalls).set({
        voicemailData: audioB64,
        voicemailMimeType: "audio/mpeg",
        voicemailDurationSeconds: String(recordingDuration),
      }).where(eq(missedCalls.id, missedCallId));
      console.log(`Voicemail saved for call ${missedCallId} (${audioBuf.length} bytes)`);

      // SMS the tradie a link to play the voicemail
      const tradieMobile = (settingsRow.tradieMobileNumber as string || "").trim();
      if (tradieMobile) {
        const baseUrl = getPublicBaseUrl(req);
        const playUrl = `${baseUrl}/api/voicemail/${missedCallId}`;
        const { sendSms } = await import("./sms-conversation");
        const callerLabel = call.callerName && call.callerName !== "Unknown Caller" ? call.callerName : call.phoneNumber;
        const msg = `📩 New voicemail from ${callerLabel} (${recordingDuration}s).\n\n▶️ Listen: ${playUrl}`;
        try {
          await sendSms(tradieMobile, msg, call.userId);
          console.log(`Voicemail SMS sent to tradie ${tradieMobile}`);
        } catch (smsErr) {
          console.error("Voicemail-to-tradie SMS failed:", smsErr);
        }
      } else {
        console.log("No tradie mobile configured — skipping voicemail SMS forward");
      }
    } catch (err) {
      console.error("Recording callback error:", err);
    }
  });

  // Public endpoint: streams a stored voicemail audio file (used in tradie SMS link)
  app.get("/api/voicemail/:id", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const [call] = await db.select().from(missedCalls).where(eq(missedCalls.id, id));
      if (!call?.voicemailData) {
        return res.status(404).send("Voicemail not found");
      }
      const buf = Buffer.from(call.voicemailData, "base64");
      res.set("Content-Type", call.voicemailMimeType || "audio/mpeg");
      res.set("Content-Length", buf.length.toString());
      res.set("Cache-Control", "private, max-age=86400");
      res.send(buf);
    } catch (err: any) {
      console.error("Serve voicemail error:", err);
      res.status(500).send("Error");
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
    // If a Twilio phone number is being saved, remove it from every other account first
    if (req.body.twilioPhoneNumber && req.body.twilioPhoneNumber.trim()) {
      await db.update(settings)
        .set({ twilioPhoneNumber: "" })
        .where(and(
          eq(settings.twilioPhoneNumber, req.body.twilioPhoneNumber.trim()),
          not(eq(settings.userId, req.userId!))
        ));
    }

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
        line_items: [
          { price: priceId, quantity: 1 },
          {
            quantity: 1,
            price_data: {
              currency: 'aud',
              product_data: {
                name: 'TradieCatch Setup Fee',
                description: 'One-time setup & onboarding (charged today). $99/month subscription begins after 30 days.',
              },
              unit_amount: 29900,
            },
          },
        ],
        mode: 'subscription',
        subscription_data: {
          trial_period_days: 30,
          description: 'TradieCatch Pro — $99/month begins after 30-day setup period',
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

  // ───────────────────────── Sales pipeline (operator) ─────────────────────────

  async function requireOperator(req: AuthRequest, res: Response, next: any) {
    if (!req.userId) return res.status(401).json({ error: "Authentication required" });
    const [u] = await db.select().from(users).where(eq(users.id, req.userId));
    if (!u || !u.isOperator) return res.status(403).json({ error: "Operator access required" });
    next();
  }

  app.get("/api/sales/leads", requireAuth, requireOperator, async (_req: AuthRequest, res: Response) => {
    const rows = await db.select().from(leads).orderBy(desc(leads.updatedAt));
    res.json(rows);
  });

  app.post("/api/sales/leads", requireAuth, requireOperator, async (req: AuthRequest, res: Response) => {
    const { name, phoneNumber, email, address, jobNotes } = req.body || {};
    if (!name || !phoneNumber) return res.status(400).json({ error: "name and phoneNumber are required" });
    const [created] = await db.insert(leads).values({
      name: String(name).trim(),
      phoneNumber: String(phoneNumber).trim(),
      email: email ? String(email).trim() : "",
      address: address ? String(address).trim() : "",
      jobNotes: jobNotes ? String(jobNotes) : "",
      stage: "new",
    }).returning();
    res.json(created);
  });

  app.get("/api/sales/leads/:id", requireAuth, requireOperator, async (req: AuthRequest, res: Response) => {
    const id = paramId(req);
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    if (!lead) return res.status(404).json({ error: "Lead not found" });
    const messages = await db.select().from(leadMessages).where(eq(leadMessages.leadId, id)).orderBy(leadMessages.createdAt);
    res.json({ lead, messages });
  });

  app.patch("/api/sales/leads/:id", requireAuth, requireOperator, async (req: AuthRequest, res: Response) => {
    const id = paramId(req);
    const allowed: Record<string, true> = {
      name: true, phoneNumber: true, email: true, address: true,
      jobNotes: true, stage: true, outcome: true, paid: true,
    };
    const updates: Record<string, any> = { updatedAt: new Date() };
    for (const k of Object.keys(req.body || {})) {
      if (allowed[k]) updates[k] = req.body[k];
    }
    if (updates.stage && !STAGES.includes(updates.stage)) {
      return res.status(400).json({ error: `stage must be one of ${STAGES.join(", ")}` });
    }
    const [updated] = await db.update(leads).set(updates).where(eq(leads.id, id)).returning();
    if (!updated) return res.status(404).json({ error: "Lead not found" });
    res.json(updated);
  });

  app.delete("/api/sales/leads/:id", requireAuth, requireOperator, async (req: AuthRequest, res: Response) => {
    const id = paramId(req);
    await db.delete(leadMessages).where(eq(leadMessages.leadId, id));
    await db.delete(leads).where(eq(leads.id, id));
    res.json({ success: true });
  });

  app.post("/api/sales/leads/:id/send-intro", requireAuth, requireOperator, async (req: AuthRequest, res: Response) => {
    const id = paramId(req);
    try {
      const body = await buildIntroSms(id);
      await sendLeadSms(id, body);
      const [updated] = await db.update(leads).set({ stage: "qualified", updatedAt: new Date() }).where(eq(leads.id, id)).returning();
      res.json({ success: true, lead: updated });
    } catch (err: any) {
      console.error("send-intro error:", err);
      res.status(500).json({ error: err.message || "Failed to send SMS" });
    }
  });

  app.post("/api/sales/leads/:id/send-message", requireAuth, requireOperator, async (req: AuthRequest, res: Response) => {
    const id = paramId(req);
    const { body } = req.body || {};
    if (!body || !String(body).trim()) return res.status(400).json({ error: "body is required" });
    try {
      await sendLeadSms(id, String(body));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to send SMS" });
    }
  });

  app.post("/api/sales/leads/:id/resend-payment", requireAuth, requireOperator, async (req: AuthRequest, res: Response) => {
    const id = paramId(req);
    try {
      const baseUrl = getPublicBaseUrl(req);
      const session = await createCheckoutSession(id, baseUrl);
      const reply = `Here's your TradieCatch setup link ($299 one-off): ${session.url}`;
      await sendLeadSms(id, reply);
      res.json({ success: true, url: session.url });
    } catch (err: any) {
      console.error("resend-payment error:", err);
      res.status(500).json({ error: err.message || "Failed to send payment link" });
    }
  });

  app.post("/api/sales/leads/:id/resend-booking", requireAuth, requireOperator, async (req: AuthRequest, res: Response) => {
    const id = paramId(req);
    try {
      const s = await getOrCreateSalesSettings();
      if (!s.calendlyUrl) return res.status(400).json({ error: "Calendly URL not configured in Settings" });
      await sendLeadSms(id, `Pick a time that works for you: ${s.calendlyUrl}`);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to send booking link" });
    }
  });

  app.get("/api/sales/settings", requireAuth, requireOperator, async (_req: AuthRequest, res: Response) => {
    const s = await getOrCreateSalesSettings();
    const baseUrl = process.env.REPLIT_DOMAINS
      ? `https://${process.env.REPLIT_DOMAINS.split(",")[0].trim()}`
      : (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "");
    res.json({
      ...s,
      twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || "",
      webhookUrls: {
        twilioInboundSms: `${baseUrl}/api/twilio/webhook`,
        stripe: `${baseUrl}/api/stripe/webhook`,
        calendly: `${baseUrl}/api/sales/calendly/webhook`,
      },
      configuredSecrets: {
        TWILIO_ACCOUNT_SID: !!process.env.TWILIO_ACCOUNT_SID,
        TWILIO_AUTH_TOKEN: !!process.env.TWILIO_AUTH_TOKEN,
        TWILIO_PHONE_NUMBER: !!process.env.TWILIO_PHONE_NUMBER,
        STRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY,
      },
    });
  });

  app.patch("/api/sales/settings", requireAuth, requireOperator, async (req: AuthRequest, res: Response) => {
    const { demoVideoUrl, calendlyUrl, introSmsTemplate } = req.body || {};
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (typeof demoVideoUrl === "string") updates.demoVideoUrl = demoVideoUrl.trim();
    if (typeof calendlyUrl === "string") updates.calendlyUrl = calendlyUrl.trim();
    if (typeof introSmsTemplate === "string") updates.introSmsTemplate = introSmsTemplate;
    await getOrCreateSalesSettings();
    const [updated] = await db.update(salesSettings).set(updates).where(eq(salesSettings.id, "sales-singleton")).returning();
    res.json(updated);
  });

  // Calendly webhook — no auth, but verifies basic shape. Operator pastes this URL in Calendly's webhook settings.
  app.post("/api/sales/calendly/webhook", async (req: Request, res: Response) => {
    try {
      const event = req.body?.event || "";
      const payload = req.body?.payload || {};
      const inviteeEmail = payload?.email || null;
      const questionsAndAnswers = Array.isArray(payload?.questions_and_answers) ? payload.questions_and_answers : [];
      const phoneAnswer = questionsAndAnswers.find((q: any) =>
        typeof q?.question === "string" && /phone|mobile/i.test(q.question)
      );
      const phoneFromQuestion = phoneAnswer?.answer || null;
      const inviteePhone = payload?.text_reminder_number || phoneFromQuestion || null;
      const startTimeStr = payload?.scheduled_event?.start_time || payload?.event?.start_time || null;
      const eventUri = payload?.uri || payload?.scheduled_event?.uri || "";

      if (event === "invitee.created" && startTimeStr && eventUri) {
        const result = await attachCalendlyBooking({
          email: inviteeEmail,
          phone: inviteePhone,
          startTime: new Date(startTimeStr),
          eventUri,
        });
        console.log(`[calendly] invitee.created → lead ${result.leadId || "(no match)"}`);
      } else if (event === "invitee.canceled" && eventUri) {
        const result = await clearCalendlyBooking(eventUri);
        console.log(`[calendly] invitee.canceled → lead ${result.leadId || "(no match)"}`);
      }
      res.json({ received: true });
    } catch (err: any) {
      console.error("Calendly webhook error:", err);
      res.status(200).json({ received: true });
    }
  });

  app.get("/api/sales/agenda", requireAuth, requireOperator, async (_req: AuthRequest, res: Response) => {
    const all = await db.select().from(leads);
    const upcoming = all
      .filter(l => l.calendlyEventTime && new Date(l.calendlyEventTime).getTime() >= Date.now() - 60 * 60 * 1000)
      .sort((a, b) => new Date(a.calendlyEventTime!).getTime() - new Date(b.calendlyEventTime!).getTime());
    res.json(upcoming);
  });

  const httpServer = createServer(app);
  return httpServer;
}

function getPublicBaseUrl(req: Request): string {
  const domains = process.env.REPLIT_DOMAINS || "";
  const deploymentDomain = process.env.DEPLOYMENT_DOMAIN || domains.split(",").find((d: string) => d.trim().endsWith('.replit.app'))?.trim() || "";
  return deploymentDomain ? `https://${deploymentDomain}` : `${req.protocol}://${req.get("host")}`;
}

async function resolveOwnerSettings(toNumber: string, fromNumber: string): Promise<any | null> {
  const allSettings = await db.select().from(settings);
  const matching = allSettings.filter(s => {
    const t = s.twilioPhoneNumber || "";
    return t && phonesMatchSimple(t, toNumber);
  });
  if (matching.length === 0) return null;
  if (matching.length === 1) return matching[0];

  const scored = matching.map(s => {
    let score = 0;
    if (s.businessName && (s.businessName as string).trim()) score += 2;
    const svcList = s.services as string[] | null;
    if (Array.isArray(svcList) && svcList.length > 0) score += 1;
    return { s, score };
  }).sort((a, b) => b.score - a.score);

  const top = scored[0].score;
  const candidates = scored.filter(x => x.score === top).map(x => x.s);
  if (candidates.length === 1) return candidates[0];

  const recent = await db.select().from(missedCalls)
    .where(eq(missedCalls.phoneNumber, fromNumber))
    .orderBy(desc(missedCalls.timestamp))
    .limit(1);
  if (recent.length > 0) {
    const m = candidates.find(s => s.userId === recent[0].userId);
    if (m) return m;
  }
  return candidates[0];
}

async function handleMissedCallAndRespond(
  req: Request,
  res: Response,
  userId: string,
  settingsRow: any,
  from: string,
  callerName: string,
  baseUrl: string,
): Promise<void> {
  let missedCallId: string | null = null;
  try {
    const existing = await db.select().from(missedCalls)
      .where(and(eq(missedCalls.userId, userId), eq(missedCalls.phoneNumber, from)))
      .orderBy(desc(missedCalls.timestamp))
      .limit(1);
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const isDuplicate = existing.length > 0 && new Date(existing[0].timestamp) > fiveMinAgo;

    if (isDuplicate) {
      missedCallId = existing[0].id;
      console.log(`Duplicate call from ${from} within 5 minutes — reusing call ${missedCallId}`);
    } else {
      const [newCall] = await db.insert(missedCalls).values({
        userId,
        callerName: callerName || "Unknown Caller",
        phoneNumber: from,
        timestamp: new Date(),
      }).returning();
      missedCallId = newCall.id;
      console.log(`Missed call logged for user ${userId}: ${from} (id: ${missedCallId})`);

      if (settingsRow?.autoReplyEnabled) {
        try {
          await sendInitialMissedCallSms(missedCallId, userId);
          console.log(`Auto-reply SMS sent for call ${missedCallId}`);
        } catch (smsErr) {
          console.error("Auto-reply SMS failed:", smsErr);
        }
      }
    }
  } catch (err) {
    console.error("handleMissedCallAndRespond DB error:", err);
  }

  const businessName = settingsRow?.businessName || "us";
  const voiceMessage = (settingsRow?.missedCallVoiceMessage || "Sorry we missed your call. Please leave a message after the tone and we will get back to you.").trim();
  const hasRecording = !!(settingsRow?.voiceRecordingData && settingsRow?.voiceRecordingMimeType);
  const recordingUrl = hasRecording && settingsRow?.userId ? `${baseUrl}/api/voice-recording/${settingsRow.userId}` : null;
  const voicemailEnabled = settingsRow?.voicemailEnabled !== false;

  const greetingTwiml = recordingUrl
    ? `<Play>${recordingUrl}</Play>`
    : `<Say voice="alice">${voiceMessage} Thanks for calling ${businessName}.</Say>`;

  if (voicemailEnabled && missedCallId) {
    const recCb = `${baseUrl}/api/twilio/recording-callback?missedCallId=${encodeURIComponent(missedCallId)}`;
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${greetingTwiml}
  <Record action="${recCb}" method="POST" recordingStatusCallback="${recCb}" recordingStatusCallbackMethod="POST" maxLength="120" timeout="5" playBeep="true" finishOnKey="#" trim="trim-silence"/>
  <Say voice="alice">No message recorded. Goodbye.</Say>
  <Hangup/>
</Response>`);
  } else {
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${greetingTwiml}
  <Hangup/>
</Response>`);
  }
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
