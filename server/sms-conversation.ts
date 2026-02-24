import twilio from "twilio";
import { db } from "./db";
import { missedCalls, jobs, settings, DEFAULT_SERVICES } from "@shared/schema";
import { eq, and } from "drizzle-orm";

async function getSettingsForUser(userId: string) {
  const rows = await db.select().from(settings).where(eq(settings.userId, userId));
  return rows[0];
}

async function getServices(userId: string): Promise<string[]> {
  const s = await getSettingsForUser(userId);
  return (s?.services as string[]) || DEFAULT_SERVICES;
}

async function getBookingConfig(userId: string): Promise<{ enabled: boolean; slots: string[] }> {
  const s = await getSettingsForUser(userId);
  return {
    enabled: s?.bookingCalendarEnabled ?? false,
    slots: (s?.bookingSlots as string[]) || ["8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM"],
  };
}

function getNextAvailableDates(count: number = 5): { label: string; dateStr: string }[] {
  const dates: { label: string; dateStr: string }[] = [];
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const now = new Date();
  let d = new Date(now);
  d.setDate(d.getDate() + 1);
  while (dates.length < count) {
    if (d.getDay() !== 0) {
      dates.push({
        label: `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`,
        dateStr: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      });
    }
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function buildServicesMap(servicesList: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  servicesList.forEach((s, i) => {
    map[String(i + 1)] = s;
  });
  return map;
}

function buildServicesMenuText(servicesList: string[]): string {
  return servicesList.map((s, i) => {
    const label = s.toLowerCase() === "other" ? `${i + 1}. Other (type your issue)` : `${i + 1}. ${s}`;
    return label;
  }).join("\n");
}

async function getTwilioConfig(userId: string) {
  const s = await getSettingsForUser(userId);
  const sid = s?.twilioAccountSid || process.env.TWILIO_ACCOUNT_SID || "";
  const token = s?.twilioAuthToken || process.env.TWILIO_AUTH_TOKEN || "";
  const phone = s?.twilioPhoneNumber || process.env.TWILIO_PHONE_NUMBER || "";
  return { sid, token, phone, businessName: s?.businessName || "Your Local Sparky" };
}

function addLogEntry(log: Array<{role: string; message: string; timestamp: string}>, role: string, message: string) {
  log.push({ role, message, timestamp: new Date().toISOString() });
  return log;
}

export async function sendSms(to: string, body: string, userId: string): Promise<void> {
  const { sid, token, phone } = await getTwilioConfig(userId);
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

export async function sendInitialMissedCallSms(callId: string, userId: string): Promise<void> {
  const rows = await db.select().from(missedCalls).where(eq(missedCalls.id, callId));
  const call = rows[0];
  if (!call) throw new Error("Call not found");

  const { businessName } = await getTwilioConfig(userId);
  const servicesList = await getServices(userId);
  const menuText = buildServicesMenuText(servicesList);

  const message = `Hi! Sorry we missed your call!\nThis is ${businessName}.\n\nCan we grab your name to get started?`;

  await sendSms(call.phoneNumber, message, userId);

  let log = (call.conversationLog || []) as Array<{role: string; message: string; timestamp: string}>;
  addLogEntry(log, "business", message);

  await db.update(missedCalls).set({
    replied: true,
    repliedAt: new Date(),
    conversationState: "awaiting_name",
    conversationLog: log,
  }).where(eq(missedCalls.id, callId));
}

async function findUserByTwilioNumber(toPhone: string): Promise<string | null> {
  const allSettings = await db.select().from(settings);
  for (const s of allSettings) {
    const twilioNum = s.twilioPhoneNumber || "";
    if (twilioNum && phonesMatch(twilioNum, toPhone)) {
      return s.userId;
    }
  }
  return null;
}

export async function handleIncomingReply(fromPhone: string, body: string, toPhone: string): Promise<string | null> {
  const normalizedPhone = normalizePhone(fromPhone);

  let userId: string | null = null;

  if (toPhone) {
    userId = await findUserByTwilioNumber(toPhone);
  }

  let rows;
  if (userId) {
    rows = await db.select().from(missedCalls)
      .where(and(eq(missedCalls.userId, userId), eq(missedCalls.phoneNumber, normalizedPhone)));

    if (rows.length === 0) {
      const allCalls = await db.select().from(missedCalls).where(eq(missedCalls.userId, userId));
      rows = allCalls.filter(c => phonesMatch(c.phoneNumber, normalizedPhone));
    }
  } else {
    rows = await db.select().from(missedCalls)
      .where(eq(missedCalls.phoneNumber, normalizedPhone));

    if (rows.length === 0) {
      const allCalls = await db.select().from(missedCalls);
      rows = allCalls.filter(c => phonesMatch(c.phoneNumber, normalizedPhone));
    }
  }

  let call = rows.find(c => c.conversationState !== "none" && c.conversationState !== "completed");

  if (!call) {
    const allByPhone = rows.filter(c => c.replied);
    if (allByPhone.length > 0) {
      call = allByPhone[allByPhone.length - 1];
    }
  }

  if (!call) {
    console.log(`No matching call found for phone: "${fromPhone}" (normalized: "${normalizedPhone}")`);
    return null;
  }

  const callUserId = call.userId;

  const reply = body.trim();
  let log = (call.conversationLog || []) as Array<{role: string; message: string; timestamp: string}>;
  addLogEntry(log, "customer", reply);

  const state = call.conversationState;
  let response = "";
  let newState = state;
  let updates: Record<string, any> = {};

  const servicesList = await getServices(callUserId);
  const SERVICES = buildServicesMap(servicesList);
  const maxChoice = servicesList.length;
  const choiceRegex = new RegExp(`[^1-${maxChoice}]`, "g");

  switch (state) {
    case "awaiting_name": {
      updates.callerName = reply;
      const menuText = buildServicesMenuText(servicesList);
      response = `Thanks ${reply}! What can we help you with today?\n\nReply with the number below:\n\n${menuText}`;
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
          response = `Thanks for letting us know.\nIs this an emergency right now?\n\nReply YES if urgent or NO if it can wait.\n\nIf urgent, we'll prioritise your job immediately.`;
          newState = "awaiting_urgency";
        } else if (serviceLower === "other") {
          response = `No worries! Please type a brief description of what you need help with and we'll get back to you.`;
          newState = "awaiting_other_description";
        } else {
          response = `Great! ${service}.\n\nWhat's the address for the job?`;
          newState = "awaiting_address";
        }
      } else {
        const menuText = buildServicesMenuText(servicesList);
        response = `Sorry, I didn't catch that. Please reply with a number from 1-${maxChoice}:\n\n${menuText}`;
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
          response = `Thanks! What day works best for you?\n\n${dateMenu}`;
          newState = "awaiting_booking_date";
        } else {
          response = `Thanks! And what's the best time:\n1. Morning\n2. Afternoon\n3. ASAP`;
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
        response = `Great, ${dates[idx].label}!\n\nWhat time suits you?\n\n${slotMenu}`;
        newState = "awaiting_booking_slot";
      } else {
        const dateMenu = dates.map((d, i) => `${i + 1}. ${d.label}`).join("\n");
        response = `Please reply with a number from 1-${dates.length}:\n\n${dateMenu}`;
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
        const matchedDate = dates.find(d => d.label === dateLabel);
        const dateStr = matchedDate?.dateStr || new Date().toISOString().split("T")[0];

        updates.selectedTime = `${dateLabel} ${timeSlot}`;

        const { businessName } = await getTwilioConfig(callUserId);
        response = `Booked! ${dateLabel} at ${timeSlot}.\n\nWe've confirmed your appointment.${call.isUrgent || updates.isUrgent ? "\n\nMarked as urgent - we'll prioritise this." : ""}\n\n- ${businessName}`;
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
          isUrgent: call.isUrgent || updates.isUrgent || false,
        });

        updates.jobBooked = true;
      } else {
        const slotMenu = booking.slots.map((s, i) => `${i + 1}. ${s}`).join("\n");
        response = `Please reply with a number from 1-${booking.slots.length}:\n\n${slotMenu}`;
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
      response = `Thanks! We've received your request.\n\nOur team will confirm your booking shortly.${call.isUrgent || updates.isUrgent ? "\n\nIf urgent, we'll call you ASAP." : ""}\n\n- ${businessName}`;
      newState = "completed";

      const today = new Date();
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
        status: (call.isUrgent || updates.isUrgent) ? "confirmed" : "pending",
        missedCallId: call.id,
        isUrgent: call.isUrgent || updates.isUrgent || false,
      });

      updates.jobBooked = true;
      break;
    }

    case "completed": {
      const { businessName } = await getTwilioConfig(callUserId);
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
    await sendSms(call.phoneNumber, response, callUserId);
  }

  await db.update(missedCalls).set({
    ...updates,
    conversationState: newState,
    conversationLog: log,
  }).where(eq(missedCalls.id, call.id));

  return response;
}

function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-()]/g, "");
  return cleaned;
}

function phonesMatch(a: string, b: string): boolean {
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
