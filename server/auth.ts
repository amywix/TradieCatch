import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "./db";
import { users, settings, smsTemplates, DEFAULT_SERVICES } from "@shared/schema";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET || "tradiecatch-jwt-secret-change-in-production";
const JWT_EXPIRES_IN = "30d";

export interface AuthRequest extends Request {
  userId?: string;
}

function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export async function register(req: Request, res: Response) {
  const { email, password, username } = req.body;

  if (!email || !password || !username) {
    return res.status(400).json({ error: "Email, username, and password are required" });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  try {
    const existingEmail = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()));
    if (existingEmail.length > 0) {
      return res.status(400).json({ error: "An account with this email already exists" });
    }

    const existingUsername = await db.select().from(users).where(eq(users.username, username.trim()));
    if (existingUsername.length > 0) {
      return res.status(400).json({ error: "This username is already taken" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const [user] = await db.insert(users).values({
      email: email.toLowerCase().trim(),
      username: username.trim(),
      password: hashedPassword,
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
      twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || "",
    });

    await db.insert(smsTemplates).values({
      userId: user.id,
      name: "Missed Call Auto-Reply",
      message: "Hi! Sorry we missed your call. We'll get back to you shortly.",
      isDefault: true,
    });

    const token = generateToken(user.id);

    res.json({
      token,
      user: { id: user.id, email: user.email, username: user.username },
    });
  } catch (err: any) {
    console.error("Registration error:", err);
    res.status(500).json({ error: "Registration failed. Please try again." });
  }
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()));

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
      user: { id: user.id, email: user.email, username: user.username },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed. Please try again." });
  }
}

export async function getMe(req: AuthRequest, res: Response) {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.userId!));
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ id: user.id, email: user.email, username: user.username });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user" });
  }
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
