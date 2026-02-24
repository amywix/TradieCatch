# TradieCatch

## Overview

TradieCatch is a multi-tenant SaaS mobile application built for tradespeople (electricians) to manage missed calls, automate SMS follow-ups, and book jobs. The app uses Expo/React Native for the frontend with a tab-based navigation system, and an Express.js backend with PostgreSQL for data persistence. It integrates with Twilio for automated SMS conversations that guide callers through service selection and job booking. Each tradie signs up for their own account with isolated data and configures their own Twilio credentials.

The core workflow is:
1. Tradie signs up/logs in to their account
2. A missed call comes in and is logged to the correct tradie's account (identified by their Twilio phone number)
3. An automated SMS conversation is initiated via the tradie's Twilio credentials, guiding the caller through service selection, urgency assessment, address collection, and time preferences
4. Jobs are created from completed conversations
5. The tradie can manage jobs through status workflows (pending → confirmed → completed/cancelled)

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Authentication & Multi-Tenancy
- **Auth**: JWT-based authentication with bcrypt password hashing (`server/auth.ts`)
- **Auth Context**: `lib/auth-context.tsx` provides `useAuth()` hook with login, register, logout, user state
- **Token Storage**: JWT stored in AsyncStorage, included in all API requests via `Authorization: Bearer` header
- **Data Isolation**: All data tables have a `userId` column; all API queries filter by authenticated user
- **Login Screen**: `app/login.tsx` with email/password login and registration
- **Auth Flow**: Unauthenticated users are redirected to `/login` via `AuthGate` in `_layout.tsx`
- **API Endpoints**: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- **Twilio Per-User**: Each user stores their own Twilio credentials in settings; webhooks identify users by their Twilio phone number

### Frontend (Expo/React Native)
- **Framework**: Expo SDK 54 with React Native 0.81, using expo-router v6 for file-based routing
- **Navigation**: Tab-based layout with three tabs (Calls, Jobs, Settings) plus modal screens for booking jobs, sending SMS, adding calls, and editing templates
- **State Management**: React Context (`DataProvider` in `lib/data-context.tsx`) wraps the app and provides all data operations. DataProvider only fetches data when user is authenticated. TanStack React Query is available for query caching via `lib/query-client.ts`
- **Auth Headers**: `lib/query-client.ts` automatically includes JWT token in all API requests via `getAuthHeaders()`
- **Fonts**: Inter font family (400, 500, 600, 700 weights) via `@expo-google-fonts/inter`
- **Styling**: StyleSheet-based with a centralized color palette in `constants/colors.ts`. The app uses a professional dark blue + orange accent color scheme
- **Platform Support**: Primarily targets iOS and Android with web compatibility. Platform-specific adjustments exist throughout (safe area insets, keyboard handling, SMS URL schemes)
- **Key Libraries**: react-native-gesture-handler, react-native-reanimated, react-native-keyboard-controller, expo-haptics for tactile feedback, expo-image-picker, expo-location

### Backend (Express.js)
- **Server**: Express v5 running as a Node.js server (`server/index.ts`)
- **API Pattern**: RESTful JSON API under `/api/` prefix with routes defined in `server/routes.ts`
- **Auth Middleware**: `requireAuth` middleware validates JWT and sets `req.userId` for all protected routes
- **Build**: Uses esbuild for production server bundling, tsx for development
- **CORS**: Dynamic CORS configuration supporting Replit domains and localhost development, allows Authorization header
- **Key Endpoints** (all except auth and config require authentication):
  - `POST /api/auth/register` - User registration (public)
  - `POST /api/auth/login` - User login (public)
  - `GET /api/auth/me` - Get current user (authenticated)
  - `GET /api/config` - App config including webhook URLs (public)
  - `GET/POST/DELETE /api/missed-calls` - CRUD for missed calls (scoped to user)
  - `POST /api/missed-calls/:id/send-sms` - Trigger automated SMS conversation
  - `GET/POST/PATCH/DELETE /api/jobs` - CRUD for jobs (scoped to user)
  - `GET/POST/PATCH/DELETE /api/templates` - Manage SMS templates (scoped to user)
  - `GET/PATCH /api/settings` - App settings (scoped to user)
  - `GET/PUT /api/services` - Manage services list (scoped to user)
  - `POST /api/twilio/webhook` - Twilio SMS webhook (identifies user by phone number)
  - `POST /api/twilio/voice` - Twilio voice webhook (identifies user by phone number)

### Database (PostgreSQL + Drizzle ORM)
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema** (`shared/schema.ts`):
  - `users` - User accounts (id, username, email, password, createdAt)
  - `missed_calls` - Core table with `userId` FK, conversation state machine fields
  - `jobs` - Booked jobs with `userId` FK, type, date, time, address, status, urgency
  - `sms_templates` - Customizable SMS templates with `userId` FK
  - `settings` - Per-user business configuration with unique `userId` constraint (name, Twilio creds, auto-reply toggle, services, bookingCalendarEnabled, bookingSlots)
- **Migrations**: Managed via `drizzle-kit push` command
- **Validation**: Uses `drizzle-zod` for schema-to-Zod validation
- **Seeding**: Default templates and settings are created per-user during registration

### SMS Conversation Engine (`server/sms-conversation.ts`)
- Implements a state machine for automated SMS conversations with callers
- States: none → awaiting_name → awaiting_service → awaiting_sub_option → awaiting_urgency → awaiting_other_description → awaiting_address → awaiting_email → awaiting_booking_date → awaiting_booking_slot → awaiting_time → completed
- When `bookingCalendarEnabled` is true, after address collection the flow branches to date/slot selection instead of Morning/Afternoon/ASAP
- Services are **dynamic** - stored in the `settings.services` JSONB column and editable from the Settings screen
- Services containing "urgent"/"emergency"/"power outage" in the name trigger the urgency flow
- A service named "Other" (case-insensitive) triggers the free-text description flow
- Collects customer name, service details, urgency, address, email, and preferred time
- Automatically creates jobs from completed conversations

### Services Management
- Services are stored as a JSONB array in the `settings` table (`services` column)
- Default services: Power point install/repair, Ceiling fan install, Lights not working, Switchboard issue, Power outage/urgent fault, Smoke alarm install, Other
- API: `GET /api/services` and `PUT /api/services` (body: `{ services: string[] }`)
- Frontend: Editable in Settings screen with add, edit, delete, and reorder capabilities

### Local Storage Fallback (`lib/storage.ts`)
- AsyncStorage-based local storage implementation exists as a fallback/offline layer
- Mirrors the server-side data structures for missed calls, jobs, templates, and settings

### Development & Deployment
- **Dev Mode**: Expo dev server proxied through Replit with `EXPO_PACKAGER_PROXY_URL` and related environment variables
- **Production Build**: Custom build script (`scripts/build.js`) handles static web export
- **Server Build**: esbuild bundles server to `server_dist/`
- **Landing Page**: Static HTML template served when accessing from non-app browsers

### Subscription System (Stripe)
- **Package**: `stripe` + `stripe-replit-sync` for payment processing and data sync
- **Context**: `lib/subscription-context.tsx` provides `useSubscription()` hook with `isPro`, `isLoading`, `subscription`, `checkSubscription`, `openCheckout`, `openCustomerPortal`
- **Stripe Client**: `server/stripeClient.ts` - fetches credentials from Replit connection API, provides `getUncachableStripeClient()`, `getStripePublishableKey()`, `getStripeSync()`
- **Webhook Handlers**: `server/webhookHandlers.ts` - processes Stripe webhooks via `stripe-replit-sync`
- **Webhook Route**: Registered BEFORE `express.json()` in `server/index.ts` at `/api/stripe/webhook`
- **Stripe Init**: On server startup, runs migrations, sets up managed webhook, and syncs backfill data
- **Paywall**: `app/paywall.tsx` - $149/month subscription screen, opens Stripe Checkout, "Already subscribed?" link, "Skip for now" for testing
- **Premium gating**: Tabs layout redirects to paywall if subscription not active; subscription state managed via `SubscriptionProvider`
- **Settings integration**: Subscription section shows current plan status, "Manage" button opens Stripe Customer Portal for active subscribers
- **Checkout flow**: `POST /api/stripe/create-checkout` creates a Stripe Checkout Session, redirects to `/api/stripe/checkout-success` on completion
- **Subscription status**: `GET /api/stripe/subscription-status` checks `stripe.subscriptions` table
- **Customer Portal**: `POST /api/stripe/customer-portal` creates a Stripe Billing Portal session for subscription management
- **Seed Script**: `server/seed-stripe-product.ts` - creates TradieCatch Pro product ($149/month AUD) via Stripe API
- **Database**: Users table has `stripe_customer_id` and `stripe_subscription_id` columns; Stripe data synced to `stripe` schema automatically

## External Dependencies

### Twilio (SMS)
- Used for sending and receiving SMS messages in automated conversations
- Per-user Twilio credentials stored in settings table (twilioAccountSid, twilioAuthToken, twilioPhoneNumber)
- Fallback environment variables: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` (used if user hasn't configured their own)
- Webhook endpoint identifies the correct user by matching the incoming Twilio phone number

### PostgreSQL
- Primary data store, connected via `DATABASE_URL` environment variable
- Uses `pg` (node-postgres) driver with Drizzle ORM
- Required for all server-side operations

### Key NPM Dependencies
- **expo** (~54.0.27) - Mobile app framework
- **expo-router** (~6.0.17) - File-based routing with typed routes
- **express** (^5.0.1) - Backend HTTP server
- **drizzle-orm** (^0.39.3) - Database ORM
- **@tanstack/react-query** (^5.83.0) - Data fetching/caching
- **twilio** - SMS API client (imported in sms-conversation.ts)
- **patch-package** - Applied via postinstall script for dependency patches