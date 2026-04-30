# TradieCatch — Complete User Manual

---

## Table of Contents

1. [What is TradieCatch?](#1-what-is-tradiecatch)
2. [Getting Started](#2-getting-started)
3. [Setting Up Twilio (Your Phone System)](#3-setting-up-twilio-your-phone-system)
4. [Onboarding Walkthrough](#4-onboarding-walkthrough)
5. [The Missed Calls Tab](#5-the-missed-calls-tab)
6. [How the Automated SMS Bot Works](#6-how-the-automated-sms-bot-works)
7. [The Jobs Tab](#7-the-jobs-tab)
8. [The Settings Tab](#8-the-settings-tab)
9. [Managing Your Services](#9-managing-your-services)
10. [Booking Calendar Options](#10-booking-calendar-options)
11. [Voice Greeting Setup](#11-voice-greeting-setup)
12. [SMS Templates](#12-sms-templates)
13. [Subscription & Billing](#13-subscription--billing)
14. [Frequently Asked Questions](#14-frequently-asked-questions)

---

## 1. What is TradieCatch?

TradieCatch is a mobile app designed for tradespeople (electricians, plumbers, etc.) that automatically handles missed calls so you never lose a job lead again.

**Here's what happens when someone calls and you can't answer:**

1. Twilio (your virtual phone number) picks up and plays your greeting
2. The caller can leave a voicemail
3. TradieCatch instantly sends them an SMS asking for their details
4. An automated conversation gathers their name, job type, address, and preferred time
5. A job is automatically created in your app when the conversation is complete
6. You get notified and can confirm or manage it from the Jobs tab

You don't have to do anything — the bot handles it all while you're on the tools.

---

## 2. Getting Started

### Creating Your Account

1. Open the TradieCatch app
2. Tap **Create Account**
3. Enter your:
   - Email address
   - Business name
   - Password
4. Tap **Create Account**

### Logging In

1. Open the app
2. Enter your email and password
3. Tap **Sign In**

Your login is saved — you won't need to sign in again each time you open the app unless you tap Sign Out.

### Subscription

After creating your account, you'll be prompted to subscribe before using the app. TradieCatch requires an active subscription to enable the automated call and SMS features.

- Tap **Get Started** on the paywall screen to complete payment
- Once subscribed, you'll proceed to the onboarding setup

---

## 3. Setting Up Twilio (Your Phone System)

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

> **Tip:** Your exact webhook URLs are shown in the app under Settings → Twilio Setup. Just copy and paste them into Twilio.

---

## 4. Onboarding Walkthrough

After subscribing, the app walks you through a 5-step setup:

| Step | What happens |
|---|---|
| **Welcome** | Overview of what TradieCatch does |
| **Get Twilio** | Instructions for creating your Twilio account |
| **Connect** | Enter your Twilio Account SID, Auth Token, and Phone Number |
| **Business** | Confirm your business name (used in SMS messages) |
| **Done** | Copy your webhook URLs into Twilio to complete setup |

Once onboarding is done, the app is live and ready to handle missed calls.

---

## 5. The Missed Calls Tab

This is your main dashboard. Every call that comes in through your Twilio number appears here.

### What You See on Each Call Card

- **Caller name** (collected by the bot once they reply)
- **Phone number**
- **Time** the call came in
- **Status badges:**
  - 🔴 **Unreplied** — no SMS sent yet
  - ✅ **SMS Sent** — bot has contacted the caller
  - 🔧 **Job Booked** — a job was created from this call
  - ⚠️ **URGENT** — caller indicated it's an emergency

### Conversation Status

Under each call, you can see exactly where the automated conversation is up to:
- "Awaiting reply"
- "Awaiting service selection"
- "Awaiting address"
- "Booking complete"

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

## 6. How the Automated SMS Bot Works

When a missed call comes in, the bot sends a series of SMS messages to the caller to gather what you need to book a job. Here's exactly what it asks:

### Step-by-Step Bot Flow

**Message 1 — Introduction**
> "Hi! You just called [Business Name]. Sorry we missed you! I'll help get you sorted. What's your name?"

**Message 2 — Service Selection**
> "Thanks [Name]! What do you need help with?
> 1. Power point install / repair
> 2. Ceiling fan install
> 3. Lights not working
> [etc.]"

**Message 3 — Urgency (if applicable)**
> "Is this an emergency?" (only asked for urgent service types like power outages)

**Message 4 — Address**
> "What's the job address?"

**Message 5 — Email (optional)**
> "What's your email address? (Reply SKIP to skip)"

**Message 6 — Booking**
Depends on your booking setting:
- **Manual time slots:** "What time works best? 1. Morning  2. Afternoon  3. ASAP"
- **Calendly:** Sends your Calendly booking link
- **Google Calendar:** Sends your Google Calendar booking link

**Final Message — Confirmation**
> "Perfect, we've got you booked in! We'll be in touch to confirm. Thanks [Name]!"

At this point, a job is automatically created in your **Jobs** tab and you receive a push notification.

### What Happens if They Don't Reply?

The bot waits for a response. If the caller doesn't reply, the conversation stays open — you can manually pick it up or book the job yourself from the Calls tab.

---

## 7. The Jobs Tab

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
- ⚠️ Urgent flag if the caller flagged it as an emergency

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

## 8. The Settings Tab

This is where you configure everything about how TradieCatch works.

### Business Profile

- **Business Name** — shown in SMS messages sent to customers
- **Tradie Mobile Number** — your personal number (for reference only, not used for calls)

### Subscription

- Shows your current plan status
- Tap **Manage Subscription** to update payment details, change your plan, or cancel via the Stripe portal

### Twilio Setup

Enter your Twilio credentials here:
- **Account SID**
- **Auth Token**
- **Phone Number** (your Twilio number, e.g. +61400000000)

Below the fields, you'll see your **Webhook URLs** — copy these into Twilio to connect everything:
- **SMS Webhook:** paste into Twilio under Messaging
- **Voice Webhook:** paste into Twilio under Voice

Tap either URL to copy it to your clipboard.

### Call Handling

**Auto-Reply Toggle**
- Turn this ON to let the bot automatically SMS every missed caller
- Turn it OFF if you want to manually decide which callers get the SMS

**Forwarding Mode**
- **Carrier Forward** — your normal carrier handles call forwarding to Twilio (most common)
- **Twilio Dial** — Twilio forwards the call to another number

**Voicemail Toggle**
- ON — callers hear your greeting and can leave a voicemail after the beep
- OFF — callers hear your greeting and the call ends (no voicemail recording)

---

## 9. Managing Your Services

The services list is what the bot presents to callers when asking what they need. You can customise this to match exactly what you offer.

### Default Services (Electrician example)

1. Power point install / repair
2. Ceiling fan install
3. Lights not working
4. Switchboard issue
5. Power outage / urgent fault
6. Smoke alarm install
7. Other

### Adding a Service

1. Go to **Settings**
2. Scroll to **Services**
3. Tap **Add Service**
4. Type the service name
5. Tap **Save**

### Editing a Service

1. Tap the service name
2. Edit the text
3. Tap **Save**

### Deleting a Service

1. Swipe left on the service (or tap the delete icon)
2. Confirm deletion

### Reordering Services

Press and hold a service, then drag it to the desired position. The order here is the order the bot presents them to callers.

> **Tip:** Keep your most common jobs at the top so callers find them quickly.

---

## 10. Booking Calendar Options

TradieCatch gives you three ways to handle booking time slots in the SMS conversation.

### Option 1: Manual Time Slots

The bot asks the caller to choose from time slots you've set (e.g., "Morning", "Afternoon", "ASAP" or specific times like "9:00 AM").

**To set up:**
1. Go to Settings → Booking Calendar
2. Select **Manual**
3. Add your available time slots (e.g., "8:00 AM", "10:00 AM", "2:00 PM")
4. Optionally add specific available dates

### Option 2: Calendly

The bot sends the caller a link to your Calendly page so they can self-book.

**To set up:**
1. Create a Calendly account at calendly.com (free)
2. Set up your event type with your available times
3. Copy your Calendly link
4. Go to Settings → Booking Calendar → select **Calendly**
5. Paste your link

### Option 3: Google Calendar

The bot sends a pre-filled Google Calendar invite link.

**To set up:**
1. Go to Settings → Booking Calendar → select **Google Calendar**
2. Add your Google Calendar booking link

---

## 11. Voice Greeting Setup

When someone calls your Twilio number, they hear a greeting before the voicemail beep. You have two options:

### Option A: Text-to-Speech (Default)

The app speaks your written message using an automated voice (Alice).

**To customise:**
1. Go to Settings → Voice Greeting
2. Edit the text in the **Voice Message** field
3. Save

Example default message:
> "Sorry we missed your call. We will SMS you now to follow up."

### Option B: Record Your Own Voice

Record a personal greeting in your own voice — callers hear you, not a robot.

**To record:**
1. Go to Settings → Voice Greeting
2. Tap **Record Greeting**
3. Speak your message (e.g., "Hi, you've reached [Business Name]. Sorry I missed your call — I'll SMS you shortly to follow up!")
4. Tap **Stop**
5. Tap **Play** to listen back
6. Tap **Save Recording** if you're happy with it

> **Tip:** Your recorded greeting replaces the text-to-speech. To go back to text-to-speech, delete the recording.

---

## 12. SMS Templates

SMS templates are pre-written messages you can send manually to customers from the Calls tab.

### Viewing Templates

Go to **Settings → SMS Templates** to see all your saved templates.

### Creating a Template

1. Tap **Add Template**
2. Give it a name (e.g., "Running Late")
3. Write the message
4. Tap **Save**

### Using a Template

1. In the Calls tab, tap **View Chat** on a missed call
2. Tap the template icon in the message composer
3. Choose a template — it'll fill the message field
4. Edit if needed, then send

### Default Template

The app comes with a default template pre-installed:
> "Hi! Sorry we missed your call. We'll get back to you shortly."

---

## 13. Subscription & Billing

TradieCatch uses Stripe for secure payment processing.

### How Billing Works

Once you sign up for an account, we'll send you a secure Stripe payment link to start your subscription. Once you've paid, open the app and tap **"I've Paid — Activate Account"** on the subscription screen — your account will unlock immediately.

If your subscription becomes inactive (cancelled or payment fails), the app will return to the subscription screen until billing is restored.

### Managing Your Subscription

1. Go to **Settings → Subscription**
2. Tap **Manage Subscription**
3. This opens the Stripe Customer Portal where you can:
   - Update your payment method
   - View invoices
   - Cancel your subscription

### What Happens if Subscription Lapses

If your subscription becomes inactive, the app will show the paywall screen and the automated features will stop working until you resubscribe.

---

## 14. Frequently Asked Questions

**Q: Do customers know they're talking to a bot?**
A: The messages are written to sound natural, but they don't explicitly say they're from a person. Most customers simply follow along and get booked in without issue.

**Q: What if a customer replies with something unexpected?**
A: The bot handles common variations (e.g., "yes", "yeah", "yep" are all treated the same). If it can't understand a reply, it'll ask the question again. You can always step in manually by viewing the chat and sending your own message.

**Q: Can I use my existing phone number?**
A: No — TradieCatch requires a Twilio number because Twilio is what intercepts the calls and sends the SMS messages. You can set up call forwarding from your existing number to your Twilio number so customers can still call your usual number.

**Q: What if I miss the SMS conversation halfway through?**
A: The conversation stays open. You can view it in the Calls tab and either wait for the customer to reply or manually book the job using the Book button.

**Q: Will I get notified when a job is booked?**
A: Yes — the app sends a push notification when the bot successfully creates a job from a conversation.

**Q: Can I have more than one Twilio number?**
A: Currently each TradieCatch account is linked to one Twilio number. If you need multiple numbers, contact support.

**Q: What does "URGENT" mean on a call?**
A: If the caller selected a service that indicates an emergency (e.g., "Power outage / urgent fault") and confirmed it's an emergency, the call is flagged urgent so you can prioritise it.

**Q: I set up everything but calls aren't coming through — what do I check?**
A: Run through this checklist:
1. Your Twilio webhook URLs match exactly what's shown in the app's Settings
2. You've saved the webhooks in Twilio (easy to forget)
3. Your Twilio account is active and funded
4. Auto-Reply is turned ON in Settings
5. Your subscription is active

**Q: Can I use this on Android and iPhone?**
A: Yes — TradieCatch works on both iOS and Android via Expo Go, and also runs in a web browser.
