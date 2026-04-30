import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import * as path from "path";
import * as fs from "fs";
import { db } from "./db";
import { sql as rawSql } from "drizzle-orm";
import { missedCalls, jobs, settings, smsTemplates, users, DEFAULT_SERVICES } from "@shared/schema";
import { eq, desc, and, not, SQL } from "drizzle-orm";
import { sendInitialMissedCallSms, handleIncomingReply } from "./sms-conversation";
import { register, login, getMe, changePassword, acceptTerms, requireAuth, type AuthRequest } from "./auth";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";

function paramId(req: Request | AuthRequest): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

export async function registerRoutes(app: Express): Promise<Server> {

  app.post("/api/auth/register", register);
  app.post("/api/auth/login", login);
  app.get("/api/auth/me", requireAuth, getMe as any);
  app.patch("/api/auth/change-password", requireAuth, changePassword as any);
  app.patch("/api/auth/accept-terms", requireAuth, acceptTerms as any);

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
      await handleIncomingReply(from, body, to);
    } catch (err) {
      console.error("Webhook handler error:", err);
    }

    res.set("Content-Type", "text/xml");
    res.send("<Response></Response>");
  });

  app.post("/api/twilio/voice", async (req: Request, res: Response) => {
    res.set("Content-Type", "text/xml");
    try {
      const from = req.body.From || req.body.Caller || "";
      const to = req.body.To || req.body.Called || "";
      const callStatus = req.body.CallStatus || "";
      const callerName = req.body.CallerName || "Unknown Caller";

      console.log(`Incoming call from ${from} to ${to} (status: ${callStatus}, name: ${callerName})`);

      const settingsRow: any = await resolveOwnerSettings(to, from);
      if (!settingsRow) {
        console.log(`No user found for Twilio number: ${to}`);
        res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Olivia-Neural">Sorry, this number is not configured.</Say><Hangup/></Response>`);
        return;
      }
      const userId = settingsRow.userId as string;
      console.log(`Resolved to user ${userId} for Twilio number ${to}`);

      const baseUrl = getPublicBaseUrl(req);
      const mode = (settingsRow.forwardingMode as string) || "carrier_forward";
      const tradieMobile = (settingsRow.tradieMobileNumber as string || "").trim();

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
    } catch (err) {
      console.error("Voice webhook error:", err);
      if (!res.headersSent) {
        res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Olivia-Neural">Sorry, we encountered an error. Please try again later.</Say><Hangup/></Response>`);
      }
    }
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

  // Test Twilio credentials — makes a lightweight API call to verify they work
  app.post("/api/settings/test-twilio", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const [row] = await db.select({
        twilioAccountSid: settings.twilioAccountSid,
        twilioAuthToken: settings.twilioAuthToken,
        twilioPhoneNumber: settings.twilioPhoneNumber,
      }).from(settings).where(eq(settings.userId, req.userId!));

      const sid = row?.twilioAccountSid || process.env.TWILIO_ACCOUNT_SID || "";
      const token = row?.twilioAuthToken || process.env.TWILIO_AUTH_TOKEN || "";

      if (!sid || !token) {
        return res.json({ ok: false, error: "No credentials saved yet. Enter your Account SID and Auth Token first." });
      }

      const twilioClient = (await import("twilio")).default;
      const client = twilioClient(sid, token);
      const account = await client.api.v2010.accounts(sid).fetch();
      return res.json({ ok: true, accountName: account.friendlyName });
    } catch (err: any) {
      const msg = err.code === 20003
        ? "Authentication failed — your Account SID or Auth Token is wrong. Check your Twilio console."
        : err.message || "Could not connect to Twilio.";
      return res.json({ ok: false, error: msg });
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

    const updates: Record<string, any> = { ...req.body };

    // If baseAddress is being set/changed and the caller didn't supply coords,
    // geocode it server-side and persist the lat/lng. If geocoding fails,
    // null the lat/lng so the service-area check stays disabled until a valid
    // address is provided.
    if (typeof updates.baseAddress === "string") {
      const trimmed = updates.baseAddress.trim();
      updates.baseAddress = trimmed;
      const coordsProvided = updates.baseLat != null && updates.baseLng != null;
      if (!coordsProvided) {
        if (!trimmed) {
          updates.baseLat = null;
          updates.baseLng = null;
        } else {
          try {
            const { geocodeAddress } = await import("./geo");
            const geo = await geocodeAddress(trimmed);
            if (geo) {
              updates.baseLat = geo.lat;
              updates.baseLng = geo.lng;
            } else {
              updates.baseLat = null;
              updates.baseLng = null;
            }
          } catch (err) {
            console.error("Settings PATCH geocode failed:", err);
            updates.baseLat = null;
            updates.baseLng = null;
          }
        }
      }
    }

    const existing = await db.select().from(settings).where(eq(settings.userId, req.userId!));
    if (existing.length === 0) {
      const [row] = await db.insert(settings).values({
        userId: req.userId!,
        businessName: updates.businessName || "",
        autoReplyEnabled: updates.autoReplyEnabled !== undefined ? updates.autoReplyEnabled : true,
        ...(updates.baseAddress !== undefined ? { baseAddress: updates.baseAddress } : {}),
        ...(updates.baseLat !== undefined ? { baseLat: updates.baseLat } : {}),
        ...(updates.baseLng !== undefined ? { baseLng: updates.baseLng } : {}),
        ...(updates.serviceRadiusKm !== undefined ? { serviceRadiusKm: updates.serviceRadiusKm } : {}),
      }).returning();
      return res.json(row);
    }
    const [row] = await db.update(settings).set(updates).where(eq(settings.userId, req.userId!)).returning();
    res.json(row);
  });

  app.post("/api/settings/geocode", requireAuth, async (req: AuthRequest, res: Response) => {
    const address = (req.body?.address || "").toString().trim();
    if (!address) {
      return res.status(400).json({ error: "address required" });
    }
    try {
      const { geocodeAddress } = await import("./geo");
      const r = await geocodeAddress(address);
      if (!r) return res.status(404).json({ error: "Could not find that address. Try adding the suburb and postcode." });
      res.json(r);
    } catch (err: any) {
      console.error("Geocode endpoint error:", err);
      res.status(500).json({ error: err?.message || "Lookup failed" });
    }
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

  // Note: in-app Stripe checkout has been removed. Subscriptions are now created
  // manually outside the app (e.g. via a Stripe payment link sent to the tradie's
  // email). The /api/stripe/subscription-status endpoint auto-links by email.

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

      const stripe = await getUncachableStripeClient();
      let stripeCustomerId = user?.stripeCustomerId || null;

      // If we don't have a Stripe customer linked yet, try to find one by email.
      // This lets you create a customer + subscription in Stripe (e.g. via a payment link)
      // and have the app auto-link as soon as the tradie checks status.
      if (!stripeCustomerId && user?.email) {
        try {
          const matches = await stripe.customers.list({ email: user.email, limit: 5 });
          if (matches.data.length > 0) {
            stripeCustomerId = matches.data[0].id;
            await db.update(users)
              .set({ stripeCustomerId })
              .where(eq(users.id, userId));
          }
        } catch (lookupErr) {
          console.error("Stripe customer lookup by email failed:", lookupErr);
        }
      }

      if (!stripeCustomerId) {
        return res.json({ active: false, subscription: null });
      }

      // Query Stripe API directly for up-to-date subscription status
      const subscriptions = await stripe.subscriptions.list({
        customer: stripeCustomerId,
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

  const businessName = xmlEscape(settingsRow?.businessName || "us");
  const rawVoiceMsg = (settingsRow?.missedCallVoiceMessage || "Sorry we missed your call. Please leave a message after the tone and we will get back to you.").trim();
  const voiceMessage = xmlEscape(rawVoiceMsg);
  const hasRecording = !!(settingsRow?.voiceRecordingData && settingsRow?.voiceRecordingMimeType);
  const recordingUrl = hasRecording && settingsRow?.userId ? `${baseUrl}/api/voice-recording/${settingsRow.userId}` : null;
  const voicemailEnabled = settingsRow?.voicemailEnabled !== false;

  // Polly.Olivia-Neural is Australian English — natural and clear.
  // Falls back automatically to text-to-speech if no custom recording is stored.
  const greetingTwiml = recordingUrl
    ? `<Play>${recordingUrl}</Play>`
    : `<Say voice="Polly.Olivia-Neural">${voiceMessage}</Say>`;

  if (voicemailEnabled && missedCallId) {
    const recCb = `${baseUrl}/api/twilio/recording-callback?missedCallId=${encodeURIComponent(missedCallId)}`;
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${greetingTwiml}
  <Record action="${recCb}" method="POST" recordingStatusCallback="${recCb}" recordingStatusCallbackMethod="POST" maxLength="120" timeout="5" playBeep="true" finishOnKey="#" trim="trim-silence"/>
  <Say voice="Polly.Olivia-Neural">No message recorded. Goodbye.</Say>
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

/** Escape characters that would break TwiML XML */
function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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
