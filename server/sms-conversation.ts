import twilio from "twilio";
import { db } from "./db";
import { missedCalls, jobs, settings } from "@shared/schema";
import { eq } from "drizzle-orm";

const SERVICES: Record<string, string> = {
  "1": "Power point install / repair",
  "2": "Ceiling fan install",
  "3": "Lights not working",
  "4": "Switchboard issue",
  "5": "Power outage / urgent fault",
  "6": "Smoke alarm install",
  "7": "Other",
};

async function getTwilioConfig() {
  const rows = await db.select().from(settings).where(eq(settings.id, "default"));
  const s = rows[0];
  const sid = s?.twilioAccountSid || process.env.TWILIO_ACCOUNT_SID || "";
  const token = s?.twilioAuthToken || process.env.TWILIO_AUTH_TOKEN || "";
  const phone = s?.twilioPhoneNumber || process.env.TWILIO_PHONE_NUMBER || "";
  return { sid, token, phone, businessName: s?.businessName || "Your Local Sparky" };
}

function addLogEntry(log: Array<{role: string; message: string; timestamp: string}>, role: string, message: string) {
  log.push({ role, message, timestamp: new Date().toISOString() });
  return log;
}

export async function sendSms(to: string, body: string): Promise<void> {
  const { sid, token, phone } = await getTwilioConfig();
  if (!sid || !token || !phone) {
    throw new Error("Twilio credentials not configured. Please set them up in Settings.");
  }
  const client = twilio(sid, token);
  try {
    await client.messages.create({
      body,
      from: phone,
      to,
    });
    console.log(`SMS sent to ${to}: ${body.substring(0, 50)}...`);
  } catch (err) {
    console.error("Failed to send SMS:", err);
    throw err;
  }
}

export async function sendInitialMissedCallSms(callId: string): Promise<void> {
  const rows = await db.select().from(missedCalls).where(eq(missedCalls.id, callId));
  const call = rows[0];
  if (!call) throw new Error("Call not found");

  const { businessName } = await getTwilioConfig();

  const message = `Hi! Sorry we missed your call!\nThis is ${businessName}\nWhat can we help you with today?\n\nReply with the number below:\n\n1. Power point install / repair\n2. Ceiling fan install\n3. Lights not working\n4. Switchboard issue\n5. Power outage / urgent fault\n6. Smoke alarm install\n7. Other (type your issue)`;

  await sendSms(call.phoneNumber, message);

  let log = (call.conversationLog || []) as Array<{role: string; message: string; timestamp: string}>;
  addLogEntry(log, "business", message);

  await db.update(missedCalls).set({
    replied: true,
    repliedAt: new Date(),
    conversationState: "awaiting_service",
    conversationLog: log,
  }).where(eq(missedCalls.id, callId));
}

export async function handleIncomingReply(fromPhone: string, body: string): Promise<string | null> {
  const normalizedPhone = normalizePhone(fromPhone);

  const rows = await db.select().from(missedCalls)
    .where(eq(missedCalls.phoneNumber, normalizedPhone));

  let call = rows.find(c => c.conversationState !== "none" && c.conversationState !== "completed");

  if (!call) {
    const allByPhone = rows.filter(c => c.replied);
    if (allByPhone.length > 0) {
      call = allByPhone[allByPhone.length - 1];
    }
  }

  if (!call) return null;

  const reply = body.trim();
  let log = (call.conversationLog || []) as Array<{role: string; message: string; timestamp: string}>;
  addLogEntry(log, "customer", reply);

  const state = call.conversationState;
  let response = "";
  let newState = state;
  let updates: Record<string, any> = {};

  switch (state) {
    case "awaiting_service": {
      const choice = reply.replace(/[^1-7]/g, "");
      if (choice && SERVICES[choice]) {
        const service = SERVICES[choice];
        updates.selectedService = service;

        if (choice === "5") {
          response = `Thanks for letting us know.\nIs this an emergency right now?\n\nReply YES if urgent or NO if it can wait.\n\nIf urgent, we'll prioritise your job immediately.`;
          newState = "awaiting_urgency";
        } else if (choice === "2") {
          response = `Great! Ceiling fan install.\n\nIs this:\nA) New install (no existing fan)\nB) Replacement of old fan\n\nPlease reply A or B.`;
          newState = "awaiting_sub_option";
        } else if (choice === "7") {
          response = `No worries! Please type a brief description of what you need help with and we'll get back to you.`;
          newState = "awaiting_other_description";
        } else {
          response = `Great! ${service}.\n\nWhat's the address for the job?`;
          newState = "awaiting_address";
        }
      } else {
        response = `Sorry, I didn't catch that. Please reply with a number from 1-7:\n\n1. Power point install / repair\n2. Ceiling fan install\n3. Lights not working\n4. Switchboard issue\n5. Power outage / urgent fault\n6. Smoke alarm install\n7. Other (type your issue)`;
        newState = "awaiting_service";
      }
      break;
    }

    case "awaiting_sub_option": {
      const option = reply.toUpperCase().replace(/[^AB]/g, "");
      if (option === "A" || option === "B") {
        const subDesc = option === "A" ? "New install (no existing fan)" : "Replacement of old fan";
        updates.selectedSubOption = subDesc;
        response = `Perfect! ${subDesc}.\n\nWhat's the address for the job?`;
        newState = "awaiting_address";
      } else {
        response = `Please reply A or B:\n\nA) New install (no existing fan)\nB) Replacement of old fan`;
        newState = "awaiting_sub_option";
      }
      break;
    }

    case "awaiting_urgency": {
      const upper = reply.toUpperCase();
      if (upper.includes("YES") || upper.includes("URGENT") || upper.includes("ASAP")) {
        updates.isUrgent = true;
        response = `We're treating this as urgent. Our team will call you ASAP.\n\nWhat's the address so we can head your way?`;
        newState = "awaiting_address";
      } else if (upper.includes("NO") || upper.includes("WAIT") || upper.includes("LATER")) {
        updates.isUrgent = false;
        response = `No worries, we'll schedule you in.\n\nWhat's the address for the job?`;
        newState = "awaiting_address";
      } else {
        response = `Please reply YES if this is urgent, or NO if it can wait.`;
        newState = "awaiting_urgency";
      }
      break;
    }

    case "awaiting_other_description": {
      updates.selectedService = `Other: ${reply}`;
      response = `Got it!\n\nWhat's the address for the job?`;
      newState = "awaiting_address";
      break;
    }

    case "awaiting_address": {
      updates.jobAddress = reply;
      response = `And what's the best time:\n1. Morning\n2. Afternoon\n3. ASAP`;
      newState = "awaiting_time";
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

      const { businessName } = await getTwilioConfig();
      response = `Thanks! We've received your request.\n\nOur team will confirm your booking shortly.${call.isUrgent || updates.isUrgent ? "\n\nIf urgent, we'll call you ASAP." : ""}\n\n- ${businessName}`;
      newState = "completed";

      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

      await db.insert(jobs).values({
        callerName: call.callerName,
        phoneNumber: call.phoneNumber,
        jobType: call.selectedService || updates.selectedService || "General",
        date: dateStr,
        time: timeLabel,
        address: call.jobAddress || updates.jobAddress || "",
        notes: call.selectedSubOption || updates.selectedSubOption || "",
        status: (call.isUrgent || updates.isUrgent) ? "confirmed" : "pending",
        missedCallId: call.id,
        isUrgent: call.isUrgent || updates.isUrgent || false,
      });

      updates.jobBooked = true;
      break;
    }

    case "completed": {
      const { businessName } = await getTwilioConfig();
      response = `Thanks for your message! Your booking is already logged. Our team will be in touch shortly.\n\n- ${businessName}`;
      newState = "completed";
      break;
    }

    default: {
      response = null as any;
    }
  }

  if (response) {
    addLogEntry(log, "business", response);
    await sendSms(call.phoneNumber, response);
  }

  await db.update(missedCalls).set({
    ...updates,
    conversationState: newState,
    conversationLog: log,
  }).where(eq(missedCalls.id, call.id));

  return response;
}

function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/\s/g, "");
  return cleaned;
}
