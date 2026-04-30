import twilio from "twilio";
import { db } from "./db";
import { eq, and, desc, sql as rawSql } from "drizzle-orm";
import {
  leads,
  leadMessages,
  salesSettings,
  users,
  settings,
  SALES_SETTINGS_ID,
  type Lead,
} from "@shared/schema";
import { getUncachableStripeClient } from "./stripeClient";

function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-()]/g, "");
}

function phoneMatchesAny(target: string, candidate: string): boolean {
  const a = normalizePhone(target).replace(/\D/g, "");
  const b = normalizePhone(candidate).replace(/\D/g, "");
  if (!a || !b) return false;
  if (a === b) return true;
  const n = Math.min(a.length, b.length, 9);
  return a.slice(-n) === b.slice(-n);
}

async function getOperator() {
  const [op] = await db.select().from(users).where(eq(users.isOperator, true));
  return op || null;
}

async function getOperatorTwilio() {
  const op = await getOperator();
  if (!op) return null;
  const [s] = await db.select().from(settings).where(eq(settings.userId, op.id));
  const sid = s?.twilioAccountSid || process.env.TWILIO_ACCOUNT_SID || "";
  const token = s?.twilioAuthToken || process.env.TWILIO_AUTH_TOKEN || "";
  const phone = s?.twilioPhoneNumber || process.env.TWILIO_PHONE_NUMBER || "";
  if (!sid || !token || !phone) return null;
  return { sid, token, phone, operatorUserId: op.id };
}

export async function operatorOwnsTwilioNumber(toPhone: string): Promise<boolean> {
  const op = await getOperator();
  if (!op) return false;
  const [s] = await db.select().from(settings).where(eq(settings.userId, op.id));
  const opPhone = s?.twilioPhoneNumber || process.env.TWILIO_PHONE_NUMBER || "";
  if (!opPhone) return false;
  return phoneMatchesAny(opPhone, toPhone);
}

export async function getSalesSettingsRow() {
  const [row] = await db.select().from(salesSettings).where(eq(salesSettings.id, SALES_SETTINGS_ID));
  if (row) return row;
  const [created] = await db.insert(salesSettings).values({ id: SALES_SETTINGS_ID }).returning();
  return created;
}

export async function findLeadByPhone(phone: string): Promise<Lead | null> {
  const all = await db.select().from(leads);
  const match = all.find(l => phoneMatchesAny(l.phone, phone));
  return match || null;
}

export async function sendLeadSms(leadId: string, body: string): Promise<void> {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
  if (!lead) throw new Error("Lead not found");

  const cfg = await getOperatorTwilio();
  if (!cfg) throw new Error("Operator Twilio not configured. Set Twilio creds on the admin@tradiecatch.com account.");

  const client = twilio(cfg.sid, cfg.token);
  const msg = await client.messages.create({
    body,
    from: cfg.phone,
    to: lead.phone,
  });

  await db.insert(leadMessages).values({
    leadId,
    direction: "outbound",
    body,
    twilioSid: msg.sid,
  });
  await db.update(leads).set({ updatedAt: new Date() }).where(eq(leads.id, leadId));
}

export async function recordInboundLeadMessage(leadId: string, body: string, twilioSid: string | null) {
  await db.insert(leadMessages).values({
    leadId,
    direction: "inbound",
    body,
    twilioSid,
  });
  await db.update(leads).set({ updatedAt: new Date() }).where(eq(leads.id, leadId));
}

function buildIntroMessage(lead: Lead, businessName: string | null): string {
  const first = (lead.name || "there").split(" ")[0];
  const sender = businessName || "TradieCatch";
  return `Hi ${first}, it's the team from ${sender}. We help electricians like you stop missing jobs from missed calls — auto-reply by SMS, book the job, no admin.\n\nReply DEMO to see how it works (60-second video), or STOP to opt out.`;
}

function buildDemoMessage(lead: Lead, settings: { demoVideoUrl: string | null }): string {
  const url = settings.demoVideoUrl || "(demo video URL not configured)";
  return `Here's the 60-second demo: ${url}\n\nIf you'd like to book a 10-min setup call and get started, reply YES.`;
}

function buildBookAndPayMessage(
  lead: Lead,
  settings: { calendlyUrl: string | null; setupFeeAmountCents: number | null },
  checkoutUrl: string | null,
): string {
  const cal = settings.calendlyUrl || "(Calendly link not configured)";
  const dollars = ((settings.setupFeeAmountCents ?? 29900) / 100).toFixed(0);
  const pay = checkoutUrl ? `\n\n2) Pay the $${dollars} setup fee here: ${checkoutUrl}` : `\n\n2) (Stripe checkout will be sent shortly.)`;
  return `Awesome! Two quick steps:\n\n1) Pick a setup call time: ${cal}${pay}\n\nSee you on the call!`;
}

export async function sendIntroSmsToLead(leadId: string): Promise<void> {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
  if (!lead) throw new Error("Lead not found");
  const op = await getOperator();
  let businessName: string | null = null;
  if (op) {
    const [s] = await db.select().from(settings).where(eq(settings.userId, op.id));
    businessName = s?.businessName?.trim() || null;
  }
  const body = buildIntroMessage(lead, businessName);
  await sendLeadSms(leadId, body);
}

export async function createSetupFeeCheckout(leadId: string, baseUrl: string): Promise<string> {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
  if (!lead) throw new Error("Lead not found");
  const cfg = await getSalesSettingsRow();
  const stripe = await getUncachableStripeClient();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [{
      price_data: {
        currency: "aud",
        product_data: { name: cfg.setupFeeProductName || "TradieCatch Setup Fee" },
        unit_amount: cfg.setupFeeAmountCents ?? 29900,
      },
      quantity: 1,
    }],
    success_url: `${baseUrl}/sales/${leadId}?paid=1`,
    cancel_url: `${baseUrl}/sales/${leadId}?paid=0`,
    customer_email: lead.email && lead.email.includes("@") ? lead.email : undefined,
    metadata: {
      type: "sales_setup_fee",
      leadId,
    },
  });

  await db.update(leads)
    .set({ stripeSessionId: session.id, updatedAt: new Date() })
    .where(eq(leads.id, leadId));

  return session.url || "";
}

/**
 * Try to handle an inbound SMS as part of the sales flow.
 * Returns true if handled (caller should NOT fall through to TradieCatch flow).
 */
export async function tryHandleSalesInbound(fromPhone: string, body: string, toPhone: string): Promise<boolean> {
  // Only treat as sales if the destination is the operator's Twilio number
  const isOperatorNumber = await operatorOwnsTwilioNumber(toPhone);
  if (!isOperatorNumber) return false;

  const lead = await findLeadByPhone(fromPhone);
  if (!lead) return false;

  // Always log inbound
  await recordInboundLeadMessage(lead.id, body, null);

  const text = body.trim().toLowerCase();
  const cfg = await getSalesSettingsRow();

  // STOP — do not auto-respond, just record
  if (/^(stop|unsubscribe|stopall|quit|cancel)\b/i.test(text)) {
    await db.update(leads).set({ stage: "closed", outcome: "lost", updatedAt: new Date() })
      .where(eq(leads.id, lead.id));
    return true;
  }

  // DEMO — send demo video, advance stage to qualified
  if (/^demo\b/i.test(text) || text === "demo") {
    const reply = buildDemoMessage(lead, { demoVideoUrl: cfg.demoVideoUrl });
    await sendLeadSms(lead.id, reply);
    if (lead.stage === "new") {
      await db.update(leads).set({ stage: "qualified", updatedAt: new Date() }).where(eq(leads.id, lead.id));
    }
    return true;
  }

  // YES — send Calendly + Stripe, advance to demo stage
  if (/^(yes|y|sure|ok|okay|yep|yeah|sounds good)\b/i.test(text)) {
    let checkoutUrl: string | null = null;
    try {
      const baseUrl = process.env.PUBLIC_BASE_URL || `https://${(process.env.REPLIT_DOMAINS || "").split(",")[0]}`;
      checkoutUrl = await createSetupFeeCheckout(lead.id, baseUrl);
    } catch (err) {
      console.error("Sales: Stripe checkout creation failed:", err);
    }
    const reply = buildBookAndPayMessage(
      lead,
      { calendlyUrl: cfg.calendlyUrl, setupFeeAmountCents: cfg.setupFeeAmountCents },
      checkoutUrl,
    );
    await sendLeadSms(lead.id, reply);
    if (lead.stage === "new" || lead.stage === "qualified") {
      await db.update(leads).set({ stage: "demo", updatedAt: new Date() }).where(eq(leads.id, lead.id));
    }
    return true;
  }

  // Unrecognised inbound — leave for the operator to read and respond manually
  return true;
}

/**
 * Handle Stripe checkout.session.completed events whose metadata indicates the sales setup fee.
 */
export async function markLeadPaidFromCheckoutSession(session: any): Promise<void> {
  if (!session) return;
  const meta = session.metadata || {};
  if (meta.type !== "sales_setup_fee") return;
  const leadId = meta.leadId;
  if (!leadId) return;

  await db.update(leads)
    .set({ paid: true, stripeSessionId: session.id, updatedAt: new Date() })
    .where(eq(leads.id, leadId));
  console.log(`Sales: marked lead ${leadId} as paid (Stripe session ${session.id})`);
}

/**
 * Handle a Calendly invitee.created webhook — find the lead by phone/email and stamp the booked time.
 */
export async function handleSalesCalendlyEvent(payload: any): Promise<{ matched: boolean; leadId: string | null }> {
  const inviteeEmail: string = payload?.email || payload?.invitee?.email || "";
  const startTimeRaw: string = payload?.scheduled_event?.start_time || payload?.event?.start_time || "";
  const eventUri: string = payload?.scheduled_event?.uri || payload?.event?.uri || "";
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

  let lead: Lead | null = null;
  if (invPhone) lead = await findLeadByPhone(invPhone);
  if (!lead && inviteeEmail) {
    const all = await db.select().from(leads);
    lead = all.find(l => (l.email || "").toLowerCase() === inviteeEmail.toLowerCase()) || null;
  }
  // Last-resort: most recent lead in 'demo' stage updated within 24h
  if (!lead) {
    const all = await db.select().from(leads).orderBy(desc(leads.updatedAt));
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    lead = all.find(l => l.stage === "demo" && new Date(l.updatedAt as any).getTime() > cutoff) || null;
  }

  if (!lead) return { matched: false, leadId: null };

  const eventTime = startTimeRaw ? new Date(startTimeRaw) : null;
  await db.update(leads).set({
    calendlyEventTime: eventTime,
    calendlyEventUri: eventUri || null,
    stage: lead.stage === "new" || lead.stage === "qualified" ? "demo" : lead.stage,
    updatedAt: new Date(),
  }).where(eq(leads.id, lead.id));

  // Confirmation SMS
  try {
    let timeLabel = "";
    if (eventTime) {
      timeLabel = eventTime.toLocaleString("en-AU", {
        weekday: "short", day: "numeric", month: "short",
        hour: "numeric", minute: "2-digit", hour12: true,
        timeZone: "Australia/Sydney",
      });
    }
    const first = (lead.name || "there").split(" ")[0];
    await sendLeadSms(
      lead.id,
      `Booked in, ${first}! ${timeLabel ? `\n\nWe'll see you ${timeLabel}.` : ""}\n\nIf the setup fee hasn't been paid yet, you can do that from the link we sent earlier — once it's paid we're locked in.`,
    );
  } catch (err) {
    console.error("Calendly confirmation SMS failed:", err);
  }

  return { matched: true, leadId: lead.id };
}
