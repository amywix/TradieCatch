# TradieCatch — Complete User Manual

_Last updated: April 2026_

---

## Table of Contents

1. [What is TradieCatch?](#1-what-is-tradiecatch)
2. [Getting Started](#2-getting-started)
3. [Privacy & Terms](#3-privacy--terms)
4. [Setting Up Twilio (Your Phone System)](#4-setting-up-twilio-your-phone-system)
5. [Onboarding Walkthrough](#5-onboarding-walkthrough)
6. [The Calls Tab](#6-the-calls-tab)
7. [How the Automated SMS Bot Works](#7-how-the-automated-sms-bot-works)
8. [Service Area & Travel Radius](#8-service-area--travel-radius)
9. [The Jobs Tab](#9-the-jobs-tab)
10. [The Settings Tab](#10-the-settings-tab)
11. [Managing Your Services](#11-managing-your-services)
12. [Booking Calendar Options](#12-booking-calendar-options)
13. [Voice Greeting Setup](#13-voice-greeting-setup)
14. [SMS Templates](#14-sms-templates)
15. [Subscription & Billing](#15-subscription--billing)
16. [Using TradieCatch on the Web](#16-using-tradiecatch-on-the-web)
17. [Frequently Asked Questions](#17-frequently-asked-questions)

---

## 1. What is TradieCatch?

TradieCatch is an app for tradespeople (electricians, plumbers, etc.) that automatically handles missed calls so you never lose a job lead again.

**Here's what happens when someone calls and you can't answer:**

1. Twilio (your virtual phone number) picks up and plays your greeting
2. The caller can leave a voicemail (optional)
3. TradieCatch instantly sends them an SMS to follow up
4. An automated conversation gathers their name, the job, the address, their email, and a preferred time
5. If the address is inside your travel area, the bot books the job and you get notified
6. If the address is outside your travel area, the bot politely tells the customer and flags it for you to review manually

You don't have to do anything while you're on the tools — the bot handles it all.

---

## 2. Getting Started

### Creating Your Account

1. Open the TradieCatch app (or visit the website if you're using it from a browser)
2. Tap **Get Started**
3. Enter your:
   - Email address
   - Business name (this is what shows in SMS messages to your customers)
   - Password (at least 6 characters)
   - Confirm your password
4. **Tick the box** to agree to the Terms of Service and Privacy Policy. You can tap either link to read them in full before agreeing.
5. Tap **Create Account**

### Logging In

1. Open the app
2. Enter your email and password
3. Tap **Sign In**

Your login is saved — you won't need to sign in again each time you open the app unless you tap Sign Out from Settings.

### What Happens Next

After your account is created, the app will check whether your subscription is active. If it isn't, you'll land on the paywall screen — see [Subscription & Billing](#15-subscription--billing) for how to activate your account.

Once your subscription is active, you'll be walked through onboarding (about 5 steps) to get your Twilio number connected and your service area set up.

---

## 3. Privacy & Terms

When you create your account, you must agree to two documents:

- **Terms of Service** — the rules for using TradieCatch (subscription, billing, lawful use, your obligations under the Spam Act, etc.)
- **Privacy Policy** — what data we collect, how it's stored, and your rights

Both are linked directly on the signup screen, and you can read them anytime from **Settings → About → Terms of Service / Privacy Policy**.

The date you accepted is recorded against your account. If we ever update the terms in a meaningful way, we'll let you know in the app.

A few things worth knowing in plain language:

- **You own your customer data.** Customer phone numbers, addresses, emails, and job details collected via the SMS bot live in your account only. We don't sell or share that data.
- **Twilio costs are separate** from your TradieCatch subscription. You pay Twilio directly for your phone number, SMS, and voice minutes.
- **You're responsible for your messaging** under Australia's Spam Act 2003. Because the bot only replies to people who already called or texted you, you have inferred consent — but it's still your business and your responsibility.
- **Your password** is stored as a one-way encrypted hash. Even we can't see it.

---

## 4. Setting Up Twilio (Your Phone System)

TradieCatch uses **Twilio** to give you a dedicated phone number that handles missed calls and sends SMS messages. You need a Twilio account to use the app.

### Step 1: Create a Twilio Account

1. Go to **twilio.com** and sign up for a free account
2. Verify your email and phone number
3. Complete Twilio's setup steps

### Step 2: Get a Twilio Phone Number

1. In Twilio, go to **Phone Numbers → Manage → Buy a Number**
2. Search for a number in your area (Australian numbers are available)
3. Purchase the number (costs a few dollars per month)

### Step 3: Find Your Credentials

You'll need three things from Twilio:

| What you need | Where to find it |
|---|---|
| **Account SID** | Twilio Console homepage (top left) |
| **Auth Token** | Twilio Console homepage (click to reveal) |
| **Phone Number** | Phone Numbers → Manage → Active Numbers |

### Step 4: Set Up the Webhook URLs

This tells Twilio to notify TradieCatch when a call or SMS comes in.

1. In Twilio, go to **Phone Numbers → Manage → Active Numbers**
2. Click your number
3. Under **Voice & Fax**, set "A Call Comes In" to:
   ```
   https://your-app-url/api/twilio/voice
   ```
4. Under **Messaging**, set "A Message Comes In" to:
   ```
   https://your-app-url/api/twilio/webhook
   ```
5. Save

> **Tip:** Your exact webhook URLs are shown in the app at the end of onboarding and again in **Settings → Twilio Setup**. Just copy and paste them into Twilio.

---

## 5. Onboarding Walkthrough

After your subscription is active, the app walks you through a short setup. There's a Welcome screen, four numbered steps, and a Done screen at the end:

| Screen | What happens |
|---|---|
| **Welcome** | Quick overview of what TradieCatch does |
| **Step 1 — Get Twilio** | Instructions for signing up with Twilio and buying a number |
| **Step 2 — Connect** | Enter your Twilio Account SID, Auth Token, and Phone Number |
| **Step 3 — Business** | Confirm your business name (used in SMS messages to customers) |
| **Step 4 — Service Area** | Enter your base address and travel radius (km). The app geocodes the address so it can later check whether an incoming customer is inside your area. |
| **Done** | Copy your webhook URLs into Twilio to complete setup |

Once onboarding is done, the app is live and ready to handle missed calls. You can change any of these settings later from the Settings tab.

---

## 6. The Calls Tab

This is your main dashboard. Every call that comes in through your Twilio number appears here.

### What You See on Each Call Card

- **Caller name** (collected by the bot once they reply)
- **Phone number**
- **Time** the call came in
- **Status badges:**
  - **Unreplied** — no SMS sent yet
  - **SMS Sent** — bot has contacted the caller
  - **Job Booked** — a job was created from this call
  - **URGENT** — caller indicated it's an emergency

### Conversation Status

Under each call you can see exactly where the automated conversation is up to:

- "Awaiting reply"
- "Awaiting service selection"
- "Awaiting address"
- "Awaiting email"
- "Booking complete"
- "Out of service area — manual review" _(see [Service Area](#8-service-area--travel-radius))_

### Actions Available

| Button | What it does |
|---|---|
| **Send SMS** | Manually triggers the automated bot for this call |
| **View Chat** | Opens the full SMS conversation history |
| **Book** | Manually create a job for this caller |
| **Delete** | Remove the call from the list |

### Manually Adding a Missed Call

If someone called your personal number instead of your Twilio number, you can log it manually:

1. Tap the **+** button in the top right
2. Enter the caller's name and phone number
3. Tap **Add Call**
4. Then tap **Send SMS** to start the automated conversation

---

## 7. How the Automated SMS Bot Works

When a missed call comes in, the bot sends a series of SMS messages to the caller to gather what you need to book a job. Here's the flow:

1. **Greeting** — "Hi! Sorry we missed your call! [Business Name]. Can we grab your name to get started?"
2. **Service selection** — "Thanks [Name]! What can we help you with today?" followed by your numbered list of services
3. **Urgency** _(only for service types you've flagged as urgent, like power outages)_ — "Is this an emergency?"
4. **Address** — "What's the address for the job?"
5. **Service-area check** _(automatic, behind the scenes)_:
   - Inside your radius → continues to email
   - Outside your radius → polite "out of service area" message + you get a notification (no job is booked)
6. **Email** — "Almost done! What's the best email address to send confirmation and updates to?"
7. **Booking** — depends on your booking setting (manual time slots, Calendly, or Google Calendar — see [Booking Calendar Options](#12-booking-calendar-options))
8. **Confirmation** — the bot confirms the booking, a job is created in your Jobs tab, and you get a push notification

### What Happens if They Don't Reply?

The conversation stays open. You can pick it up manually from the Calls tab — view the chat, type a reply, or book the job yourself.

---

## 8. Service Area & Travel Radius

This is one of the smartest features in TradieCatch — it stops the bot from booking jobs that are too far away to be worth your time.

### How It Works

- During onboarding (and anytime later in **Settings → Service Area**) you set:
  - Your **base address** (e.g. "12 Smith St, Parramatta NSW 2150")
  - Your **travel radius** in kilometres (e.g. 30)
- When a customer gives an address in the SMS conversation, the app converts it to a location and measures the distance from your base.
- **If the customer is within your radius**, the conversation continues normally → email → booking → job created.
- **If the customer is outside your radius**, the bot sends them a polite message like:
  > "Thanks for the address (about 703km away). That's outside our usual service area, so we can't auto-book this one. We've passed your details to the electrician — they'll review and get back to you directly."
- No job is created in the Jobs tab. The missed call gets the status "Out of service area — manual review" so you can find it easily.
- You get a **push notification** so you know to take a look.

### Editing Your Service Area Later

1. Go to **Settings → Service Area**
2. Tap the edit icon
3. Update the address or radius
4. Tap **Save**

The app re-checks the address when you save. If the address can't be located, you'll see a warning (and the service-area check is automatically disabled until you fix it — so you don't accidentally lose jobs).

### What if I leave the service area blank?

Then the service-area check is off and the bot books every job regardless of distance. That's fine if you travel anywhere — just leave the address empty.

---

## 9. The Jobs Tab

All confirmed bookings appear here, whether they came from the automated bot or you created them manually.

### Filtering Jobs

Tap the filter buttons at the top to view:

- **All** — every job
- **Pending** — waiting to be confirmed
- **Confirmed** — locked in
- **Done** — completed jobs

### What You See on Each Job Card

- Customer name and phone number
- Job type (e.g., "Ceiling fan install")
- Date and time (if collected)
- Address
- Notes
- Email
- Urgent flag if the caller flagged it as an emergency

### Job Actions

| Button | What it does |
|---|---|
| **Change Status** | Cycle through Pending → Confirmed → Completed → Cancelled |
| **Add to Calendar** | Adds the job to your phone's calendar (or Google Calendar on web) |
| **Delete** | Remove the job |

### Manually Creating a Job

1. From the Calls tab, find the missed call
2. Tap **Book**
3. Fill in the job details (type, date, time, address, notes)
4. Tap **Book Job**

---

## 10. The Settings Tab

This is where you configure everything about how TradieCatch works. Sections are listed in the order they appear in the app:

### Business

- **Business name** — shown in SMS messages to customers
- **Tradie mobile number** — your personal number (used for forwarding setup)

### Service Area

- **Base address** + **travel radius (km)** — see [Service Area](#8-service-area--travel-radius)

### Subscription

- Shows your current plan status (Pro / No Active Subscription)
- Tap **Manage** to open the Stripe Customer Portal — update your card, view invoices, or cancel

### Auto-Reply

- **Auto-Reply SMS toggle** — turn the bot on or off

### Twilio Setup

Enter your Twilio credentials and copy your webhook URLs into Twilio.

### Voice Greeting

Customise the message callers hear before they leave a voicemail (text-to-speech, or record your own voice).

### Booking Calendar

Choose how the bot offers time slots — manual, Calendly, or Google Calendar.

### Services

The list of services the bot offers callers — fully editable.

### SMS Templates

Pre-written messages you can send manually from a chat.

### Account

- Change password
- Sign out

### About

- App version
- **Terms of Service** and **Privacy Policy** links

---

## 11. Managing Your Services

The services list is what the bot presents to callers when asking what they need. Customise it to match exactly what you offer.

### Default Services (Electrician example)

1. Power point install / repair
2. Ceiling fan install
3. Lights not working
4. Switchboard issue
5. Power outage / urgent fault
6. Smoke alarm install
7. Other

### Adding a Service

1. Go to **Settings → Services**
2. Tap **Add Service**
3. Type the service name
4. Tap **Save**

### Editing or Deleting

- Tap a service to edit the name
- Use the delete icon to remove

> **Tip:** Keep your most common jobs at the top so callers find them quickly.

---

## 12. Booking Calendar Options

TradieCatch gives you three ways to handle booking times in the SMS conversation.

### Option 1: Manual Time Slots (Default)

The bot asks the caller to choose from time slots you've set (e.g., "Morning", "Afternoon", "ASAP" or specific times).

**To set up:**
1. Settings → Booking Calendar → **Manual**
2. Add your available time slots
3. Optionally add specific available dates

### Option 2: Calendly

The bot sends the caller a link to your Calendly page so they can self-book.

**To set up:**
1. Create a Calendly account (free)
2. Settings → Booking Calendar → **Calendly**
3. Paste your Calendly link

### Option 3: Google Calendar

The bot sends a pre-filled Google Calendar link.

**To set up:**
1. Settings → Booking Calendar → **Google Calendar**
2. Paste your Google Calendar booking link

---

## 13. Voice Greeting Setup

When someone calls your Twilio number, they hear a greeting before voicemail (if voicemail is on).

### Option A: Text-to-Speech (Default)

The app speaks your written message using an automated voice.

1. Settings → Voice Greeting
2. Edit the **Voice Message** field
3. Save

Default message:
> "Sorry we missed your call. We will SMS you now to follow up."

### Option B: Record Your Own Voice

1. Settings → Voice Greeting
2. Tap **Record Greeting**
3. Speak your message
4. Tap **Stop**, then **Play** to listen back
5. Tap **Save Recording** if you're happy

> Your recorded greeting replaces the text-to-speech. To go back to text-to-speech, delete the recording.

---

## 14. SMS Templates

Pre-written messages you can send manually from a chat in the Calls tab.

### Creating a Template

1. Settings → SMS Templates → **Add Template**
2. Give it a name (e.g., "Running Late")
3. Write the message
4. Save

### Using a Template

1. Calls tab → tap **View Chat** on a missed call
2. Tap the template icon in the message composer
3. Choose a template — it fills the message field
4. Edit if needed, then send

---

## 15. Subscription & Billing

TradieCatch uses Stripe for secure payment processing. The flow is intentionally simple:

### How Activation Works

1. Sign up for an account
2. We send you a secure Stripe payment link (via email) tied to your email address
3. Pay through Stripe — takes about a minute
4. Open the app, you'll be on the **Subscription Required** screen
5. Tap **I've Paid — Activate Account**
6. The app talks to Stripe, finds your active subscription, and unlocks your account immediately

If your subscription is already active when you sign up, the app finds it automatically and you skip straight to onboarding.

### Managing Your Subscription

1. **Settings → Subscription**
2. Tap **Manage**
3. The Stripe Customer Portal opens in your browser, where you can:
   - Update your payment method
   - Download invoices
   - **Cancel your subscription** — takes effect at the end of the current billing period

### What Happens if Your Subscription Lapses

If a payment fails or you cancel, the app re-checks your subscription status every time you open it. Once Stripe reports the subscription as inactive, the app sends you back to the Subscription Required screen and the automated features stop working until you resubscribe.

### Cancelling vs. Pausing

There's no "pause" — only cancel. If you cancel, you keep access until the period you've paid for ends, then you're locked out until you subscribe again.

---

## 16. Using TradieCatch on the Web

You don't need to download anything from an app store to get started. TradieCatch runs in any modern browser:

1. Visit your TradieCatch URL on your phone, tablet, or computer
2. Sign up or sign in
3. Use all the same features (calls, jobs, settings, voice greeting, SMS flow)

This means you can sign up customers immediately without waiting for App Store approval. When the iOS app is published, your account and data work the same in both.

---

## 17. Frequently Asked Questions

**Q: Do customers know they're talking to a bot?**
A: The messages are written to sound natural. Most customers simply reply and get booked in without giving it a second thought. If you want to be transparent you can edit the greeting in Settings to mention it's an automated reply.

**Q: What if a customer replies with something unexpected?**
A: The bot handles common variations (e.g., "yes", "yeah", "yep" are all treated the same). If it can't understand a reply, it'll ask the question again. You can always step in manually by viewing the chat and sending your own message.

**Q: Can I use my existing phone number?**
A: No — TradieCatch requires a Twilio number because Twilio is what receives the calls and sends the SMS. The usual approach is to set up call forwarding from your existing number to your Twilio number, so customers can keep calling your normal number.

**Q: What if the bot is halfway through a conversation when I want to take over?**
A: Open the chat in the Calls tab and start typing — your manual messages go through alongside the bot. You can also book the job yourself using the Book button.

**Q: Will I get notified when a job is booked?**
A: Yes — push notification when the bot books a job, and another one when an out-of-area enquiry comes in.

**Q: Can I have more than one Twilio number?**
A: Currently each TradieCatch account is linked to one Twilio number. If you need multiple numbers, contact support.

**Q: What does "URGENT" mean on a call?**
A: If the caller picked an urgent service type (e.g., "Power outage") and confirmed it's an emergency, the call is flagged so you can prioritise it.

**Q: What happens for customers outside my service area?**
A: The bot tells them politely that the address is outside your usual area and that you'll review and get back to them directly. It doesn't book the job. You get a push notification and the call shows up with a "Out of service area — manual review" status. See [Service Area](#8-service-area--travel-radius).

**Q: I set up everything but calls aren't coming through — what do I check?**
A: Run through this checklist:
1. Your Twilio webhook URLs match exactly what's shown in Settings → Twilio Setup
2. You actually saved the webhooks in Twilio (easy to forget)
3. Your Twilio account is active and funded
4. Auto-Reply is turned ON in Settings
5. Your subscription is active

**Q: Can I cancel my subscription anytime?**
A: Yes — Settings → Subscription → Manage → Cancel. You keep access until the end of the period you've already paid for.

**Q: Where can I read the Terms of Service and Privacy Policy?**
A: On the signup screen (tappable links above the Create Account button), or anytime from Settings → About. Both are also available without signing in by tapping the links on the signup screen.

**Q: Can I use this on Android and iPhone?**
A: Yes — TradieCatch runs in a web browser on any device, and is being prepared for the iOS App Store. Android via the App Store is not currently supported on Replit, but the web app works perfectly on Android phones.
