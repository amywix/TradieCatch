import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  pushToken: text("push_token"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const missedCalls = pgTable("missed_calls", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
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
  conversationLog: jsonb("conversation_log").$type<Array<{role: string; message: string; timestamp: string}>>().default([]),
  voicemailData: text("voicemail_data"),
  voicemailMimeType: text("voicemail_mime_type"),
  voicemailDurationSeconds: text("voicemail_duration_seconds"),
});

export const jobs = pgTable("jobs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
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
  isUrgent: boolean("is_urgent").default(false),
});

export const smsTemplates = pgTable("sms_templates", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  message: text("message").notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
});

export const DEFAULT_SERVICES = [
  "Power point install / repair",
  "Ceiling fan install",
  "Lights not working",
  "Switchboard issue",
  "Power outage / urgent fault",
  "Smoke alarm install",
  "Other",
];

export const settings = pgTable("settings", {
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
  services: jsonb("services").$type<string[]>().default(DEFAULT_SERVICES),
  bookingCalendarEnabled: boolean("booking_calendar_enabled").default(false).notNull(),
  bookingSlots: jsonb("booking_slots").$type<string[]>().default([
    "8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM",
    "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM"
  ]),
  bookingDates: jsonb("booking_dates").$type<string[]>().default([]),
  tradieMobileNumber: text("tradie_mobile_number").default(""),
  forwardingMode: text("forwarding_mode").default("carrier_forward").notNull(),
  voicemailEnabled: boolean("voicemail_enabled").default(true).notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type MissedCall = typeof missedCalls.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type SmsTemplate = typeof smsTemplates.$inferSelect;
export type Settings = typeof settings.$inferSelect;
