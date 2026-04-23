var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  DEFAULT_SERVICES: () => DEFAULT_SERVICES,
  insertUserSchema: () => insertUserSchema,
  jobs: () => jobs,
  missedCalls: () => missedCalls,
  settings: () => settings,
  smsTemplates: () => smsTemplates,
  users: () => users
});
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var users, missedCalls, jobs, smsTemplates, DEFAULT_SERVICES, settings, insertUserSchema;
var init_schema = __esm({
  "shared/schema.ts"() {
    "use strict";
    users = pgTable("users", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      username: text("username").notNull().unique(),
      password: text("password").notNull(),
      email: text("email").notNull().unique(),
      stripeCustomerId: text("stripe_customer_id"),
      stripeSubscriptionId: text("stripe_subscription_id"),
      pushToken: text("push_token"),
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    missedCalls = pgTable("missed_calls", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").notNull(),
      callerName: text("caller_name").notNull().default("Unknown Caller"),
      phoneNumber: text("phone_number").notNull(),
      timestamp: timestamp("timestamp").defaultNow().notNull(),
      replied: boolean("replied").default(false).notNull(),
      repliedAt: timestamp("replied_at"),
      jobBooked: boolean("job_booked").default(false).notNull(),
      conversationState: text("conversation_state").default("none").notNull(),
      selectedService: text("selected_service"),
      selectedSubOption: text("selected_sub_option"),
      selectedTime: text("selected_time"),
      jobAddress: text("job_address"),
      isUrgent: boolean("is_urgent").default(false),
      callerEmail: text("caller_email"),
      conversationLog: jsonb("conversation_log").$type().default([]),
      voicemailData: text("voicemail_data"),
      voicemailMimeType: text("voicemail_mime_type"),
      voicemailDurationSeconds: text("voicemail_duration_seconds")
    });
    jobs = pgTable("jobs", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").notNull(),
      callerName: text("caller_name").notNull(),
      phoneNumber: text("phone_number").notNull(),
      jobType: text("job_type").notNull(),
      date: text("date"),
      time: text("time"),
      address: text("address"),
      notes: text("notes"),
      email: text("email"),
      status: text("status").default("pending").notNull(),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      missedCallId: varchar("missed_call_id"),
      isUrgent: boolean("is_urgent").default(false)
    });
    smsTemplates = pgTable("sms_templates", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").notNull(),
      name: text("name").notNull(),
      message: text("message").notNull(),
      isDefault: boolean("is_default").default(false).notNull()
    });
    DEFAULT_SERVICES = [
      "Power point install / repair",
      "Ceiling fan install",
      "Lights not working",
      "Switchboard issue",
      "Power outage / urgent fault",
      "Smoke alarm install",
      "Other"
    ];
    settings = pgTable("settings", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").notNull().unique(),
      businessName: text("business_name").default("").notNull(),
      autoReplyEnabled: boolean("auto_reply_enabled").default(true).notNull(),
      onboardingComplete: boolean("onboarding_complete").default(false).notNull(),
      twilioAccountSid: text("twilio_account_sid").default(""),
      twilioAuthToken: text("twilio_auth_token").default(""),
      twilioPhoneNumber: text("twilio_phone_number").default(""),
      missedCallVoiceMessage: text("missed_call_voice_message").default("Sorry we missed your call. We will SMS you now to follow up."),
      voiceRecordingData: text("voice_recording_data"),
      voiceRecordingMimeType: text("voice_recording_mime_type"),
      services: jsonb("services").$type().default(DEFAULT_SERVICES),
      bookingCalendarEnabled: boolean("booking_calendar_enabled").default(false).notNull(),
      bookingSlots: jsonb("booking_slots").$type().default([
        "8:00 AM",
        "9:00 AM",
        "10:00 AM",
        "11:00 AM",
        "12:00 PM",
        "1:00 PM",
        "2:00 PM",
        "3:00 PM",
        "4:00 PM"
      ]),
      bookingDates: jsonb("booking_dates").$type().default([]),
      tradieMobileNumber: text("tradie_mobile_number").default(""),
      forwardingMode: text("forwarding_mode").default("carrier_forward").notNull(),
      voicemailEnabled: boolean("voicemail_enabled").default(true).notNull()
    });
    insertUserSchema = createInsertSchema(users).pick({
      username: true,
      password: true,
      email: true
    });
  }
});

// server/db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
var pool, db;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set");
    }
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL
    });
    db = drizzle(pool, { schema: schema_exports });
  }
});

// server/push.ts
import { eq } from "drizzle-orm";
async function sendPushToUser(userId, title, body, data = {}) {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user || !user.pushToken) {
      console.log(`Push: no token for user ${userId}, skipping`);
      return;
    }
    const message = {
      to: user.pushToken,
      sound: "default",
      title,
      body,
      data,
      priority: "high"
    };
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(message)
    });
    const result = await res.json();
    if (result?.data?.status === "error") {
      console.error("Push error:", result.data);
      if (result.data.details?.error === "DeviceNotRegistered" || result.data.details?.error === "InvalidCredentials") {
        await db.update(users).set({ pushToken: null }).where(eq(users.id, userId));
      }
    } else {
      console.log(`Push sent to user ${userId}: ${title}`);
    }
  } catch (err) {
    console.error("Failed to send push:", err);
  }
}
var EXPO_PUSH_URL;
var init_push = __esm({
  "server/push.ts"() {
    "use strict";
    init_db();
    init_schema();
    EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
  }
});

// server/sms-conversation.ts
var sms_conversation_exports = {};
__export(sms_conversation_exports, {
  handleDemoSmsFlow: () => handleDemoSmsFlow,
  handleIncomingReply: () => handleIncomingReply,
  sendInitialMissedCallSms: () => sendInitialMissedCallSms,
  sendSms: () => sendSms
});
import twilio from "twilio";
import { eq as eq2, and, desc } from "drizzle-orm";
async function getSettingsForUser(userId) {
  const rows = await db.select().from(settings).where(eq2(settings.userId, userId));
  return rows[0];
}
async function getServices(userId) {
  const s = await getSettingsForUser(userId);
  return s?.services || DEFAULT_SERVICES;
}
async function getBookingConfig(userId) {
  const s = await getSettingsForUser(userId);
  return {
    enabled: s?.bookingCalendarEnabled ?? false,
    slots: s?.bookingSlots || ["8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM"],
    dates: s?.bookingDates || []
  };
}
function resolveBookingDates(customDates) {
  if (customDates.length > 0) {
    return customDates.map((label) => ({ label, dateStr: "" }));
  }
  return getNextAvailableDates(5);
}
function getNextAvailableDates(count = 5) {
  const dates = [];
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const now = /* @__PURE__ */ new Date();
  let d = new Date(now);
  d.setDate(d.getDate() + 1);
  while (dates.length < count) {
    if (d.getDay() !== 0) {
      dates.push({
        label: `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`,
        dateStr: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      });
    }
    d.setDate(d.getDate() + 1);
  }
  return dates;
}
function buildServicesMap(servicesList) {
  const map = {};
  servicesList.forEach((s, i) => {
    map[String(i + 1)] = s;
  });
  return map;
}
function buildServicesMenuText(servicesList) {
  return servicesList.map((s, i) => {
    const label = s.toLowerCase() === "other" ? `${i + 1}. Other (type your issue)` : `${i + 1}. ${s}`;
    return label;
  }).join("\n");
}
async function getTwilioConfig(userId) {
  const s = await getSettingsForUser(userId);
  const sid = s?.twilioAccountSid || process.env.TWILIO_ACCOUNT_SID || "";
  const token = s?.twilioAuthToken || process.env.TWILIO_AUTH_TOKEN || "";
  const phone = s?.twilioPhoneNumber || process.env.TWILIO_PHONE_NUMBER || "";
  return { sid, token, phone, businessName: s?.businessName || "" };
}
function addLogEntry(log2, role, message) {
  log2.push({ role, message, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  return log2;
}
async function sendSms(to, body, userId) {
  const { sid, token, phone } = await getTwilioConfig(userId);
  if (!sid || !token || !phone) {
    throw new Error("Twilio credentials not configured. Please set them up in Settings.");
  }
  const client = twilio(sid, token);
  try {
    await client.messages.create({
      body,
      from: phone,
      to
    });
    console.log(`SMS sent to ${to}: ${body.substring(0, 50)}...`);
  } catch (err) {
    console.error("Failed to send SMS:", err);
    throw err;
  }
}
async function sendInitialMissedCallSms(callId, userId) {
  const rows = await db.select().from(missedCalls).where(eq2(missedCalls.id, callId));
  const call = rows[0];
  if (!call) throw new Error("Call not found");
  const { businessName } = await getTwilioConfig(userId);
  const servicesList = await getServices(userId);
  const menuText = buildServicesMenuText(servicesList);
  const businessLine = businessName ? `
This is ${businessName}.` : "";
  const message = `Hi! Sorry we missed your call!${businessLine}

Can we grab your name to get started?`;
  await sendSms(call.phoneNumber, message, userId);
  let log2 = call.conversationLog || [];
  addLogEntry(log2, "business", message);
  await db.update(missedCalls).set({
    replied: true,
    repliedAt: /* @__PURE__ */ new Date(),
    conversationState: "awaiting_name",
    conversationLog: log2
  }).where(eq2(missedCalls.id, callId));
}
async function findUsersByTwilioNumber(toPhone) {
  const allSettings = await db.select().from(settings);
  const userIds = [];
  for (const s of allSettings) {
    const twilioNum = s.twilioPhoneNumber || "";
    if (twilioNum && phonesMatch(twilioNum, toPhone)) {
      userIds.push(s.userId);
    }
  }
  return userIds;
}
async function handleDemoTrigger(fromPhone, userId) {
  const { businessName } = await getTwilioConfig(userId);
  const bizLine = businessName ? `from ${businessName}` : "";
  const message = `Thanks for your interest! \u{1F64C}

This is the same kind of experience your customers will have when they miss a call from you.

\u{1F3AC} Watch the quick demo: ${DEMO_VIDEO_URL}

Then reply YES if you'd like to book a 10-minute call to answer any questions and get you set up.`;
  await sendSms(fromPhone, message, userId);
  const log2 = [{ role: "business", message, timestamp: (/* @__PURE__ */ new Date()).toISOString() }];
  await db.insert(missedCalls).values({
    userId,
    callerName: "Demo Lead",
    phoneNumber: normalizePhone(fromPhone),
    replied: true,
    repliedAt: /* @__PURE__ */ new Date(),
    conversationState: "demo_offer_sent",
    conversationLog: log2,
    selectedService: "TradieCatch Setup"
  });
  return message;
}
async function handleIncomingReply(fromPhone, body, toPhone) {
  const normalizedPhone = normalizePhone(fromPhone);
  let userIds = [];
  if (toPhone) {
    userIds = await findUsersByTwilioNumber(toPhone);
  }
  let rows = [];
  if (userIds.length > 0) {
    for (const uid of userIds) {
      const userRows = await db.select().from(missedCalls).where(and(eq2(missedCalls.userId, uid), eq2(missedCalls.phoneNumber, normalizedPhone))).orderBy(desc(missedCalls.timestamp));
      rows = rows.concat(userRows);
    }
    if (rows.length === 0) {
      for (const uid of userIds) {
        const allCalls = await db.select().from(missedCalls).where(eq2(missedCalls.userId, uid));
        const matched = allCalls.filter((c) => phonesMatch(c.phoneNumber, normalizedPhone));
        rows = rows.concat(matched);
      }
    }
  }
  if (rows.length === 0) {
    const allCalls = await db.select().from(missedCalls);
    rows = allCalls.filter((c) => phonesMatch(c.phoneNumber, normalizedPhone));
  }
  rows.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const TERMINAL_STATES = /* @__PURE__ */ new Set(["none", "completed", "demo_completed"]);
  const activeCalls = rows.filter((c) => !TERMINAL_STATES.has(c.conversationState));
  let call = activeCalls.length > 0 ? activeCalls[0] : null;
  if (!call) {
    const allByPhone = rows.filter((c) => c.replied);
    if (allByPhone.length > 0) {
      call = allByPhone[0];
    }
  }
  if (!call) {
    console.log(`No matching call found for phone: "${fromPhone}" (normalized: "${normalizedPhone}")`);
    return null;
  }
  const callUserId = call.userId;
  const reply = body.trim();
  let log2 = call.conversationLog || [];
  addLogEntry(log2, "customer", reply);
  const state = call.conversationState;
  let response = "";
  let newState = state;
  let updates = {};
  const servicesList = await getServices(callUserId);
  const SERVICES = buildServicesMap(servicesList);
  const maxChoice = servicesList.length;
  const choiceRegex = new RegExp(`[^1-${maxChoice}]`, "g");
  switch (state) {
    case "awaiting_name": {
      updates.callerName = reply;
      const menuText = buildServicesMenuText(servicesList);
      response = `Thanks ${reply}! What can we help you with today?

Reply with the number below:

${menuText}`;
      newState = "awaiting_service";
      break;
    }
    case "awaiting_service": {
      const choice = reply.replace(choiceRegex, "");
      if (choice && SERVICES[choice]) {
        const service = SERVICES[choice];
        updates.selectedService = service;
        const serviceLower = service.toLowerCase();
        if (serviceLower.includes("urgent") || serviceLower.includes("emergency") || serviceLower.includes("power outage")) {
          response = `Thanks for letting us know.
Is this an emergency right now?

Reply YES if urgent or NO if it can wait.

If urgent, we'll prioritise your job immediately.`;
          newState = "awaiting_urgency";
        } else if (serviceLower === "other") {
          response = `No worries! Please type a brief description of what you need help with and we'll get back to you.`;
          newState = "awaiting_other_description";
        } else {
          response = `Great! ${service}.

What's the address for the job?`;
          newState = "awaiting_address";
        }
      } else {
        const menuText = buildServicesMenuText(servicesList);
        response = `Sorry, I didn't catch that. Please reply with a number from 1-${maxChoice}:

${menuText}`;
        newState = "awaiting_service";
      }
      break;
    }
    case "awaiting_sub_option": {
      const option = reply.toUpperCase().replace(/[^AB]/g, "");
      if (option === "A" || option === "B") {
        const subDesc = option === "A" ? "New install (no existing fan)" : "Replacement of old fan";
        updates.selectedSubOption = subDesc;
        response = `Perfect! ${subDesc}.

What's the address for the job?`;
        newState = "awaiting_address";
      } else {
        response = `Please reply A or B:

A) New install (no existing fan)
B) Replacement of old fan`;
        newState = "awaiting_sub_option";
      }
      break;
    }
    case "awaiting_urgency": {
      const upper = reply.toUpperCase();
      if (upper.includes("YES") || upper.includes("URGENT") || upper.includes("ASAP")) {
        updates.isUrgent = true;
        response = `We're treating this as urgent. Our team will call you ASAP.

What's the address so we can head your way?`;
        newState = "awaiting_address";
      } else if (upper.includes("NO") || upper.includes("WAIT") || upper.includes("LATER")) {
        updates.isUrgent = false;
        response = `No worries, we'll schedule you in.

What's the address for the job?`;
        newState = "awaiting_address";
      } else {
        response = `Please reply YES if this is urgent, or NO if it can wait.`;
        newState = "awaiting_urgency";
      }
      break;
    }
    case "awaiting_other_description": {
      updates.selectedService = `Other: ${reply}`;
      response = `Got it!

What's the address for the job?`;
      newState = "awaiting_address";
      break;
    }
    case "awaiting_address": {
      updates.jobAddress = reply;
      response = `Almost done! What's the best email address to send confirmation and updates to?`;
      newState = "awaiting_email";
      break;
    }
    case "awaiting_email": {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRegex.test(reply)) {
        updates.callerEmail = reply.toLowerCase();
        const booking = await getBookingConfig(callUserId);
        if (booking.enabled) {
          const dates = resolveBookingDates(booking.dates);
          const dateMenu = dates.map((d, i) => `${i + 1}. ${d.label}`).join("\n");
          response = `Thanks! What day works best for you?

${dateMenu}`;
          newState = "awaiting_booking_date";
        } else {
          response = `Thanks! And what's the best time:
1. Morning
2. Afternoon
3. ASAP`;
          newState = "awaiting_time";
        }
      } else {
        response = `That doesn't look like a valid email. Could you double-check and send it again?`;
        newState = "awaiting_email";
      }
      break;
    }
    case "awaiting_booking_date": {
      const booking = await getBookingConfig(callUserId);
      const dates = resolveBookingDates(booking.dates);
      const maxDate = dates.length;
      const dateChoice = reply.replace(new RegExp(`[^1-${maxDate}]`, "g"), "");
      const idx = parseInt(dateChoice, 10) - 1;
      if (idx >= 0 && idx < dates.length) {
        updates.selectedTime = dates[idx].label;
        const slotMenu = booking.slots.map((s, i) => `${i + 1}. ${s}`).join("\n");
        response = `Great, ${dates[idx].label}!

What time suits you?

${slotMenu}`;
        newState = "awaiting_booking_slot";
      } else {
        const dateMenu = dates.map((d, i) => `${i + 1}. ${d.label}`).join("\n");
        response = `Please reply with a number from 1-${dates.length}:

${dateMenu}`;
        newState = "awaiting_booking_date";
      }
      break;
    }
    case "awaiting_booking_slot": {
      const booking = await getBookingConfig(callUserId);
      const slotIdx = parseInt(reply.replace(/[^0-9]/g, ""), 10) - 1;
      if (slotIdx >= 0 && slotIdx < booking.slots.length) {
        const timeSlot = booking.slots[slotIdx];
        const dateLabel = call.selectedTime || updates.selectedTime || "";
        const dates = getNextAvailableDates(5);
        const matchedDate = dates.find((d) => d.label === dateLabel);
        const dateStr = matchedDate?.dateStr || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
        updates.selectedTime = `${dateLabel} ${timeSlot}`;
        const { businessName } = await getTwilioConfig(callUserId);
        response = `Booked! ${dateLabel} at ${timeSlot}.

We've confirmed your appointment.${call.isUrgent || updates.isUrgent ? "\n\nMarked as urgent - we'll prioritise this." : ""}

- ${businessName}`;
        newState = "completed";
        await db.insert(jobs).values({
          userId: callUserId,
          callerName: call.callerName || updates.callerName,
          phoneNumber: call.phoneNumber,
          jobType: call.selectedService || updates.selectedService || "General",
          date: dateStr,
          time: timeSlot,
          address: call.jobAddress || updates.jobAddress || "",
          notes: call.selectedSubOption || updates.selectedSubOption || "",
          email: call.callerEmail || updates.callerEmail || null,
          status: "confirmed",
          missedCallId: call.id,
          isUrgent: call.isUrgent || updates.isUrgent || false
        });
        const jobName = call.callerName || updates.callerName || "New customer";
        const jobService = call.selectedService || updates.selectedService || "Job";
        sendPushToUser(
          callUserId,
          `${call.isUrgent || updates.isUrgent ? "\u{1F6A8} Urgent: " : "\u{1F4C5} "}New job booked`,
          `${jobName} \u2014 ${jobService} on ${dateLabel} at ${timeSlot}`,
          { type: "job_booked", missedCallId: call.id }
        );
        updates.jobBooked = true;
      } else {
        const slotMenu = booking.slots.map((s, i) => `${i + 1}. ${s}`).join("\n");
        response = `Please reply with a number from 1-${booking.slots.length}:

${slotMenu}`;
        newState = "awaiting_booking_slot";
      }
      break;
    }
    case "awaiting_time": {
      const timeChoice = reply.replace(/[^1-3]/g, "");
      let timeLabel = "";
      if (timeChoice === "1") timeLabel = "Morning";
      else if (timeChoice === "2") timeLabel = "Afternoon";
      else if (timeChoice === "3" || reply.toUpperCase().includes("ASAP")) timeLabel = "ASAP";
      else if (reply.toUpperCase().includes("MORN")) timeLabel = "Morning";
      else if (reply.toUpperCase().includes("AFTER")) timeLabel = "Afternoon";
      else timeLabel = reply;
      updates.selectedTime = timeLabel;
      const { businessName } = await getTwilioConfig(callUserId);
      response = `Thanks! We've received your request.

Our team will confirm your booking shortly.${call.isUrgent || updates.isUrgent ? "\n\nIf urgent, we'll call you ASAP." : ""}

- ${businessName}`;
      newState = "completed";
      const today = /* @__PURE__ */ new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      await db.insert(jobs).values({
        userId: callUserId,
        callerName: call.callerName || updates.callerName,
        phoneNumber: call.phoneNumber,
        jobType: call.selectedService || updates.selectedService || "General",
        date: dateStr,
        time: timeLabel,
        address: call.jobAddress || updates.jobAddress || "",
        notes: call.selectedSubOption || updates.selectedSubOption || "",
        email: call.callerEmail || updates.callerEmail || null,
        status: call.isUrgent || updates.isUrgent ? "confirmed" : "pending",
        missedCallId: call.id,
        isUrgent: call.isUrgent || updates.isUrgent || false
      });
      const jobName2 = call.callerName || updates.callerName || "New customer";
      const jobService2 = call.selectedService || updates.selectedService || "Job";
      sendPushToUser(
        callUserId,
        `${call.isUrgent || updates.isUrgent ? "\u{1F6A8} Urgent: " : "\u{1F4C5} "}New job booked`,
        `${jobName2} \u2014 ${jobService2} (${timeLabel})`,
        { type: "job_booked", missedCallId: call.id }
      );
      updates.jobBooked = true;
      break;
    }
    case "completed": {
      const { businessName } = await getTwilioConfig(callUserId);
      response = `Thanks for your message! Your booking is already logged. Our team will be in touch shortly.

- ${businessName}`;
      newState = "completed";
      break;
    }
    // ── Demo / lead generation flow ──────────────────────────────────────────
    case "demo_offer_sent": {
      const upper = reply.toUpperCase();
      if (upper.includes("YES")) {
        response = `Awesome! \u{1F389}

Grab a 10-minute slot that suits you here:

\u{1F4C5} ${CALENDLY_BOOKING_URL}

Once you've booked I'll send you a confirmation. Talk soon!`;
        newState = "demo_awaiting_calendly";
      } else if (body.trim().toLowerCase().includes("demo")) {
        response = `Here's the demo again \u{1F3AC}
${DEMO_VIDEO_URL}

Reply YES to grab a 10-minute call and I'll send you the booking link.`;
        newState = "demo_offer_sent";
      } else {
        response = `No worries at all! If you change your mind, just reply YES anytime and I'll send through the booking link. \u{1F60A}`;
        newState = "demo_completed";
      }
      break;
    }
    case "demo_awaiting_calendly": {
      const upper = reply.toUpperCase();
      if (upper.includes("YES") || body.trim().toLowerCase().includes("link")) {
        response = `Here's the booking link again:

\u{1F4C5} ${CALENDLY_BOOKING_URL}`;
        newState = "demo_awaiting_calendly";
      } else if (body.trim().toLowerCase().includes("demo")) {
        response = `Here's the demo again \u{1F3AC}
${DEMO_VIDEO_URL}

And the booking link: \u{1F4C5} ${CALENDLY_BOOKING_URL}`;
        newState = "demo_awaiting_calendly";
      } else {
        response = `No problem! When you're ready, here's the link to book your 10-minute call:

\u{1F4C5} ${CALENDLY_BOOKING_URL}`;
        newState = "demo_awaiting_calendly";
      }
      break;
    }
    case "demo_awaiting_date": {
      const bookingCfg = await getBookingConfig(callUserId);
      const dates = resolveBookingDates(bookingCfg.dates);
      const maxIdx = dates.length;
      const dateChoice = reply.replace(new RegExp(`[^1-${maxIdx}]`, "g"), "");
      const idx = parseInt(dateChoice, 10) - 1;
      if (idx >= 0 && idx < dates.length) {
        updates.selectedTime = dates[idx].label;
        const timeMenu = DEMO_CALL_TIMES.map((t, i) => `${i + 1}. ${t}`).join("\n");
        response = `${dates[idx].label} works great!

What time suits you for the 10-minute call?

${timeMenu}`;
        newState = "demo_awaiting_time";
      } else {
        const dateMenu = dates.map((d, i) => `${i + 1}. ${d.label}`).join("\n");
        response = `Please reply with a number:

${dateMenu}`;
        newState = "demo_awaiting_date";
      }
      break;
    }
    case "demo_awaiting_time": {
      const timeIdx = parseInt(reply.replace(/[^0-9]/g, ""), 10) - 1;
      if (timeIdx >= 0 && timeIdx < DEMO_CALL_TIMES.length) {
        const timeSlot = DEMO_CALL_TIMES[timeIdx];
        const dateLabel = call.selectedTime || updates.selectedTime || "";
        updates.selectedTime = `${dateLabel} ${timeSlot}`;
        const { businessName } = await getTwilioConfig(callUserId);
        response = `All booked! \u{1F389}

Your free 10-minute TradieCatch setup call is confirmed for:
\u{1F4C5} ${dateLabel} at ${timeSlot}

We'll walk you through everything and get you set up. See you then!

- ${businessName || "TradieCatch"}`;
        newState = "demo_completed";
        updates.jobBooked = true;
        const bookingCfgJob = await getBookingConfig(callUserId);
        const allDates = resolveBookingDates(bookingCfgJob.dates);
        const matchedDate = allDates.find((d) => d.label === dateLabel);
        const dateStr = matchedDate?.dateStr || dateLabel;
        await db.insert(jobs).values({
          userId: callUserId,
          callerName: call.callerName || `Demo Lead (${call.phoneNumber})`,
          phoneNumber: call.phoneNumber,
          jobType: "TradieCatch Setup Call (Demo)",
          date: dateStr,
          time: timeSlot,
          address: "",
          notes: "10-min onboarding call booked via SMS demo flow",
          email: null,
          status: "confirmed",
          missedCallId: call.id,
          isUrgent: false
        });
        sendPushToUser(
          callUserId,
          "\u{1F3AC} New demo lead booked",
          `${call.phoneNumber} booked a setup call on ${dateLabel} at ${timeSlot}`,
          { type: "demo_booked", missedCallId: call.id }
        );
      } else {
        const timeMenu = DEMO_CALL_TIMES.map((t, i) => `${i + 1}. ${t}`).join("\n");
        response = `Please reply with a number:

${timeMenu}`;
        newState = "demo_awaiting_time";
      }
      break;
    }
    case "demo_completed": {
      if (body.trim().toLowerCase().includes("demo")) {
        response = `Great to hear from you again! \u{1F60A}

\u{1F3AC} TradieCatch demo: ${DEMO_VIDEO_URL}

Reply YES to book a free 10-minute setup call.`;
        newState = "demo_offer_sent";
      } else {
        const { businessName } = await getTwilioConfig(callUserId);
        response = `Your setup call is already booked \u2014 we'll be in touch! \u{1F64C}

- ${businessName || "TradieCatch"}`;
        newState = "demo_completed";
      }
      break;
    }
    default: {
      response = null;
    }
  }
  if (response) {
    addLogEntry(log2, "business", response);
    await sendSms(call.phoneNumber, response, callUserId);
  }
  await db.update(missedCalls).set({
    ...updates,
    conversationState: newState,
    conversationLog: log2
  }).where(eq2(missedCalls.id, call.id));
  return response;
}
async function handleDemoSmsFlow(fromPhone, body, toPhone) {
  const normalizedFrom = normalizePhone(fromPhone);
  const userIds = await findUsersByTwilioNumber(toPhone);
  if (userIds.length === 0) {
    console.log(`Demo flow: no user found for toPhone ${toPhone}`);
    return null;
  }
  const userId = userIds[0];
  const allCalls = await db.select().from(missedCalls).where(eq2(missedCalls.userId, userId)).orderBy(desc(missedCalls.timestamp));
  const callerCalls = allCalls.filter((c) => phonesMatch(c.phoneNumber, normalizedFrom));
  const DEMO_ACTIVE_STATES = /* @__PURE__ */ new Set(["demo_offer_sent", "demo_awaiting_date", "demo_awaiting_time"]);
  const activeDemo = callerCalls.find((c) => DEMO_ACTIVE_STATES.has(c.conversationState)) || null;
  const completedDemo = callerCalls.find((c) => c.conversationState === "demo_completed") || null;
  if (!activeDemo && !completedDemo) {
    if (body.trim().toLowerCase().includes("demo")) {
      console.log(`Demo flow: new contact from ${fromPhone} \u2014 sending offer`);
      return await handleDemoTrigger(fromPhone, userId);
    }
    const { businessName } = await getTwilioConfig(userId);
    const nudge = `Hi! \u{1F44B} Text the word DEMO to see how TradieCatch works and book a free 10-minute setup call.

- ${businessName || "TradieCatch"}`;
    await sendSms(fromPhone, nudge, userId);
    return nudge;
  }
  const call = activeDemo || completedDemo;
  const reply = body.trim();
  let log2 = call.conversationLog || [];
  addLogEntry(log2, "customer", reply);
  let response = "";
  let newState = call.conversationState;
  let updates = {};
  switch (call.conversationState) {
    case "demo_offer_sent": {
      const upper = reply.toUpperCase();
      if (upper.includes("YES")) {
        const bookingCfgOffer = await getBookingConfig(userId);
        const dates = resolveBookingDates(bookingCfgOffer.dates);
        const dateMenu = dates.map((d, i) => `${i + 1}. ${d.label}`).join("\n");
        response = `Awesome! Let's get you booked in for a free 10-minute setup call.

What day works best for you?

${dateMenu}`;
        newState = "demo_awaiting_date";
      } else {
        response = `Here's the TradieCatch demo \u{1F3AC}
${DEMO_VIDEO_URL}

Reply YES to book your free 10-minute setup call.`;
        newState = "demo_offer_sent";
      }
      break;
    }
    case "demo_awaiting_date": {
      const bookingCfg = await getBookingConfig(userId);
      const dates = resolveBookingDates(bookingCfg.dates);
      const maxIdx = dates.length;
      const dateChoice = reply.replace(new RegExp(`[^1-${maxIdx}]`, "g"), "");
      const idx = parseInt(dateChoice, 10) - 1;
      if (idx >= 0 && idx < dates.length) {
        updates.selectedTime = dates[idx].label;
        const timeMenu = DEMO_CALL_TIMES.map((t, i) => `${i + 1}. ${t}`).join("\n");
        response = `${dates[idx].label} works great!

What time suits you for the 10-minute call?

${timeMenu}`;
        newState = "demo_awaiting_time";
      } else {
        const dateMenu = dates.map((d, i) => `${i + 1}. ${d.label}`).join("\n");
        response = `Please reply with a number:

${dateMenu}`;
        newState = "demo_awaiting_date";
      }
      break;
    }
    case "demo_awaiting_time": {
      const timeIdx = parseInt(reply.replace(/[^0-9]/g, ""), 10) - 1;
      if (timeIdx >= 0 && timeIdx < DEMO_CALL_TIMES.length) {
        const timeSlot = DEMO_CALL_TIMES[timeIdx];
        const dateLabel = call.selectedTime || updates.selectedTime || "";
        updates.selectedTime = `${dateLabel} ${timeSlot}`;
        const { businessName } = await getTwilioConfig(userId);
        response = `All booked! \u{1F389}

Your free 10-minute TradieCatch setup call is confirmed for:
\u{1F4C5} ${dateLabel} at ${timeSlot}

We'll walk you through everything and get you set up. See you then!

- ${businessName || "TradieCatch"}`;
        newState = "demo_completed";
        updates.jobBooked = true;
        const bookingCfgJob = await getBookingConfig(userId);
        const allDates = resolveBookingDates(bookingCfgJob.dates);
        const matchedDate = allDates.find((d) => d.label === dateLabel);
        const dateStr = matchedDate?.dateStr || dateLabel;
        await db.insert(jobs).values({
          userId,
          callerName: call.callerName || `Demo Lead (${call.phoneNumber})`,
          phoneNumber: call.phoneNumber,
          jobType: "TradieCatch Setup Call (Demo)",
          date: dateStr,
          time: timeSlot,
          address: "",
          notes: "10-min onboarding call booked via SMS demo flow",
          email: null,
          status: "confirmed",
          missedCallId: call.id,
          isUrgent: false
        });
        sendPushToUser(
          userId,
          "\u{1F3AC} New demo lead booked",
          `${call.phoneNumber} booked a setup call on ${dateLabel} at ${timeSlot}`,
          { type: "demo_booked", missedCallId: call.id }
        );
      } else {
        const timeMenu = DEMO_CALL_TIMES.map((t, i) => `${i + 1}. ${t}`).join("\n");
        response = `Please reply with a number:

${timeMenu}`;
        newState = "demo_awaiting_time";
      }
      break;
    }
    case "demo_completed":
    default: {
      response = `Great to hear from you! \u{1F60A}

\u{1F3AC} TradieCatch demo: ${DEMO_VIDEO_URL}

Reply YES to book a new free 10-minute setup call.`;
      newState = "demo_offer_sent";
      break;
    }
  }
  if (response) {
    addLogEntry(log2, "business", response);
    await sendSms(fromPhone, response, userId);
  }
  await db.update(missedCalls).set({
    ...updates,
    conversationState: newState,
    conversationLog: log2
  }).where(eq2(missedCalls.id, call.id));
  return response;
}
function normalizePhone(phone) {
  const cleaned = phone.replace(/[\s\-()]/g, "");
  return cleaned;
}
function phonesMatch(a, b) {
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
var DEMO_VIDEO_URL, CALENDLY_BOOKING_URL, DEMO_CALL_TIMES;
var init_sms_conversation = __esm({
  "server/sms-conversation.ts"() {
    "use strict";
    init_db();
    init_schema();
    init_push();
    DEMO_VIDEO_URL = "https://canva.link/v768gnwipa4gcig";
    CALENDLY_BOOKING_URL = "https://calendly.com/amywickham-dgbh/video-session-1hr-apple-devices";
    DEMO_CALL_TIMES = ["9:00 AM", "10:00 AM", "11:00 AM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM"];
  }
});

// server/index.ts
import express from "express";

// server/routes.ts
init_db();
init_schema();
init_sms_conversation();
import { createServer } from "node:http";
import { eq as eq4, desc as desc2, and as and2, not } from "drizzle-orm";

// server/auth.ts
init_db();
init_schema();
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq as eq3 } from "drizzle-orm";
var JWT_SECRET = process.env.JWT_SECRET || "tradiecatch-jwt-secret-change-in-production";
var JWT_EXPIRES_IN = "30d";
function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}
async function register(req, res) {
  const { email, password, username } = req.body;
  if (!email || !password || !username) {
    return res.status(400).json({ error: "Email, username, and password are required" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }
  try {
    const existingEmail = await db.select().from(users).where(eq3(users.email, email.toLowerCase().trim()));
    if (existingEmail.length > 0) {
      return res.status(400).json({ error: "An account with this email already exists" });
    }
    const existingUsername = await db.select().from(users).where(eq3(users.username, username.trim()));
    if (existingUsername.length > 0) {
      return res.status(400).json({ error: "This username is already taken" });
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    const [user] = await db.insert(users).values({
      email: email.toLowerCase().trim(),
      username: username.trim(),
      password: hashedPassword
    }).returning();
    await db.insert(settings).values({
      userId: user.id,
      businessName: "",
      autoReplyEnabled: true,
      bookingCalendarEnabled: true,
      bookingSlots: ["8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM"],
      services: DEFAULT_SERVICES,
      twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || "",
      twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || "",
      twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || ""
    });
    await db.insert(smsTemplates).values({
      userId: user.id,
      name: "Missed Call Auto-Reply",
      message: "Hi! Sorry we missed your call. We'll get back to you shortly.",
      isDefault: true
    });
    const token = generateToken(user.id);
    res.json({
      token,
      user: { id: user.id, email: user.email, username: user.username }
    });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ error: "Registration failed. Please try again." });
  }
}
async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  try {
    const [user] = await db.select().from(users).where(eq3(users.email, email.toLowerCase().trim()));
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const token = generateToken(user.id);
    res.json({
      token,
      user: { id: user.id, email: user.email, username: user.username }
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed. Please try again." });
  }
}
async function getMe(req, res) {
  try {
    const [user] = await db.select().from(users).where(eq3(users.id, req.userId));
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ id: user.id, email: user.email, username: user.username });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user" });
  }
}
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// server/stripeClient.ts
import Stripe from "stripe";
async function getCredentials() {
  if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLISHABLE_KEY) {
    return {
      secretKey: process.env.STRIPE_SECRET_KEY.replace(/\s+/g, "").trim(),
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY.replace(/\s+/g, "").trim()
    };
  }
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY ? "repl " + process.env.REPL_IDENTITY : process.env.WEB_REPL_RENEWAL ? "depl " + process.env.WEB_REPL_RENEWAL : null;
  if (!xReplitToken || !hostname) {
    throw new Error("Stripe credentials not configured. Set STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY.");
  }
  const connectorName = "stripe";
  const isProduction = process.env.REPLIT_DEPLOYMENT === "1";
  const targetEnvironment = isProduction ? "production" : "development";
  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets", "true");
  url.searchParams.set("connector_names", connectorName);
  url.searchParams.set("environment", targetEnvironment);
  const response = await fetch(url.toString(), {
    headers: {
      "Accept": "application/json",
      "X_REPLIT_TOKEN": xReplitToken
    }
  });
  const data = await response.json();
  const connectionSettings = data.items?.[0];
  if (!connectionSettings || (!connectionSettings.settings.publishable || !connectionSettings.settings.secret)) {
    throw new Error(`Stripe ${targetEnvironment} connection not found`);
  }
  return {
    publishableKey: connectionSettings.settings.publishable,
    secretKey: connectionSettings.settings.secret
  };
}
async function getUncachableStripeClient() {
  const { secretKey } = await getCredentials();
  return new Stripe(secretKey, {
    apiVersion: "2025-08-27.basil"
  });
}
async function getStripePublishableKey() {
  const { publishableKey } = await getCredentials();
  return publishableKey;
}
async function getStripeSecretKey() {
  const { secretKey } = await getCredentials();
  return secretKey;
}
var stripeSync = null;
async function getStripeSync() {
  if (!stripeSync) {
    const { StripeSync } = await import("stripe-replit-sync");
    const secretKey = await getStripeSecretKey();
    stripeSync = new StripeSync({
      poolConfig: {
        connectionString: process.env.DATABASE_URL,
        max: 2
      },
      stripeSecretKey: secretKey
    });
  }
  return stripeSync;
}

// server/routes.ts
function paramId(req) {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}
async function registerRoutes(app2) {
  app2.post("/api/auth/register", register);
  app2.post("/api/auth/login", login);
  app2.get("/api/auth/me", requireAuth, getMe);
  app2.post("/api/push-token", requireAuth, async (req, res) => {
    try {
      const { token } = req.body || {};
      if (!token || typeof token !== "string") {
        return res.status(400).json({ error: "Missing token" });
      }
      await db.update(users).set({ pushToken: token }).where(eq4(users.id, req.userId));
      res.json({ success: true });
    } catch (err) {
      console.error("push-token error", err);
      res.status(500).json({ error: err.message });
    }
  });
  app2.delete("/api/push-token", requireAuth, async (req, res) => {
    try {
      await db.update(users).set({ pushToken: null }).where(eq4(users.id, req.userId));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.get("/api/debug/twilio-numbers", async (_req, res) => {
    try {
      const allSettings = await db.select({
        userId: settings.userId,
        twilioPhoneNumber: settings.twilioPhoneNumber,
        businessName: settings.businessName
      }).from(settings);
      const dbUrl = process.env.DATABASE_URL || "";
      const maskedUrl = dbUrl.replace(/\/\/.*@/, "//***@");
      res.json({
        dbConnection: maskedUrl,
        settingsCount: allSettings.length,
        configuredNumbers: allSettings.map((s) => ({
          userId: s.userId?.slice(0, 8) + "...",
          number: s.twilioPhoneNumber || "(empty)",
          name: s.businessName || "(unnamed)"
        }))
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.get("/api/config", async (req, res) => {
    const domains = process.env.REPLIT_DOMAINS || "";
    const domainList = domains.split(",").map((d) => d.trim()).filter(Boolean);
    const deploymentDomain = process.env.DEPLOYMENT_DOMAIN || domainList.find((d) => d.endsWith(".replit.app")) || "";
    const protocol = req.protocol || "https";
    const hostFromHeader = req.get("host") || "";
    const appUrl = deploymentDomain ? `https://${deploymentDomain}` : hostFromHeader ? `${protocol}://${hostFromHeader}` : "";
    let stripePublishableKey = "";
    try {
      stripePublishableKey = await getStripePublishableKey();
    } catch (e) {
      console.log("Stripe publishable key not available:", e.message);
    }
    res.json({
      revenueCatApiKey: process.env.REVENUECAT_API_KEY || "",
      stripePublishableKey,
      webhookUrl: appUrl ? `${appUrl}/api/twilio/webhook` : "",
      voiceWebhookUrl: appUrl ? `${appUrl}/api/twilio/voice` : "",
      appUrl
    });
  });
  app2.get("/api/missed-calls", requireAuth, async (req, res) => {
    const rows = await db.select().from(missedCalls).where(eq4(missedCalls.userId, req.userId)).orderBy(desc2(missedCalls.timestamp));
    res.json(rows);
  });
  app2.post("/api/missed-calls", requireAuth, async (req, res) => {
    try {
      const { callerName, phoneNumber } = req.body;
      if (!phoneNumber) {
        return res.status(400).json({ error: "phoneNumber is required" });
      }
      const [call] = await db.insert(missedCalls).values({
        userId: req.userId,
        callerName: callerName || "Unknown Caller",
        phoneNumber,
        timestamp: /* @__PURE__ */ new Date()
      }).returning();
      res.json(call);
    } catch (err) {
      console.error("Error adding missed call:", err);
      res.status(500).json({ error: err?.message || "Failed to add call" });
    }
  });
  app2.delete("/api/missed-calls/:id", requireAuth, async (req, res) => {
    const id = paramId(req);
    await db.delete(missedCalls).where(
      and2(eq4(missedCalls.id, id), eq4(missedCalls.userId, req.userId))
    );
    res.json({ ok: true });
  });
  app2.post("/api/missed-calls/:id/send-sms", requireAuth, async (req, res) => {
    const id = paramId(req);
    try {
      const [call] = await db.select().from(missedCalls).where(
        and2(eq4(missedCalls.id, id), eq4(missedCalls.userId, req.userId))
      );
      if (!call) return res.status(404).json({ error: "Call not found" });
      await sendInitialMissedCallSms(id, req.userId);
      const [updated] = await db.select().from(missedCalls).where(eq4(missedCalls.id, id));
      res.json(updated);
    } catch (err) {
      console.error("Send SMS error:", err);
      res.status(500).json({ error: err.message || "Failed to send SMS" });
    }
  });
  app2.get("/api/missed-calls/:id", requireAuth, async (req, res) => {
    const id = paramId(req);
    const [call] = await db.select().from(missedCalls).where(
      and2(eq4(missedCalls.id, id), eq4(missedCalls.userId, req.userId))
    );
    if (!call) return res.status(404).json({ error: "Not found" });
    res.json(call);
  });
  app2.post("/api/calendly/webhook-disabled", async (req, res) => {
    try {
      const { sendSms: sendSms2 } = await Promise.resolve().then(() => (init_sms_conversation(), sms_conversation_exports));
      const event = req.body?.event || "";
      const payload = req.body?.payload || {};
      console.log(`Calendly webhook event: ${event}`);
      if (event !== "invitee.created") {
        return res.status(200).json({ ok: true, ignored: event });
      }
      const inviteeName = payload?.name || payload?.invitee?.name || "there";
      const startTimeRaw = payload?.scheduled_event?.start_time || payload?.event?.start_time || "";
      const eventName = payload?.scheduled_event?.name || payload?.event_type?.name || "your TradieCatch call";
      let invPhone = payload?.text_reminder_number || payload?.invitee?.text_reminder_number || "";
      const qa = payload?.questions_and_answers || payload?.invitee?.questions_and_answers || [];
      if (!invPhone && Array.isArray(qa)) {
        for (const item of qa) {
          const ans = String(item?.answer || "");
          const m = ans.match(/\+?\d[\d\s\-().]{6,}/);
          if (m) {
            invPhone = m[0];
            break;
          }
        }
      }
      let timeLabel = "";
      if (startTimeRaw) {
        try {
          const d = new Date(startTimeRaw);
          timeLabel = d.toLocaleString("en-AU", {
            weekday: "short",
            day: "numeric",
            month: "short",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
            timeZone: "Australia/Sydney"
          });
        } catch {
          timeLabel = startTimeRaw;
        }
      }
      const candidateStates = ["demo_awaiting_calendly", "demo_offer_sent"];
      let targetCall = null;
      if (invPhone) {
        const normalize = (p) => p.replace(/[^\d+]/g, "");
        const target = normalize(invPhone);
        const all = await db.select().from(missedCalls);
        const matched = all.filter((c) => candidateStates.includes(c.conversationState)).filter((c) => {
          const a = normalize(c.phoneNumber);
          return a.endsWith(target.slice(-9)) || target.endsWith(a.slice(-9));
        }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        targetCall = matched[0] || null;
      }
      if (!targetCall) {
        const cutoff = Date.now() - 24 * 60 * 60 * 1e3;
        const all = await db.select().from(missedCalls);
        const recent = all.filter((c) => c.conversationState === "demo_awaiting_calendly").filter((c) => new Date(c.timestamp).getTime() > cutoff).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        targetCall = recent[0] || null;
      }
      if (!targetCall) {
        console.log("Calendly webhook: no matching demo conversation found");
        return res.status(200).json({ ok: true, matched: false });
      }
      const confirmation = `\u{1F389} You're all booked, ${inviteeName.split(" ")[0]}!

${timeLabel ? `\u{1F4C5} ${timeLabel}

` : ""}I'll see you on the call. If anything changes you can reschedule from your Calendly confirmation email.

\u2014 Amy, TradieCatch`;
      await sendSms2(targetCall.phoneNumber, confirmation, targetCall.userId);
      const log2 = targetCall.conversationLog || [];
      log2.push({ role: "business", message: confirmation, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
      await db.update(missedCalls).set({
        conversationState: "demo_completed",
        conversationLog: log2
      }).where(eq4(missedCalls.id, targetCall.id));
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
        isUrgent: false
      });
      res.status(200).json({ ok: true, matched: true });
    } catch (err) {
      console.error("Calendly webhook error:", err);
      res.status(200).json({ ok: false });
    }
  });
  app2.post("/api/twilio/webhook", async (req, res) => {
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
  app2.post("/api/twilio/voice", async (req, res) => {
    const from = req.body.From || req.body.Caller || "";
    const to = req.body.To || req.body.Called || "";
    const callStatus = req.body.CallStatus || "";
    const callerName = req.body.CallerName || "Unknown Caller";
    console.log(`Incoming call from ${from} to ${to} (status: ${callStatus}, name: ${callerName})`);
    let settingsRow = await resolveOwnerSettings(to, from);
    if (!settingsRow) {
      console.log(`No user found for Twilio number: ${to}`);
      res.set("Content-Type", "text/xml");
      res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">Sorry, this number is not configured.</Say><Hangup/></Response>`);
      return;
    }
    const userId = settingsRow.userId;
    console.log(`Resolved to user ${userId} for Twilio number ${to}`);
    const baseUrl = getPublicBaseUrl(req);
    const mode = settingsRow.forwardingMode || "carrier_forward";
    const tradieMobile = (settingsRow.tradieMobileNumber || "").trim();
    res.set("Content-Type", "text/xml");
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
    await handleMissedCallAndRespond(req, res, userId, settingsRow, from, callerName, baseUrl);
  });
  app2.post("/api/twilio/dial-result", async (req, res) => {
    const dialStatus = req.body.DialCallStatus || "";
    const ownerUserId = req.query.ownerUserId || "";
    const caller = req.query.caller || req.body.From || "";
    const callerName = req.query.callerName || "Unknown Caller";
    console.log(`Dial result: ${dialStatus} for owner ${ownerUserId}, caller ${caller}`);
    res.set("Content-Type", "text/xml");
    if (dialStatus === "completed" || dialStatus === "answered") {
      res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`);
      return;
    }
    const [settingsRow] = await db.select().from(settings).where(eq4(settings.userId, ownerUserId));
    if (!settingsRow) {
      res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`);
      return;
    }
    const baseUrl = getPublicBaseUrl(req);
    await handleMissedCallAndRespond(req, res, ownerUserId, settingsRow, caller, callerName, baseUrl);
  });
  app2.post("/api/twilio/recording-callback", async (req, res) => {
    res.status(200).send("ok");
    try {
      const missedCallId = req.query.missedCallId || "";
      const recordingUrl = req.body.RecordingUrl || "";
      const recordingDuration = req.body.RecordingDuration || "0";
      console.log(`Recording callback: missedCallId=${missedCallId}, url=${recordingUrl}, duration=${recordingDuration}s`);
      if (!missedCallId || !recordingUrl) return;
      const [call] = await db.select().from(missedCalls).where(eq4(missedCalls.id, missedCallId));
      if (!call) {
        console.log("Recording callback: missed call not found");
        return;
      }
      const [settingsRow] = await db.select().from(settings).where(eq4(settings.userId, call.userId));
      if (!settingsRow) {
        console.log("Recording callback: settings not found");
        return;
      }
      const sid = settingsRow.twilioAccountSid || process.env.TWILIO_ACCOUNT_SID || "";
      const token = settingsRow.twilioAuthToken || process.env.TWILIO_AUTH_TOKEN || "";
      const authHeader = "Basic " + Buffer.from(`${sid}:${token}`).toString("base64");
      const audioRes = await fetch(`${recordingUrl}.mp3`, { headers: { Authorization: authHeader } });
      if (!audioRes.ok) {
        console.error(`Failed to download recording: ${audioRes.status}`);
        return;
      }
      const audioBuf = Buffer.from(await audioRes.arrayBuffer());
      const audioB64 = audioBuf.toString("base64");
      await db.update(missedCalls).set({
        voicemailData: audioB64,
        voicemailMimeType: "audio/mpeg",
        voicemailDurationSeconds: String(recordingDuration)
      }).where(eq4(missedCalls.id, missedCallId));
      console.log(`Voicemail saved for call ${missedCallId} (${audioBuf.length} bytes)`);
      const tradieMobile = (settingsRow.tradieMobileNumber || "").trim();
      if (tradieMobile) {
        const baseUrl = getPublicBaseUrl(req);
        const playUrl = `${baseUrl}/api/voicemail/${missedCallId}`;
        const { sendSms: sendSms2 } = await Promise.resolve().then(() => (init_sms_conversation(), sms_conversation_exports));
        const callerLabel = call.callerName && call.callerName !== "Unknown Caller" ? call.callerName : call.phoneNumber;
        const msg = `\u{1F4E9} New voicemail from ${callerLabel} (${recordingDuration}s).

\u25B6\uFE0F Listen: ${playUrl}`;
        try {
          await sendSms2(tradieMobile, msg, call.userId);
          console.log(`Voicemail SMS sent to tradie ${tradieMobile}`);
        } catch (smsErr) {
          console.error("Voicemail-to-tradie SMS failed:", smsErr);
        }
      } else {
        console.log("No tradie mobile configured \u2014 skipping voicemail SMS forward");
      }
    } catch (err) {
      console.error("Recording callback error:", err);
    }
  });
  app2.get("/api/voicemail/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const [call] = await db.select().from(missedCalls).where(eq4(missedCalls.id, id));
      if (!call?.voicemailData) {
        return res.status(404).send("Voicemail not found");
      }
      const buf = Buffer.from(call.voicemailData, "base64");
      res.set("Content-Type", call.voicemailMimeType || "audio/mpeg");
      res.set("Content-Length", buf.length.toString());
      res.set("Cache-Control", "private, max-age=86400");
      res.send(buf);
    } catch (err) {
      console.error("Serve voicemail error:", err);
      res.status(500).send("Error");
    }
  });
  app2.get("/api/voice-recording/:userId", async (req, res) => {
    try {
      const userId = req.params.userId;
      const [row] = await db.select({
        voiceRecordingData: settings.voiceRecordingData,
        voiceRecordingMimeType: settings.voiceRecordingMimeType
      }).from(settings).where(eq4(settings.userId, userId));
      if (!row?.voiceRecordingData) {
        return res.status(404).json({ error: "No recording found" });
      }
      const mimeType = row.voiceRecordingMimeType || "audio/mp4";
      const audioBuffer = Buffer.from(row.voiceRecordingData, "base64");
      res.set("Content-Type", mimeType);
      res.set("Content-Length", audioBuffer.length.toString());
      res.set("Cache-Control", "no-cache");
      res.send(audioBuffer);
    } catch (err) {
      console.error("Serve voice recording error:", err);
      res.status(500).json({ error: err.message });
    }
  });
  app2.post("/api/settings/voice-recording", requireAuth, async (req, res) => {
    try {
      const { audioBase64, mimeType } = req.body;
      if (!audioBase64) {
        return res.status(400).json({ error: "audioBase64 is required" });
      }
      const buffer = Buffer.from(audioBase64, "base64");
      if (buffer.length === 0) {
        return res.status(400).json({ error: "Invalid audio data" });
      }
      const [row] = await db.update(settings).set({
        voiceRecordingData: audioBase64,
        voiceRecordingMimeType: mimeType || "audio/mp4"
      }).where(eq4(settings.userId, req.userId)).returning();
      res.json({ ok: true, size: buffer.length });
    } catch (err) {
      console.error("Upload voice recording error:", err);
      res.status(500).json({ error: err.message });
    }
  });
  app2.delete("/api/settings/voice-recording", requireAuth, async (req, res) => {
    try {
      await db.update(settings).set({ voiceRecordingData: null, voiceRecordingMimeType: null }).where(eq4(settings.userId, req.userId));
      res.json({ ok: true });
    } catch (err) {
      console.error("Delete voice recording error:", err);
      res.status(500).json({ error: err.message });
    }
  });
  app2.get("/api/jobs", requireAuth, async (req, res) => {
    const rows = await db.select().from(jobs).where(eq4(jobs.userId, req.userId)).orderBy(desc2(jobs.createdAt));
    res.json(rows);
  });
  app2.post("/api/jobs", requireAuth, async (req, res) => {
    const { callerName, phoneNumber, jobType, date, time, address, notes, status, missedCallId, isUrgent } = req.body;
    const [job] = await db.insert(jobs).values({
      userId: req.userId,
      callerName: callerName || "Unknown",
      phoneNumber: phoneNumber || "",
      jobType: jobType || "General",
      date,
      time,
      address,
      notes,
      status: status || "pending",
      missedCallId,
      isUrgent: isUrgent || false
    }).returning();
    if (missedCallId) {
      await db.update(missedCalls).set({ jobBooked: true }).where(
        and2(eq4(missedCalls.id, missedCallId), eq4(missedCalls.userId, req.userId))
      );
    }
    res.json(job);
  });
  app2.patch("/api/jobs/:id", requireAuth, async (req, res) => {
    const id = paramId(req);
    const [job] = await db.update(jobs).set(req.body).where(
      and2(eq4(jobs.id, id), eq4(jobs.userId, req.userId))
    ).returning();
    res.json(job);
  });
  app2.delete("/api/jobs/:id", requireAuth, async (req, res) => {
    const id = paramId(req);
    await db.delete(jobs).where(
      and2(eq4(jobs.id, id), eq4(jobs.userId, req.userId))
    );
    res.json({ ok: true });
  });
  app2.get("/api/services", requireAuth, async (req, res) => {
    const [row] = await db.select().from(settings).where(eq4(settings.userId, req.userId));
    const services = row?.services || DEFAULT_SERVICES;
    res.json(services);
  });
  app2.put("/api/services", requireAuth, async (req, res) => {
    const { services: newServices } = req.body;
    if (!Array.isArray(newServices) || newServices.length === 0) {
      return res.status(400).json({ error: "Services must be a non-empty array" });
    }
    const cleaned = newServices.map((s) => s.trim()).filter((s) => s.length > 0);
    const [row] = await db.update(settings).set({ services: cleaned }).where(eq4(settings.userId, req.userId)).returning();
    res.json(row.services || cleaned);
  });
  app2.get("/api/settings", requireAuth, async (req, res) => {
    const [row] = await db.select().from(settings).where(eq4(settings.userId, req.userId));
    res.json(row || { id: "default", userId: req.userId, businessName: "", autoReplyEnabled: true, services: DEFAULT_SERVICES });
  });
  app2.patch("/api/settings", requireAuth, async (req, res) => {
    if (req.body.twilioPhoneNumber && req.body.twilioPhoneNumber.trim()) {
      await db.update(settings).set({ twilioPhoneNumber: "" }).where(and2(
        eq4(settings.twilioPhoneNumber, req.body.twilioPhoneNumber.trim()),
        not(eq4(settings.userId, req.userId))
      ));
    }
    const existing = await db.select().from(settings).where(eq4(settings.userId, req.userId));
    if (existing.length === 0) {
      const [row2] = await db.insert(settings).values({
        userId: req.userId,
        businessName: req.body.businessName || "",
        autoReplyEnabled: req.body.autoReplyEnabled !== void 0 ? req.body.autoReplyEnabled : true
      }).returning();
      return res.json(row2);
    }
    const [row] = await db.update(settings).set(req.body).where(eq4(settings.userId, req.userId)).returning();
    res.json(row);
  });
  app2.get("/api/templates", requireAuth, async (req, res) => {
    const rows = await db.select().from(smsTemplates).where(eq4(smsTemplates.userId, req.userId));
    res.json(rows);
  });
  app2.post("/api/templates", requireAuth, async (req, res) => {
    const [template] = await db.insert(smsTemplates).values({
      userId: req.userId,
      name: req.body.name,
      message: req.body.message,
      isDefault: req.body.isDefault || false
    }).returning();
    res.json(template);
  });
  app2.patch("/api/templates/:id", requireAuth, async (req, res) => {
    const id = paramId(req);
    const [template] = await db.update(smsTemplates).set(req.body).where(
      and2(eq4(smsTemplates.id, id), eq4(smsTemplates.userId, req.userId))
    ).returning();
    res.json(template);
  });
  app2.delete("/api/templates/:id", requireAuth, async (req, res) => {
    const id = paramId(req);
    await db.delete(smsTemplates).where(
      and2(eq4(smsTemplates.id, id), eq4(smsTemplates.userId, req.userId))
    );
    res.json({ ok: true });
  });
  app2.post("/api/templates/:id/set-default", requireAuth, async (req, res) => {
    const id = paramId(req);
    await db.update(smsTemplates).set({ isDefault: false }).where(
      and2(eq4(smsTemplates.isDefault, true), eq4(smsTemplates.userId, req.userId))
    );
    const [template] = await db.update(smsTemplates).set({ isDefault: true }).where(
      and2(eq4(smsTemplates.id, id), eq4(smsTemplates.userId, req.userId))
    ).returning();
    res.json(template);
  });
  app2.post("/api/stripe/create-checkout", requireAuth, async (req, res) => {
    try {
      const stripe = await getUncachableStripeClient();
      const userId = req.userId;
      const [user] = await db.select().from(users).where(eq4(users.id, userId));
      if (!user) return res.status(404).json({ error: "User not found" });
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { userId }
        });
        await db.update(users).set({ stripeCustomerId: customer.id }).where(eq4(users.id, userId));
        customerId = customer.id;
      }
      const stripeProducts = await stripe.products.search({ query: "name:'TradieCatch Pro' AND active:'true'" });
      if (!stripeProducts.data.length) {
        return res.status(400).json({ error: "No subscription product configured yet. Please contact support." });
      }
      const product = stripeProducts.data[0];
      const stripePrices = await stripe.prices.list({ product: product.id, active: true, limit: 10 });
      const recurringPrice = stripePrices.data.find((p) => p.recurring !== null);
      if (!recurringPrice) {
        return res.status(400).json({ error: "No subscription price configured yet. Please contact support." });
      }
      const priceId = recurringPrice.id;
      const domains = process.env.REPLIT_DOMAINS || "";
      const primaryDomain = domains.split(",")[0]?.trim() || "";
      const baseUrl = primaryDomain ? `https://${primaryDomain}` : `${req.protocol}://${req.get("host")}`;
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [
          { price: priceId, quantity: 1 },
          {
            quantity: 1,
            price_data: {
              currency: "aud",
              product_data: {
                name: "TradieCatch Setup Fee",
                description: "One-time setup & onboarding (charged today). $99/month subscription begins after 30 days."
              },
              unit_amount: 29900
            }
          }
        ],
        mode: "subscription",
        subscription_data: {
          trial_period_days: 30,
          description: "TradieCatch Pro \u2014 $99/month begins after 30-day setup period"
        },
        success_url: `${baseUrl}/api/stripe/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/api/stripe/checkout-cancel`
      });
      res.json({ url: session.url });
    } catch (err) {
      console.error("Stripe checkout error:", err);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });
  app2.get("/api/stripe/checkout-success", async (req, res) => {
    const sessionId = req.query.session_id;
    if (!sessionId) return res.redirect("/?checkout=error");
    try {
      const stripe = await getUncachableStripeClient();
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.customer && session.subscription) {
        const customerId = typeof session.customer === "string" ? session.customer : session.customer.id;
        const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        await db.update(users).set({ stripeSubscriptionId: subscriptionId }).where(eq4(users.stripeCustomerId, customerId));
      }
    } catch (err) {
      console.error("Error processing checkout success:", err);
    }
    const domains = process.env.REPLIT_DOMAINS || "";
    const devDomain = process.env.REPLIT_DEV_DOMAIN || "";
    const primaryDomain = domains.split(",")[0]?.trim() || "";
    const redirectUrl = primaryDomain ? `https://${primaryDomain}/?checkout=success` : devDomain ? `https://${devDomain}:8081/?checkout=success` : "/?checkout=success";
    res.redirect(redirectUrl);
  });
  app2.get("/api/stripe/checkout-cancel", async (req, res) => {
    const domains = process.env.REPLIT_DOMAINS || "";
    const devDomain = process.env.REPLIT_DEV_DOMAIN || "";
    const primaryDomain = domains.split(",")[0]?.trim() || "";
    const redirectUrl = primaryDomain ? `https://${primaryDomain}/?checkout=cancelled` : devDomain ? `https://${devDomain}:8081/?checkout=cancelled` : "/?checkout=cancelled";
    res.redirect(redirectUrl);
  });
  app2.get("/api/stripe/subscription-status", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      const [user] = await db.select().from(users).where(eq4(users.id, userId));
      if (user?.email === "admin@tradiecatch.com") {
        return res.json({
          active: true,
          subscription: {
            id: "admin_pro",
            status: "active",
            currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1e3).toISOString(),
            cancelAtPeriodEnd: false
          }
        });
      }
      if (!user?.stripeCustomerId) {
        return res.json({ active: false, subscription: null });
      }
      const stripe = await getUncachableStripeClient();
      const subscriptions = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: "all",
        limit: 5
      });
      const activeSub = subscriptions.data.find(
        (s) => s.status === "active" || s.status === "trialing"
      );
      if (!activeSub) {
        return res.json({ active: false, subscription: null });
      }
      if (user.stripeSubscriptionId !== activeSub.id) {
        await db.update(users).set({ stripeSubscriptionId: activeSub.id }).where(eq4(users.id, userId));
      }
      return res.json({
        active: true,
        subscription: {
          id: activeSub.id,
          status: activeSub.status,
          currentPeriodEnd: new Date(activeSub.current_period_end * 1e3).toISOString(),
          cancelAtPeriodEnd: activeSub.cancel_at_period_end
        }
      });
    } catch (err) {
      console.error("Subscription status error:", err);
      res.json({ active: false, subscription: null });
    }
  });
  app2.post("/api/stripe/customer-portal", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      const [user] = await db.select().from(users).where(eq4(users.id, userId));
      if (!user?.stripeCustomerId) {
        return res.status(400).json({ error: "No Stripe customer found" });
      }
      const stripe = await getUncachableStripeClient();
      const domains = process.env.REPLIT_DOMAINS || "";
      const primaryDomain = domains.split(",")[0]?.trim() || "";
      const baseUrl = primaryDomain ? `https://${primaryDomain}` : `${req.protocol}://${req.get("host")}`;
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: baseUrl
      });
      res.json({ url: portalSession.url });
    } catch (err) {
      console.error("Customer portal error:", err);
      res.status(500).json({ error: "Failed to create portal session" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}
function getPublicBaseUrl(req) {
  const domains = process.env.REPLIT_DOMAINS || "";
  const deploymentDomain = process.env.DEPLOYMENT_DOMAIN || domains.split(",").find((d) => d.trim().endsWith(".replit.app"))?.trim() || "";
  return deploymentDomain ? `https://${deploymentDomain}` : `${req.protocol}://${req.get("host")}`;
}
async function resolveOwnerSettings(toNumber, fromNumber) {
  const allSettings = await db.select().from(settings);
  const matching = allSettings.filter((s) => {
    const t = s.twilioPhoneNumber || "";
    return t && phonesMatchSimple(t, toNumber);
  });
  if (matching.length === 0) return null;
  if (matching.length === 1) return matching[0];
  const scored = matching.map((s) => {
    let score = 0;
    if (s.businessName && s.businessName.trim()) score += 2;
    const svcList = s.services;
    if (Array.isArray(svcList) && svcList.length > 0) score += 1;
    return { s, score };
  }).sort((a, b) => b.score - a.score);
  const top = scored[0].score;
  const candidates = scored.filter((x) => x.score === top).map((x) => x.s);
  if (candidates.length === 1) return candidates[0];
  const recent = await db.select().from(missedCalls).where(eq4(missedCalls.phoneNumber, fromNumber)).orderBy(desc2(missedCalls.timestamp)).limit(1);
  if (recent.length > 0) {
    const m = candidates.find((s) => s.userId === recent[0].userId);
    if (m) return m;
  }
  return candidates[0];
}
async function handleMissedCallAndRespond(req, res, userId, settingsRow, from, callerName, baseUrl) {
  let missedCallId = null;
  try {
    const existing = await db.select().from(missedCalls).where(and2(eq4(missedCalls.userId, userId), eq4(missedCalls.phoneNumber, from))).orderBy(desc2(missedCalls.timestamp)).limit(1);
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1e3);
    const isDuplicate = existing.length > 0 && new Date(existing[0].timestamp) > fiveMinAgo;
    if (isDuplicate) {
      missedCallId = existing[0].id;
      console.log(`Duplicate call from ${from} within 5 minutes \u2014 reusing call ${missedCallId}`);
    } else {
      const [newCall] = await db.insert(missedCalls).values({
        userId,
        callerName: callerName || "Unknown Caller",
        phoneNumber: from,
        timestamp: /* @__PURE__ */ new Date()
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
  const greetingTwiml = recordingUrl ? `<Play>${recordingUrl}</Play>` : `<Say voice="alice">${voiceMessage} Thanks for calling ${businessName}.</Say>`;
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
function phonesMatchSimple(a, b) {
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

// server/index.ts
import { runMigrations } from "stripe-replit-sync";

// server/webhookHandlers.ts
var WebhookHandlers = class {
  static async processWebhook(payload, signature) {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        "STRIPE WEBHOOK ERROR: Payload must be a Buffer. Received type: " + typeof payload + ". This usually means express.json() parsed the body before reaching this handler. FIX: Ensure webhook route is registered BEFORE app.use(express.json())."
      );
    }
    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);
  }
};

// server/index.ts
init_db();
init_schema();
import { eq as eq5 } from "drizzle-orm";
import bcrypt2 from "bcryptjs";
import * as fs from "fs";
import * as path from "path";
var app = express();
var log = console.log;
function setupCors(app2) {
  app2.use((req, res, next) => {
    const origins = /* @__PURE__ */ new Set();
    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }
    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }
    const origin = req.header("origin");
    const isLocalhost = origin?.startsWith("http://localhost:") || origin?.startsWith("http://127.0.0.1:");
    if (origin && (origins.has(origin) || isLocalhost)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, PATCH, DELETE, OPTIONS"
      );
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.header("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
}
function setupBodyParsing(app2) {
  app2.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app2.use(express.urlencoded({ extended: false }));
}
function setupRequestLogging(app2) {
  app2.use((req, res, next) => {
    const start = Date.now();
    const path2 = req.path;
    let capturedJsonResponse = void 0;
    const originalResJson = res.json;
    res.json = function(bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      if (!path2.startsWith("/api")) return;
      const duration = Date.now() - start;
      let logLine = `${req.method} ${path2} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    });
    next();
  });
}
function getAppName() {
  try {
    const appJsonPath = path.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}
function serveExpoManifest(platform, res) {
  const manifestPath = path.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json"
  );
  if (!fs.existsSync(manifestPath)) {
    return res.status(404).json({ error: `Manifest not found for platform: ${platform}` });
  }
  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");
  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}
function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;
  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);
  const html = landingPageTemplate.replace(/BASE_URL_PLACEHOLDER/g, baseUrl).replace(/EXPS_URL_PLACEHOLDER/g, expsUrl).replace(/APP_NAME_PLACEHOLDER/g, appName);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
function configureExpoAndLanding(app2) {
  const templatePath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html"
  );
  const landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
  const appName = getAppName();
  log("Serving static Expo files with dynamic manifest routing");
  app2.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    if (req.path !== "/" && req.path !== "/manifest") {
      return next();
    }
    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, res);
    }
    const webBuildPath = path.resolve(process.cwd(), "web-build", "index.html");
    const hasWebBuild = fs.existsSync(webBuildPath);
    if (req.path === "/" && hasWebBuild) {
      return res.sendFile(webBuildPath);
    }
    if (req.path === "/") {
      try {
        return serveLandingPage({
          req,
          res,
          landingPageTemplate,
          appName
        });
      } catch (err) {
        console.error("Landing page error:", err);
        return res.status(200).send("OK");
      }
    }
    next();
  });
  app2.use("/assets", express.static(path.resolve(process.cwd(), "assets")));
  app2.use(express.static(path.resolve(process.cwd(), "web-build")));
  app2.use(express.static(path.resolve(process.cwd(), "static-build")));
  app2.get("/{*path}", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    const webIndex = path.resolve(process.cwd(), "web-build", "index.html");
    if (fs.existsSync(webIndex)) {
      return res.sendFile(webIndex);
    }
    next();
  });
  log("Expo routing: Checking expo-platform header on / and /manifest");
}
function setupErrorHandler(app2) {
  app2.use((err, _req, res, next) => {
    const error = err;
    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) {
      return next(err);
    }
    return res.status(status).json({ message });
  });
}
async function bootstrapDefaultUser() {
  const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
  if (!twilioPhone) {
    log("No TWILIO_PHONE_NUMBER env var set, skipping bootstrap");
    return;
  }
  try {
    const demoToDelete = await db.select().from(users).where(eq5(users.email, "demo@tradiecatch.com"));
    if (demoToDelete.length > 0) {
      const demoId = demoToDelete[0].id;
      await db.delete(missedCalls).where(eq5(missedCalls.userId, demoId));
      await db.delete(jobs).where(eq5(jobs.userId, demoId));
      await db.delete(smsTemplates).where(eq5(smsTemplates.userId, demoId));
      await db.delete(settings).where(eq5(settings.userId, demoId));
      await db.delete(users).where(eq5(users.id, demoId));
      log("Bootstrap: deleted demo@tradiecatch.com account and all associated data");
    }
    const allUsers = await db.select().from(users);
    if (allUsers.length > 0) {
      const allSettings = await db.select().from(settings);
      const firstUser = allUsers[0];
      const userSettings = allSettings.find((s) => s.userId === firstUser.id);
      if (userSettings && !userSettings.bookingCalendarEnabled) {
        await db.update(settings).set({
          bookingCalendarEnabled: true,
          bookingSlots: userSettings.bookingSlots || ["8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM"]
        }).where(eq5(settings.userId, firstUser.id));
        log(`Bootstrap: Enabled booking calendar for user ${firstUser.email}`);
      }
      const hasMatchingNumber = allSettings.some((s) => s.twilioPhoneNumber === twilioPhone);
      if (hasMatchingNumber) {
        log(`Bootstrap: Twilio number ${twilioPhone} already configured`);
        return;
      }
      if (userSettings && !userSettings.twilioPhoneNumber) {
        await db.update(settings).set({
          twilioPhoneNumber: twilioPhone,
          twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || "",
          twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || "",
          businessName: userSettings.businessName || "TradieCatch"
        }).where(eq5(settings.userId, firstUser.id));
        log(`Bootstrap: Updated user ${firstUser.email} with Twilio number ${twilioPhone}`);
      }
      log("Bootstrap: Users exist but Twilio number not matched to any");
      const resetPwd = process.env.ADMIN_PASSWORD_RESET;
      if (resetPwd) {
        const adminUser = allUsers.find((u) => u.email === "admin@tradiecatch.com");
        if (adminUser) {
          const newHash = await bcrypt2.hash(resetPwd, 12);
          await db.update(users).set({ password: newHash }).where(eq5(users.id, adminUser.id));
          log(`Bootstrap: admin password was reset via ADMIN_PASSWORD_RESET env var`);
        }
      }
      return;
    }
    log("Bootstrap: No users found, creating default account...");
    const hashedPassword = await bcrypt2.hash("test123456", 12);
    const [user] = await db.insert(users).values({
      email: "admin@tradiecatch.com",
      username: "TradieCatch Admin",
      password: hashedPassword
    }).returning();
    await db.insert(settings).values({
      userId: user.id,
      businessName: "TradieCatch",
      autoReplyEnabled: true,
      bookingCalendarEnabled: true,
      bookingSlots: ["8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM"],
      services: DEFAULT_SERVICES,
      twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || "",
      twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || "",
      twilioPhoneNumber: twilioPhone
    });
    await db.insert(smsTemplates).values({
      userId: user.id,
      name: "Missed Call Auto-Reply",
      message: "Hi! Sorry we missed your call. We'll get back to you shortly.",
      isDefault: true
    });
    log(`Bootstrap: Created default user (admin@tradiecatch.com) with Twilio number ${twilioPhone}`);
  } catch (err) {
    console.error("Bootstrap error:", err);
  }
}
async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL required for Stripe integration");
    return;
  }
  try {
    log("Initializing Stripe schema...");
    await runMigrations({ databaseUrl, schema: "stripe" });
    log("Stripe schema ready");
    const stripeSync2 = await getStripeSync();
    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
    const webhookResult = await stripeSync2.findOrCreateManagedWebhook(
      `${webhookBaseUrl}/api/stripe/webhook`
    );
    log(`Stripe webhook configured: ${JSON.stringify(webhookResult?.webhook?.url || "ok")}`);
    stripeSync2.syncBackfill().then(() => log("Stripe data synced")).catch((err) => console.error("Error syncing Stripe data:", err));
  } catch (error) {
    console.error("Failed to initialize Stripe:", error);
  }
}
(async () => {
  setupCors(app);
  app.get("/healthz", (_req, res) => {
    res.status(200).send("ok");
  });
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      const signature = req.headers["stripe-signature"];
      if (!signature) {
        return res.status(400).json({ error: "Missing stripe-signature" });
      }
      try {
        const sig = Array.isArray(signature) ? signature[0] : signature;
        if (!Buffer.isBuffer(req.body)) {
          console.error("STRIPE WEBHOOK ERROR: req.body is not a Buffer");
          return res.status(500).json({ error: "Webhook processing error" });
        }
        await WebhookHandlers.processWebhook(req.body, sig);
        res.status(200).json({ received: true });
      } catch (error) {
        console.error("Webhook error:", error.message);
        res.status(400).json({ error: "Webhook processing error" });
      }
    }
  );
  setupBodyParsing(app);
  setupRequestLogging(app);
  configureExpoAndLanding(app);
  const server = await registerRoutes(app);
  setupErrorHandler(app);
  const port = parseInt(process.env.PORT || process.env.CLOUD_RUN_PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true
    },
    () => {
      log(`express server serving on port ${port}`);
      bootstrapDefaultUser().then(() => initStripe()).catch((err) => console.error("Startup init error (non-fatal):", err));
    }
  );
})();
