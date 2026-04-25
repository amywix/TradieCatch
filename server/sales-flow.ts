import twilio from "twilio";
import { db } from "./db";
import { leads, leadMessages, salesSettings } from "@shared/schema";
import type { Lead } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

// ─── Twilio helper ────────────────────────────────────────────────────────────

async function getSalesCredentials() {
  const rows = await db.select().from(salesSettings).where(eq(salesSettings.id, "singleton"));
  const row = rows[0];
  return {
    accountSid: row?.twilioAccountSid || process.env.TWILIO_ACCOUNT_SID || "",
    authToken: row?.twilioAuthToken || process.env.TWILIO_AUTH_TOKEN || "",
    fromNumber: row?.twilioPhoneNumber || process.env.TWILIO_PHONE_NUMBER || "",
    demoVideoUrl: row?.demoVideoUrl || "",
    calendlyUrl: row?.calendlyUrl || "",
    setupFeeAmount: row?.setupFeeAmount ?? 299,
  };
}

async function sendSms(to: string, body: string): Promise<string | null> {
  const creds = await getSalesCredentials();
  if (!creds.accountSid || !creds.authToken || !creds.fromNumber) {
    console.warn("Sales SMS: missing Twilio credentials");
    return null;
  }
  try {
    const client = twilio(creds.accountSid, creds.authToken);
    const msg = await client.messages.create({ to, from: creds.fromNumber, body });
    return msg.sid;
  } catch (err) {
    console.error("Sales SMS send error:", err);
    return null;
  }
}

// ─── Lead lookup ──────────────────────────────────────────────────────────────

export async function findLeadByPhone(phone: string): Promise<Lead | null> {
  const normalized = phone.replace(/\s+/g, "");
  const rows = await db.select().from(leads).where(eq(leads.phone, normalized)).orderBy(desc(leads.createdAt));
  return rows[0] ?? null;
}

// ─── Outbound SMS ─────────────────────────────────────────────────────────────

/**
 * Send the initial intro message to a lead and record it.
 * This kicks off the automated sales conversation.
 */
export async function sendIntroSms(leadId: string): Promise<void> {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
  if (!lead) throw new Error(`Lead ${leadId} not found`);

  const creds = await getSalesCredentials();
  const firstName = lead.name.split(" ")[0];

  const body =
    `Hi ${firstName} 👋 This is TradieCatch — the tool that automatically captures missed calls and books jobs for tradies.\n\n` +
    `Reply DEMO to see a 2-min video of how it works, or SKIP to opt out.`;

  const sid = await sendSms(lead.phone, body);

  await db.insert(leadMessages).values({
    leadId,
    direction: "outbound",
    body,
    twilioSid: sid ?? "",
  });

  // Move to qualified if still new
  if (lead.stage === "new") {
    await db.update(leads).set({ stage: "qualified", updatedAt: new Date() }).where(eq(leads.id, leadId));
  }
}

// ─── Inbound reply handler ────────────────────────────────────────────────────

/**
 * Called from the Twilio webhook when an inbound SMS arrives from a known lead.
 * Returns true if it was handled (caller is a lead), false if we should fall through.
 */
export async function handleSalesReply(fromPhone: string, toPhone: string, body: string): Promise<boolean> {
  const creds = await getSalesCredentials();

  // Only intercept if this message was sent TO the sales Twilio number
  const salesNumber = creds.fromNumber.replace(/\s+/g, "");
  const toNormalized = toPhone.replace(/\s+/g, "");
  if (salesNumber && toNormalized && salesNumber !== toNormalized) {
    return false;
  }

  const lead = await findLeadByPhone(fromPhone);
  if (!lead) return false;

  // Record inbound message
  await db.insert(leadMessages).values({
    leadId: lead.id,
    direction: "inbound",
    body,
    twilioSid: "",
  });

  const keyword = body.trim().toUpperCase();

  if (keyword === "DEMO") {
    const videoUrl = creds.demoVideoUrl || "https://tradiecatch.com/demo";
    const reply =
      `🎬 Here's your 2-min demo: ${videoUrl}\n\n` +
      `After watching, reply YES if you'd like to lock in your spot for a setup session.`;

    const sid = await sendSms(lead.phone, reply);
    await db.insert(leadMessages).values({ leadId: lead.id, direction: "outbound", body: reply, twilioSid: sid ?? "" });
    await db.update(leads).set({ stage: "demo", updatedAt: new Date() }).where(eq(leads.id, lead.id));
    return true;
  }

  if (keyword === "YES") {
    const calendlyUrl = creds.calendlyUrl || "https://calendly.com/tradiecatch";
    const amount = creds.setupFeeAmount;
    const reply =
      `Awesome! 🎉 Two quick steps to get you set up:\n\n` +
      `1️⃣ Book your setup session: ${calendlyUrl}\n\n` +
      `2️⃣ Lock in your spot (one-time $${amount} setup fee): your operator will send you the payment link shortly.\n\n` +
      `See you soon!`;

    const sid = await sendSms(lead.phone, reply);
    await db.insert(leadMessages).values({ leadId: lead.id, direction: "outbound", body: reply, twilioSid: sid ?? "" });
    await db.update(leads).set({ stage: "proposal", updatedAt: new Date() }).where(eq(leads.id, lead.id));
    return true;
  }

  if (keyword === "SKIP" || keyword === "STOP" || keyword === "UNSUBSCRIBE") {
    const reply = "No worries! You've been removed. Reach out any time if you change your mind.";
    const sid = await sendSms(lead.phone, reply);
    await db.insert(leadMessages).values({ leadId: lead.id, direction: "outbound", body: reply, twilioSid: sid ?? "" });
    await db.update(leads).set({ stage: "closed", outcome: "opted_out", updatedAt: new Date() }).where(eq(leads.id, lead.id));
    return true;
  }

  // Any other message — no auto-reply, but we've recorded it
  return true;
}

// ─── Operator-initiated send ──────────────────────────────────────────────────

export async function sendManualSms(leadId: string, body: string): Promise<void> {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
  if (!lead) throw new Error(`Lead ${leadId} not found`);

  const sid = await sendSms(lead.phone, body);
  await db.insert(leadMessages).values({ leadId, direction: "outbound", body, twilioSid: sid ?? "" });
  await db.update(leads).set({ updatedAt: new Date() }).where(eq(leads.id, leadId));
}

// ─── Bootstrap singleton settings row ────────────────────────────────────────

export async function ensureSalesSettingsRow(): Promise<void> {
  const rows = await db.select().from(salesSettings).where(eq(salesSettings.id, "singleton"));
  if (rows.length === 0) {
    await db.insert(salesSettings).values({
      id: "singleton",
      demoVideoUrl: "",
      calendlyUrl: "",
      twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || "",
      twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || "",
      twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || "",
      setupFeeAmount: 299,
    });
  }
}
