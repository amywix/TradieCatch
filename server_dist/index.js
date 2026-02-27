var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import express from "express";

// server/routes.ts
import { createServer } from "node:http";

// server/db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

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
var users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var missedCalls = pgTable("missed_calls", {
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
  conversationLog: jsonb("conversation_log").$type().default([])
});
var jobs = pgTable("jobs", {
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
var smsTemplates = pgTable("sms_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  message: text("message").notNull(),
  isDefault: boolean("is_default").default(false).notNull()
});
var DEFAULT_SERVICES = [
  "Power point install / repair",
  "Ceiling fan install",
  "Lights not working",
  "Switchboard issue",
  "Power outage / urgent fault",
  "Smoke alarm install",
  "Other"
];
var settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  businessName: text("business_name").default("").notNull(),
  autoReplyEnabled: boolean("auto_reply_enabled").default(true).notNull(),
  onboardingComplete: boolean("onboarding_complete").default(false).notNull(),
  twilioAccountSid: text("twilio_account_sid").default(""),
  twilioAuthToken: text("twilio_auth_token").default(""),
  twilioPhoneNumber: text("twilio_phone_number").default(""),
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
  ])
});
var insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true
});

// server/db.ts
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}
var pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});
var db = drizzle(pool, { schema: schema_exports });

// server/routes.ts
import { sql as rawSql } from "drizzle-orm";
import { eq as eq3, desc as desc2, and as and2 } from "drizzle-orm";

// server/sms-conversation.ts
import twilio from "twilio";
import { eq, and, desc } from "drizzle-orm";
async function getSettingsForUser(userId) {
  const rows = await db.select().from(settings).where(eq(settings.userId, userId));
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
    slots: s?.bookingSlots || ["8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM"]
  };
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
  return { sid, token, phone, businessName: s?.businessName || "Your Local Sparky" };
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
  const rows = await db.select().from(missedCalls).where(eq(missedCalls.id, callId));
  const call = rows[0];
  if (!call) throw new Error("Call not found");
  const { businessName } = await getTwilioConfig(userId);
  const servicesList = await getServices(userId);
  const menuText = buildServicesMenuText(servicesList);
  const message = `Hi! Sorry we missed your call!
This is ${businessName}.

Can we grab your name to get started?`;
  await sendSms(call.phoneNumber, message, userId);
  let log2 = call.conversationLog || [];
  addLogEntry(log2, "business", message);
  await db.update(missedCalls).set({
    replied: true,
    repliedAt: /* @__PURE__ */ new Date(),
    conversationState: "awaiting_name",
    conversationLog: log2
  }).where(eq(missedCalls.id, callId));
}
async function findUserByTwilioNumber(toPhone) {
  const allSettings = await db.select().from(settings);
  for (const s of allSettings) {
    const twilioNum = s.twilioPhoneNumber || "";
    if (twilioNum && phonesMatch(twilioNum, toPhone)) {
      return s.userId;
    }
  }
  return null;
}
async function handleIncomingReply(fromPhone, body, toPhone) {
  const normalizedPhone = normalizePhone(fromPhone);
  let userId = null;
  if (toPhone) {
    userId = await findUserByTwilioNumber(toPhone);
  }
  let rows;
  if (userId) {
    rows = await db.select().from(missedCalls).where(and(eq(missedCalls.userId, userId), eq(missedCalls.phoneNumber, normalizedPhone))).orderBy(desc(missedCalls.timestamp));
    if (rows.length === 0) {
      const allCalls = await db.select().from(missedCalls).where(eq(missedCalls.userId, userId));
      rows = allCalls.filter((c) => phonesMatch(c.phoneNumber, normalizedPhone));
    }
  } else {
    rows = await db.select().from(missedCalls).where(eq(missedCalls.phoneNumber, normalizedPhone)).orderBy(desc(missedCalls.timestamp));
    if (rows.length === 0) {
      const allCalls = await db.select().from(missedCalls);
      rows = allCalls.filter((c) => phonesMatch(c.phoneNumber, normalizedPhone));
    }
  }
  const activeCalls = rows.filter((c) => c.conversationState !== "none" && c.conversationState !== "completed");
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
          const dates = getNextAvailableDates(5);
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
      const dates = getNextAvailableDates(5);
      const dateChoice = reply.replace(/[^1-5]/g, "");
      const idx = parseInt(dateChoice, 10) - 1;
      if (idx >= 0 && idx < dates.length) {
        updates.selectedTime = dates[idx].label;
        const booking = await getBookingConfig(callUserId);
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
  }).where(eq(missedCalls.id, call.id));
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

// server/auth.ts
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq as eq2 } from "drizzle-orm";
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
    const existingEmail = await db.select().from(users).where(eq2(users.email, email.toLowerCase().trim()));
    if (existingEmail.length > 0) {
      return res.status(400).json({ error: "An account with this email already exists" });
    }
    const existingUsername = await db.select().from(users).where(eq2(users.username, username.trim()));
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
      services: DEFAULT_SERVICES
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
    const [user] = await db.select().from(users).where(eq2(users.email, email.toLowerCase().trim()));
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
    const [user] = await db.select().from(users).where(eq2(users.id, req.userId));
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
var connectionSettings;
async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY ? "repl " + process.env.REPL_IDENTITY : process.env.WEB_REPL_RENEWAL ? "depl " + process.env.WEB_REPL_RENEWAL : null;
  if (!xReplitToken) {
    throw new Error("X_REPLIT_TOKEN not found for repl/depl");
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
  connectionSettings = data.items?.[0];
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
    const rows = await db.select().from(missedCalls).where(eq3(missedCalls.userId, req.userId)).orderBy(desc2(missedCalls.timestamp));
    res.json(rows);
  });
  app2.post("/api/missed-calls", requireAuth, async (req, res) => {
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
  });
  app2.delete("/api/missed-calls/:id", requireAuth, async (req, res) => {
    const id = paramId(req);
    await db.delete(missedCalls).where(
      and2(eq3(missedCalls.id, id), eq3(missedCalls.userId, req.userId))
    );
    res.json({ ok: true });
  });
  app2.post("/api/missed-calls/:id/send-sms", requireAuth, async (req, res) => {
    const id = paramId(req);
    try {
      const [call] = await db.select().from(missedCalls).where(
        and2(eq3(missedCalls.id, id), eq3(missedCalls.userId, req.userId))
      );
      if (!call) return res.status(404).json({ error: "Call not found" });
      await sendInitialMissedCallSms(id, req.userId);
      const [updated] = await db.select().from(missedCalls).where(eq3(missedCalls.id, id));
      res.json(updated);
    } catch (err) {
      console.error("Send SMS error:", err);
      res.status(500).json({ error: err.message || "Failed to send SMS" });
    }
  });
  app2.get("/api/missed-calls/:id", requireAuth, async (req, res) => {
    const id = paramId(req);
    const [call] = await db.select().from(missedCalls).where(
      and2(eq3(missedCalls.id, id), eq3(missedCalls.userId, req.userId))
    );
    if (!call) return res.status(404).json({ error: "Not found" });
    res.json(call);
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
    let userId = null;
    let settingsRow = null;
    try {
      const allSettings = await db.select().from(settings);
      const configuredNumbers = allSettings.map((s) => s.twilioPhoneNumber || "(empty)");
      console.log(`Looking for Twilio number ${to} among configured numbers: ${JSON.stringify(configuredNumbers)}`);
      settingsRow = allSettings.find((s) => {
        const twilioNum = s.twilioPhoneNumber || "";
        return phonesMatchSimple(twilioNum, to);
      });
      if (!settingsRow) {
        console.log(`No user found for Twilio number: ${to}`);
        res.set("Content-Type", "text/xml");
        res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">Sorry, this number is not configured.</Say><Hangup/></Response>`);
        return;
      }
      userId = settingsRow.userId;
      const existingCalls = await db.select().from(missedCalls).where(and2(eq3(missedCalls.userId, userId), eq3(missedCalls.phoneNumber, from))).orderBy(desc2(missedCalls.timestamp)).limit(1);
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1e3);
      const isDuplicate = existingCalls.length > 0 && new Date(existingCalls[0].timestamp) > fiveMinAgo;
      if (!isDuplicate) {
        const [newCall] = await db.insert(missedCalls).values({
          userId,
          callerName: callerName || "Unknown Caller",
          phoneNumber: from,
          timestamp: /* @__PURE__ */ new Date()
        }).returning();
        console.log(`Missed call logged for user ${userId}: ${from} (id: ${newCall.id})`);
        if (settingsRow?.autoReplyEnabled) {
          try {
            await sendInitialMissedCallSms(newCall.id, userId);
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
  app2.get("/api/jobs", requireAuth, async (req, res) => {
    const rows = await db.select().from(jobs).where(eq3(jobs.userId, req.userId)).orderBy(desc2(jobs.createdAt));
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
        and2(eq3(missedCalls.id, missedCallId), eq3(missedCalls.userId, req.userId))
      );
    }
    res.json(job);
  });
  app2.patch("/api/jobs/:id", requireAuth, async (req, res) => {
    const id = paramId(req);
    const [job] = await db.update(jobs).set(req.body).where(
      and2(eq3(jobs.id, id), eq3(jobs.userId, req.userId))
    ).returning();
    res.json(job);
  });
  app2.delete("/api/jobs/:id", requireAuth, async (req, res) => {
    const id = paramId(req);
    await db.delete(jobs).where(
      and2(eq3(jobs.id, id), eq3(jobs.userId, req.userId))
    );
    res.json({ ok: true });
  });
  app2.get("/api/services", requireAuth, async (req, res) => {
    const [row] = await db.select().from(settings).where(eq3(settings.userId, req.userId));
    const services = row?.services || DEFAULT_SERVICES;
    res.json(services);
  });
  app2.put("/api/services", requireAuth, async (req, res) => {
    const { services: newServices } = req.body;
    if (!Array.isArray(newServices) || newServices.length === 0) {
      return res.status(400).json({ error: "Services must be a non-empty array" });
    }
    const cleaned = newServices.map((s) => s.trim()).filter((s) => s.length > 0);
    const [row] = await db.update(settings).set({ services: cleaned }).where(eq3(settings.userId, req.userId)).returning();
    res.json(row.services || cleaned);
  });
  app2.get("/api/settings", requireAuth, async (req, res) => {
    const [row] = await db.select().from(settings).where(eq3(settings.userId, req.userId));
    res.json(row || { id: "default", userId: req.userId, businessName: "", autoReplyEnabled: true, services: DEFAULT_SERVICES });
  });
  app2.patch("/api/settings", requireAuth, async (req, res) => {
    const existing = await db.select().from(settings).where(eq3(settings.userId, req.userId));
    if (existing.length === 0) {
      const [row2] = await db.insert(settings).values({
        userId: req.userId,
        businessName: req.body.businessName || "",
        autoReplyEnabled: req.body.autoReplyEnabled !== void 0 ? req.body.autoReplyEnabled : true
      }).returning();
      return res.json(row2);
    }
    const [row] = await db.update(settings).set(req.body).where(eq3(settings.userId, req.userId)).returning();
    res.json(row);
  });
  app2.get("/api/templates", requireAuth, async (req, res) => {
    const rows = await db.select().from(smsTemplates).where(eq3(smsTemplates.userId, req.userId));
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
      and2(eq3(smsTemplates.id, id), eq3(smsTemplates.userId, req.userId))
    ).returning();
    res.json(template);
  });
  app2.delete("/api/templates/:id", requireAuth, async (req, res) => {
    const id = paramId(req);
    await db.delete(smsTemplates).where(
      and2(eq3(smsTemplates.id, id), eq3(smsTemplates.userId, req.userId))
    );
    res.json({ ok: true });
  });
  app2.post("/api/templates/:id/set-default", requireAuth, async (req, res) => {
    const id = paramId(req);
    await db.update(smsTemplates).set({ isDefault: false }).where(
      and2(eq3(smsTemplates.isDefault, true), eq3(smsTemplates.userId, req.userId))
    );
    const [template] = await db.update(smsTemplates).set({ isDefault: true }).where(
      and2(eq3(smsTemplates.id, id), eq3(smsTemplates.userId, req.userId))
    ).returning();
    res.json(template);
  });
  app2.post("/api/stripe/create-checkout", requireAuth, async (req, res) => {
    try {
      const stripe = await getUncachableStripeClient();
      const userId = req.userId;
      const [user] = await db.select().from(users).where(eq3(users.id, userId));
      if (!user) return res.status(404).json({ error: "User not found" });
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { userId }
        });
        await db.update(users).set({ stripeCustomerId: customer.id }).where(eq3(users.id, userId));
        customerId = customer.id;
      }
      const prices = await db.execute(
        rawSql`SELECT id FROM stripe.prices WHERE active = true AND recurring IS NOT NULL ORDER BY unit_amount DESC LIMIT 1`
      );
      if (!prices.rows.length) {
        return res.status(400).json({ error: "No subscription price configured yet" });
      }
      const priceId = prices.rows[0].id;
      const domains = process.env.REPLIT_DOMAINS || "";
      const primaryDomain = domains.split(",")[0]?.trim() || "";
      const baseUrl = primaryDomain ? `https://${primaryDomain}` : `${req.protocol}://${req.get("host")}`;
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: "subscription",
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
        await db.update(users).set({ stripeSubscriptionId: subscriptionId }).where(eq3(users.stripeCustomerId, customerId));
      }
    } catch (err) {
      console.error("Error processing checkout success:", err);
    }
    const domains = process.env.REPLIT_DOMAINS || "";
    const devDomain = process.env.REPLIT_DEV_DOMAIN || "";
    const primaryDomain = domains.split(",")[0]?.trim() || devDomain;
    const appPort = "8081";
    const redirectUrl = devDomain ? `https://${devDomain}:${appPort}/?checkout=success` : `https://${primaryDomain}/?checkout=success`;
    res.redirect(redirectUrl);
  });
  app2.get("/api/stripe/checkout-cancel", async (req, res) => {
    const devDomain = process.env.REPLIT_DEV_DOMAIN || "";
    const domains = process.env.REPLIT_DOMAINS || "";
    const primaryDomain = domains.split(",")[0]?.trim() || devDomain;
    const appPort = "8081";
    const redirectUrl = devDomain ? `https://${devDomain}:${appPort}/?checkout=cancelled` : `https://${primaryDomain}/?checkout=cancelled`;
    res.redirect(redirectUrl);
  });
  app2.get("/api/stripe/subscription-status", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      const [user] = await db.select().from(users).where(eq3(users.id, userId));
      if (!user?.stripeSubscriptionId) {
        return res.json({ active: false, subscription: null });
      }
      const result = await db.execute(
        rawSql`SELECT id, status, current_period_end, cancel_at_period_end FROM stripe.subscriptions WHERE id = ${user.stripeSubscriptionId}`
      );
      if (!result.rows.length) {
        return res.json({ active: false, subscription: null });
      }
      const sub = result.rows[0];
      const active = sub.status === "active" || sub.status === "trialing";
      res.json({
        active,
        subscription: {
          id: sub.id,
          status: sub.status,
          currentPeriodEnd: sub.current_period_end,
          cancelAtPeriodEnd: sub.cancel_at_period_end
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
      const [user] = await db.select().from(users).where(eq3(users.id, userId));
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
import { eq as eq4 } from "drizzle-orm";
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
  app2.use(express.static(path.resolve(process.cwd(), "static-build")));
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
    const allUsers = await db.select().from(users);
    if (allUsers.length > 0) {
      const allSettings = await db.select().from(settings);
      const firstUser = allUsers[0];
      const userSettings = allSettings.find((s) => s.userId === firstUser.id);
      if (userSettings && !userSettings.bookingCalendarEnabled) {
        await db.update(settings).set({
          bookingCalendarEnabled: true,
          bookingSlots: userSettings.bookingSlots || ["8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM"]
        }).where(eq4(settings.userId, firstUser.id));
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
        }).where(eq4(settings.userId, firstUser.id));
        log(`Bootstrap: Updated user ${firstUser.email} with Twilio number ${twilioPhone}`);
      }
      log("Bootstrap: Users exist but Twilio number not matched to any");
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
  const port = parseInt(process.env.PORT || "5000", 10);
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
