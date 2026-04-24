import twilio from "twilio";
import { db } from "./db";
import { leads, leadMessages, salesSettings } from "@shared/schema";
import { eq, sql as rawSql } from "drizzle-orm";
import { getUncachableStripeClient } from "./stripeClient";

const SALES_SETTINGS_ID = "sales-singleton";
export const STAGES = ["new", "qualified", "demo", "proposal", "closed"] as const;
export type Stage = typeof STAGES[number];

function normalizePhone(p: string | null | undefined): string {
  if (!p) return "";
  return p.replace(/[^\d+]/g, "").replace(/^(\d)/, "+$1").replace(/^\++/, "+");
}

export async function findLeadByPhone(phone: string) {
  const norm = normalizePhone(phone);
  if (!norm) return null;
  const rows = await db.select().from(leads);
  return rows.find(l => normalizePhone(l.phoneNumber) === norm) || null;
}

export async function getOrCreateSalesSettings() {
  const rows = await db.select().from(salesSettings).where(eq(salesSettings.id, SALES_SETTINGS_ID));
  if (rows[0]) return rows[0];
  const [created] = await db.insert(salesSettings).values({
    id: SALES_SETTINGS_ID,
    demoVideoUrl: process.env.DEMO_VIDEO_URL || "",
    calendlyUrl: process.env.CALENDLY_URL || "",
  }).returning();
  return created;
}

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID || "";
  const token = process.env.TWILIO_AUTH_TOKEN || "";
  const from = process.env.TWILIO_PHONE_NUMBER || "";
  if (!sid || !token || !from) {
    throw new Error("Twilio credentials missing (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER).");
  }
  return { client: twilio(sid, token), from };
}

export async function sendLeadSms(leadId: string, body: string): Promise<string | null> {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
  if (!lead) throw new Error("Lead not found");
  const { client, from } = getTwilioClient();
  const to = normalizePhone(lead.phoneNumber);
  const msg = await client.messages.create({ body, from, to });
  await db.insert(leadMessages).values({
    leadId,
    direction: "outbound",
    body,
    twilioSid: msg.sid,
  });
  await db.update(leads).set({ updatedAt: new Date() }).where(eq(leads.id, leadId));
  return msg.sid;
}

export async function appendInboundMessage(leadId: string, body: string, twilioSid: string | null) {
  await db.insert(leadMessages).values({ leadId, direction: "inbound", body, twilioSid });
  await db.update(leads).set({ updatedAt: new Date() }).where(eq(leads.id, leadId));
}

export async function buildIntroSms(leadId: string): Promise<string> {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
  if (!lead) throw new Error("Lead not found");
  const s = await getOrCreateSalesSettings();
  const tpl = s.introSmsTemplate || "Hi {{name}}, reply DEMO to see a quick walkthrough or YES to book a call.";
  return tpl.replace(/\{\{name\}\}/g, lead.name.split(" ")[0] || "there");
}

export async function createCheckoutSession(leadId: string, baseUrl: string): Promise<{ url: string; id: string }> {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
  if (!lead) throw new Error("Lead not found");
  const stripe = await getUncachableStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{
      price_data: {
        currency: "aud",
        product_data: { name: "TradieCatch Setup Fee" },
        unit_amount: 29900,
      },
      quantity: 1,
    }],
    customer_email: lead.email || undefined,
    success_url: `${baseUrl}/sales/${leadId}?paid=1`,
    cancel_url: `${baseUrl}/sales/${leadId}?paid=0`,
    metadata: { type: "sales_setup_fee", leadId },
    payment_intent_data: { metadata: { type: "sales_setup_fee", leadId } },
  });
  await db.update(leads).set({
    stripeSessionId: session.id,
    stripeCheckoutUrl: session.url || "",
    updatedAt: new Date(),
  }).where(eq(leads.id, leadId));
  return { url: session.url || "", id: session.id };
}

export async function markLeadPaid(leadId: string) {
  await db.update(leads).set({
    paid: true,
    paidAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(leads.id, leadId));
}

/**
 * Returns true if the inbound SMS was handled by the sales flow.
 *
 * Scoping rules (to avoid hijacking tradie SMS conversations):
 *   - The destination number `toPhone` MUST match `SALES_TWILIO_PHONE_NUMBER`
 *     (or, if not set, the global `TWILIO_PHONE_NUMBER`). If neither env var
 *     is configured, sales SMS handling is disabled entirely.
 *   - The sender phone MUST match a known lead.
 *
 * Returns false otherwise — caller should fall through to the tradie flow.
 */
export async function handleInboundLeadSms(fromPhone: string, toPhone: string, body: string, twilioSid: string | null): Promise<boolean> {
  const salesNumber = normalizePhone(process.env.SALES_TWILIO_PHONE_NUMBER || process.env.TWILIO_PHONE_NUMBER || "");
  if (!salesNumber) return false; // Sales line not configured → never handle.
  if (normalizePhone(toPhone) !== salesNumber) return false; // Inbound was for a tradie's number, not the sales line.

  const lead = await findLeadByPhone(fromPhone);
  if (!lead) return false;

  const text = (body || "").trim();
  await appendInboundMessage(lead.id, text, twilioSid);

  const lower = text.toLowerCase();
  const settings = await getOrCreateSalesSettings();

  // "demo" trigger
  if (/\bdemo\b/i.test(lower)) {
    const videoUrl = settings.demoVideoUrl?.trim();
    const reply = videoUrl
      ? `Awesome — here's the 60-sec walkthrough: ${videoUrl}\n\nWhen you're ready, reply YES to book a quick call and I'll send through a setup link.`
      : `Thanks! The demo link isn't configured yet — we'll text it through shortly.`;
    try {
      await sendLeadSms(lead.id, reply);
    } catch (err) {
      console.error("[sales] failed to send demo reply:", err);
    }
    if (lead.stage === "new" || lead.stage === "qualified") {
      await db.update(leads).set({ stage: "demo", updatedAt: new Date() }).where(eq(leads.id, lead.id));
    }
    return true;
  }

  // "yes" trigger
  if (/\byes\b/i.test(lower) || /\bbook\b/i.test(lower)) {
    const calendly = settings.calendlyUrl?.trim();
    const baseUrl = process.env.REPLIT_DOMAINS
      ? `https://${process.env.REPLIT_DOMAINS.split(",")[0].trim()}`
      : (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "");
    let checkoutUrl = "";
    try {
      const session = await createCheckoutSession(lead.id, baseUrl);
      checkoutUrl = session.url;
    } catch (err) {
      console.error("[sales] failed to create checkout:", err);
    }
    let reply = "Great! Two quick steps:\n\n";
    if (calendly) reply += `1) Pick a time that suits you: ${calendly}\n`;
    else reply += `1) We'll text you a booking link shortly.\n`;
    if (checkoutUrl) reply += `2) Lock in your spot with the $299 setup fee: ${checkoutUrl}`;
    else reply += `2) Setup link is being prepared, we'll send it over shortly.`;
    try {
      await sendLeadSms(lead.id, reply);
    } catch (err) {
      console.error("[sales] failed to send proposal reply:", err);
    }
    await db.update(leads).set({ stage: "proposal", updatedAt: new Date() }).where(eq(leads.id, lead.id));
    return true;
  }

  // Anything else — just record the message, no auto reply, but mark inbound activity.
  return true;
}

export async function attachCalendlyBooking(args: {
  email?: string | null;
  phone?: string | null;
  startTime: Date;
  eventUri: string;
}): Promise<{ leadId: string | null }> {
  const { email, phone, startTime, eventUri } = args;
  let lead: typeof leads.$inferSelect | undefined | null = null;
  if (phone) {
    lead = await findLeadByPhone(phone);
  }
  if (!lead && email) {
    const norm = email.toLowerCase().trim();
    const all = await db.select().from(leads);
    lead = all.find(l => (l.email || "").toLowerCase().trim() === norm) || null;
  }
  if (!lead) return { leadId: null };

  await db.update(leads).set({
    calendlyEventTime: startTime,
    calendlyEventUri: eventUri,
    updatedAt: new Date(),
  }).where(eq(leads.id, lead.id));
  return { leadId: lead.id };
}

export async function clearCalendlyBooking(eventUri: string): Promise<{ leadId: string | null }> {
  const all = await db.select().from(leads);
  const lead = all.find(l => l.calendlyEventUri === eventUri);
  if (!lead) return { leadId: null };
  await db.update(leads).set({
    calendlyEventTime: null,
    calendlyEventUri: null,
    updatedAt: new Date(),
  }).where(eq(leads.id, lead.id));
  return { leadId: lead.id };
}
