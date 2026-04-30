# TradieCatch

## Overview
TradieCatch is a multi-tenant SaaS mobile application designed for tradespeople, specifically electricians, to streamline their business operations. It helps manage missed calls, automate SMS follow-ups, and book jobs efficiently. The platform aims to reduce administrative burden for tradies, improve customer communication, and ultimately increase job bookings and revenue. Each tradie operates with a dedicated, isolated account, managing their own Twilio credentials and customer interactions.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Core Functionality
TradieCatch operates on a core workflow: tradies log in, missed calls are recorded and tied to their account, an automated SMS conversation with the caller is initiated via Twilio, and jobs are created from these completed conversations. Tradies can then manage these jobs through various statuses.

### Authentication & Multi-Tenancy
The system uses JWT-based authentication with bcrypt hashing. Each user's data is isolated via a `userId` column in all relevant tables. JWTs are stored in AsyncStorage for frontend authentication, and API requests include the token for verification. Twilio credentials are user-specific, allowing each tradie to manage their own SMS conversations.

### Frontend (Expo/React Native)
The mobile application is built with Expo SDK 54 and React Native 0.81, utilizing expo-router v6 for file-based routing and a tab-based navigation system (Calls, Jobs, Settings). State management is handled by React Context and TanStack React Query for data fetching and caching. The UI features a professional dark blue and orange accent color scheme, with Inter fonts, targeting iOS and Android with web compatibility.

### Backend (Express.js)
The backend is an Express v5 server, providing a RESTful JSON API. Authentication is enforced via `requireAuth` middleware. The server uses esbuild for production bundling and tsx for development. CORS is dynamically configured to support Replit and local development. Key API endpoints support CRUD operations for missed calls, jobs, SMS templates, user settings, and services, along with Twilio webhooks for SMS and voice.

### Database (PostgreSQL + Drizzle ORM)
PostgreSQL is the primary data store, managed with Drizzle ORM. The schema includes tables for `users`, `missed_calls`, `jobs`, `sms_templates`, and `settings`, all linked by `userId` for multi-tenancy. Migrations are managed via `drizzle-kit push`, and `drizzle-zod` is used for validation.

### Key Features

#### Voice Recording
Tradies can record a custom voicemail greeting via the app, which is uploaded and stored as base64 data. This recording is then served publicly for Twilio to use in voice calls, offering a personalized touch over text-to-speech.

#### SMS Conversation Engine
A state machine manages automated SMS conversations, guiding callers through service selection, urgency, address collection, and booking preferences. Services are dynamic and configurable by the user. The engine automatically creates jobs upon conversation completion.

#### Services Management
Tradies can customize their list of services, stored as a JSONB array within their settings. This allows for dynamic service offerings and tailored conversation flows.

#### Subscription System (Stripe)
The application integrates with Stripe for subscription management. Sales/payments are handled manually outside the app via Stripe payment links — the in-app paywall no longer displays prices or runs an in-app checkout. When a tradie signs up, the app gates access via the paywall screen until their Stripe subscription is active. The `/api/stripe/subscription-status` endpoint checks Stripe directly and, if the user has no `stripeCustomerId` linked yet, looks up Stripe customers by email and auto-links any active subscription to that account. This means: create a Stripe customer + subscription for the tradie's email (via a Stripe payment link or directly in Stripe), and as soon as they tap "I've Paid — Activate Account" on the paywall, the app finds the active subscription and unlocks. If the subscription becomes inactive (cancelled/past_due), the app re-checks on every foreground and redirects them back to the paywall. Customer portal is still available from Settings for subscribers.

#### Web Access (no app store required)
The Expo app is also served as a web app via the Express server, so tradies can sign up and use the full product (calls, jobs, settings, voice greeting, SMS flow) directly from a browser at the published URL. This removes the App Store / Play Store dependency for early SaaS sign-ups.

## External Dependencies

### Twilio
- **Purpose**: Sending and receiving SMS messages, automated conversations, and voice call handling.
- **Configuration**: Per-user credentials (Account SID, Auth Token, Phone Number) stored in settings, with environment variable fallbacks.

### PostgreSQL
- **Purpose**: Primary relational database for all application data.
- **Connection**: Via `DATABASE_URL` environment variable.

### Stripe
- **Purpose**: Payment processing, subscription management, and customer portal.
- **Integration**: `stripe` and `stripe-replit-sync` NPM packages, webhooks, and client-side integration for checkout and portal.

### NPM Dependencies (Key Examples)
- **expo**: Core framework for mobile development.
- **expo-router**: File-based routing for the frontend.
- **express**: Backend web application framework.
- **drizzle-orm**: Object-relational mapper for PostgreSQL.
- **@tanstack/react-query**: Data fetching and caching for the frontend.
- **twilio**: Official library for interacting with the Twilio API.
- **patch-package**: Utility for applying patches to npm dependencies.