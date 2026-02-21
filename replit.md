# TradieCatch

## Overview

TradieCatch is a mobile-first application built for tradespeople (electricians specifically) to manage missed calls, automate SMS follow-ups, and book jobs. The app uses Expo/React Native for the frontend with a tab-based navigation system, and an Express.js backend with PostgreSQL for data persistence. It integrates with Twilio for automated SMS conversations that guide callers through service selection and job booking.

The core workflow is:
1. A missed call comes in and is logged
2. An automated SMS conversation is initiated via Twilio, guiding the caller through service selection, urgency assessment, address collection, and time preferences
3. Jobs are created from completed conversations
4. The tradie can manage jobs through status workflows (pending → confirmed → completed/cancelled)

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (Expo/React Native)
- **Framework**: Expo SDK 54 with React Native 0.81, using expo-router v6 for file-based routing
- **Navigation**: Tab-based layout with three tabs (Calls, Jobs, Settings) plus modal screens for booking jobs, sending SMS, adding calls, and editing templates
- **State Management**: React Context (`DataProvider` in `lib/data-context.tsx`) wraps the app and provides all data operations. TanStack React Query is available for query caching via `lib/query-client.ts`
- **Fonts**: Inter font family (400, 500, 600, 700 weights) via `@expo-google-fonts/inter`
- **Styling**: StyleSheet-based with a centralized color palette in `constants/colors.ts`. The app uses a professional dark blue + orange accent color scheme
- **Platform Support**: Primarily targets iOS and Android with web compatibility. Platform-specific adjustments exist throughout (safe area insets, keyboard handling, SMS URL schemes)
- **Key Libraries**: react-native-gesture-handler, react-native-reanimated, react-native-keyboard-controller, expo-haptics for tactile feedback, expo-image-picker, expo-location

### Backend (Express.js)
- **Server**: Express v5 running as a Node.js server (`server/index.ts`)
- **API Pattern**: RESTful JSON API under `/api/` prefix with routes defined in `server/routes.ts`
- **Build**: Uses esbuild for production server bundling, tsx for development
- **CORS**: Dynamic CORS configuration supporting Replit domains and localhost development
- **Key Endpoints**:
  - `GET/POST/DELETE /api/missed-calls` - CRUD for missed calls
  - `POST /api/missed-calls/:id/send-sms` - Trigger automated SMS conversation
  - `GET/POST/DELETE /api/jobs` - CRUD for jobs
  - `PUT /api/jobs/:id/status` - Update job status
  - `GET/POST/PUT/DELETE /api/sms-templates` - Manage SMS templates
  - `GET/PUT /api/settings` - App settings
  - `GET/PUT /api/services` - Manage services list
  - `POST /api/twilio/webhook` - Twilio SMS webhook for incoming text replies
  - `POST /api/twilio/voice` - Twilio voice webhook for incoming calls (auto-logs as missed call, triggers auto-SMS, returns TwiML with voicemail message)

### Database (PostgreSQL + Drizzle ORM)
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema** (`shared/schema.ts`):
  - `users` - Basic user table (id, username, password)
  - `missed_calls` - Core table tracking calls with conversation state machine fields (conversationState, selectedService, selectedSubOption, selectedTime, jobAddress, isUrgent, conversationLog as JSONB)
  - `jobs` - Booked jobs with type, date, time, address, status, urgency
  - `sms_templates` - Customizable SMS templates
  - `settings` - Business configuration (name, auto-reply toggle)
- **Migrations**: Managed via `drizzle-kit push` command
- **Validation**: Uses `drizzle-zod` for schema-to-Zod validation
- **Seeding**: Default templates and settings are seeded on server startup via `seedDefaults()` in routes

### SMS Conversation Engine (`server/sms-conversation.ts`)
- Implements a state machine for automated SMS conversations with callers
- States: none → awaiting_service → awaiting_sub_option → awaiting_urgency → awaiting_other_description → awaiting_address → awaiting_time → completed
- Services are **dynamic** - stored in the `settings.services` JSONB column and editable from the Settings screen
- Services containing "urgent"/"emergency"/"power outage" in the name trigger the urgency flow
- A service named "Other" (case-insensitive) triggers the free-text description flow
- Collects service details, urgency, address, and preferred time
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

## External Dependencies

### Twilio (SMS)
- Used for sending and receiving SMS messages in automated conversations
- Required environment variables: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- Webhook endpoint needed for incoming SMS replies

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