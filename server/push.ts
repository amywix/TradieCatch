import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data: Record<string, any> = {}
): Promise<void> {
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
      priority: "high",
    };

    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    const result = await res.json();
    if (result?.data?.status === "error") {
      console.error("Push error:", result.data);
      // Clear invalid tokens
      if (
        result.data.details?.error === "DeviceNotRegistered" ||
        result.data.details?.error === "InvalidCredentials"
      ) {
        await db.update(users).set({ pushToken: null }).where(eq(users.id, userId));
      }
    } else {
      console.log(`Push sent to user ${userId}: ${title}`);
    }
  } catch (err) {
    console.error("Failed to send push:", err);
  }
}
