# Changelog

All notable changes to the AI Receptionist project will be documented in this file.

## [2.9.0] - 2025-10-12

### ✨ MAJOR FEATURE: Multi-Service Booking Support

**New Capability:** Book multiple services in a SINGLE appointment

#### Backend Changes
- Modified `createBooking()` to accept `serviceVariationIds` array (multiple services)
- Maintains backward compatibility with single `serviceVariationId`
- Calculates total duration across all services automatically
- Returns `duration_minutes` and `service_count` to AI agent
- Enhanced logging to show service count and total duration

#### Route Updates
- `POST /createBooking` now accepts:
  - `serviceVariationIds` (array) - for multiple services
  - `serviceVariationId` (single) - backward compatible
- Response includes:
  - `duration_minutes` - total appointment time
  - `service_count` - number of services
  - `services` - array of service names

#### System Prompt Updates
- New section: "Booking Multiple Services in One Appointment"
- AI instructed to:
  - Ask "Would you like to add any other services?" after first service mentioned
  - Book all services in ONE appointment (not separate)
  - Inform customer of total duration
  - Use `serviceVariationIds` array for multiple services
- Added examples and guardrails for multi-service bookings
- Enhanced tool documentation for `createBooking`

#### Key Features
- **Single appointment with multiple services** - no more back-to-back bookings
- **Automatic duration calculation** - Haircut (30min) + Beard Trim (30min) = 60min
- **Conflict detection** - validates combined duration doesn't overlap
- **Customer notification** - AI tells customer total time commitment
- **100% backward compatible** - existing single-service bookings still work

#### Example Workflow
**Before (v2.8.x):**
- Customer: "I want a haircut and beard trim"
- System: Creates 2 separate appointments (2:00pm haircut, 2:30pm beard trim)

**After (v2.9.0):**
- Customer: "I want a haircut and beard trim"
- System: Creates 1 appointment with both services (2:00pm, 60 minutes total)
- AI says: "You're all set for 2pm. That'll be 60 minutes for your haircut and beard trim."

#### Technical Details
```javascript
// Old way (still works)
createBooking(customerId, startTime, "7XPUHGDLY4N3H2OWTHMIABKF", teamId);

// New way (multiple services)
createBooking(customerId, startTime, [
  "7XPUHGDLY4N3H2OWTHMIABKF",  // Haircut
  "SPUX6LRBS6RHFBX3MSRASG2J"   // Beard Trim
], teamId);

// Returns:
{
  id: "booking123",
  duration_minutes: 60,
  service_count: 2,
  // ... other booking data
}
```

#### Migration Notes
- No breaking changes - fully backward compatible
- ElevenLabs agent must be updated with new system prompt
- Existing single-service bookings continue to work
- No database changes needed

---

## [2.8.10] - 2025-10-11

### 🏗️ Architecture Overhaul
- **BREAKING**: Restructured from monolithic `server.js` (1,300+ lines) to modular architecture
- Created organized directory structure: `src/config`, `src/utils`, `src/services`, `src/routes`
- Separated concerns: configuration, utilities, business logic, and API routes
- New entry point: `src/app.js` (use `npm start` to run)

### 🔧 Fixed
- **CRITICAL**: Fixed phone number format bug in customer creation
  - Search customers: Uses `+15715276016` (E.164 with + prefix)
  - Create customer: Uses `5715276016` (10 digits, no +1 prefix)
  - Added `formatPhoneForCreation()` utility function

### ✨ Added
- Comprehensive `README.md` with full API documentation
- `MIGRATION_GUIDE.md` for upgrading from v2.8.8
- `Dockerfile` for containerized deployments
- `.dockerignore` and `.gitignore` files
- `CHANGELOG.md` for version tracking
- Archived old monolithic code to `archive/` directory

### 📦 Module Structure
```
src/
├── config/
│   ├── constants.js          # Booking sources, services, IDs
│   └── square.js              # Square API client
├── utils/
│   ├── phoneNumber.js         # Phone normalization
│   ├── datetime.js            # Time formatting & validation
│   └── bigint.js              # BigInt serialization
├── services/
│   ├── customerService.js     # Customer operations
│   ├── bookingService.js      # Booking CRUD
│   └── availabilityService.js # Availability checking
├── routes/
│   ├── toolsRoutes.js         # ElevenLabs endpoints
│   └── analyticsRoutes.js     # Health & analytics
└── app.js                     # Express application
```

### 🔄 Migration Notes
- All API endpoints remain **100% backward compatible**
- No changes needed to ElevenLabs agent configuration
- Environment variables unchanged
- See `MIGRATION_GUIDE.md` for detailed upgrade instructions

---

## [2.8.9] - 2025-10-11 [FAILED]

### ❌ Issues
- Incomplete file upload to GitHub
- Syntax errors in phone number handling
- Reverted in favor of v2.8.10

---

## [2.8.8] - 2025-10-11

### 🔍 Enhanced
- Added comprehensive error logging for `createBooking` failures
- Log Square API error details (statusCode, errors array, result.errors)
- Log booking payload that failed for debugging
- Added top-level error catching with full error serialization

### 🐛 Bug Note
- Phone number format bug still present (fixed in v2.8.10)
- Used snake_case for customer fields (correct)
- Removed + prefix for createCustomer (partially correct, fully fixed in v2.8.10)

---

## [2.8.7] - 2025-10-11

### 🔧 Fixed
- Attempted to fix phone number format for Square `createCustomer` API
- Removed + prefix: `normalizedPhone.replace(/^\+/, '')`
- Note: This was incomplete; v2.8.10 provides the correct fix

---

## [2.8.6] - 2025-10-11

### 🔥 Critical Fix
- **BREAKING FIX**: Changed from camelCase to snake_case for Square Customer API
- Correct field names:
  - `phone_number` (not `phoneNumber`)
  - `given_name` (not `givenName`)
  - `family_name` (not `familyName`)
  - `email_address` (not `emailAddress`)
- This was the root cause of customer creation failures

---

## [2.8.5] - 2025-10-11

### 🔄 Reverted
- Reverted v2.8.4 changes
- Kept E.164 format with + prefix for phone numbers
- Per Square API documentation, + prefix is accepted

---

## [2.8.4] - 2025-10-11 [INCORRECT]

### ❌ Incorrect Fix
- Removed + prefix from phone numbers (caused silent failures)
- Reverted in v2.8.5

---

## [2.8.3] - 2025-10-11

### 🔧 Fixed
- Fixed `phone_number` field actually being sent in `createCustomer` API request
- Bug: normalizedPhone was logged but not included in request body

---

## [2.8.2] - 2025-10-11

### 🔧 Fixed
- Fixed Square API phone search to use body content field
- SDK now properly sends + prefix in request body

---

## [2.8.1] - 2025-10-11

### 🔧 Fixed
- Fixed customer search to keep + prefix in phone number for Square API
- Search now works with E.164 format

---

## [2.8.0] - 2025-10-11

### 🔍 Enhanced
- Enhanced error logging for customer creation
- Capture full Square API error details
- Log phone number, name, email, and statusCode
- Added JSON serialization for circular error objects

---

## [2.7.9] - 2025-10-08

### 🔧 Fixed
- Fixed timezone handling in `rescheduleBooking`
- Auto-validates and corrects missing timezone offsets
- Converts UTC to EDT automatically
- Prevents 10AM/2PM bug when user requests 6PM

---

## [2.7.8] - 2025-10-08

### 🔧 Fixed
- Fixed `lookupBooking` to separate active and cancelled bookings
- Returns `activeBookings` and `cancelledBookings` arrays
- Clear messaging about booking status
- Prevents AI from reporting all bookings as cancelled

---

## [2.7.7] - 2025-10-08

### 🔍 Enhanced
- Enhanced error logging for Square API errors
- Log exact parameters sent to `searchAvailability`
- Capture and display detailed error information

---

## [2.7.6] - 2025-10-08

### 🔧 Fixed
- Fixed date format confusion
- Now uses "Thu, Oct 10, 2025" instead of "10/10/2025"
- Added explicit month names for clarity

---

## [2.7.5] - 2025-10-08

### 🔧 Fixed
- Fixed past date requests
- Rejects dates in the past (e.g., 2024 dates when in 2025)
- Validates entire date is in future

---

## [2.7.4] - 2025-10-08

### 🔧 Fixed
- Fixed invalid time range error
- Validates `start_at` < `end_at` before API call
- Prevents "end_at before start_at" errors

---

## [2.7.3] - 2025-10-08

### 🔧 Fixed
- Fixed "Bookings can only be made in the future" error
- Adjusts start time when midnight is in the past

---

## [2.7.2] - 2025-10-08

### 🔧 Fixed
- Fixed cancelled bookings incorrectly blocking availability
- Now filters out `CANCELLED_BY_SELLER` and `CANCELLED_BY_CUSTOMER` statuses
- Only active bookings block time slots

---

## [2.7.1] - 2025-10-08

### 🔧 Fixed
- Fixed `rescheduleBooking` read-only fields error
- Only sends writable fields to Square API

---

## [2.7.0] - 2025-10-08

### ✨ Added
- Added `getCurrentDateTime` endpoint for AI context
- Provides current date, tomorrow, and next Thursday

### 🔧 Improved
- Improved time matching with 1-minute tolerance
- Returns exact match if within 60 seconds
- Returns closest alternatives if no exact match

---

## [2.6.0] - 2025-10-07

### 🔧 Fixed
- **CRITICAL**: Fixed overlap detection in `addServicesToBooking`
- Back-to-back appointments now allowed (OK if `nextStart == ourEnd`)
- Overlaps properly blocked (blocked if `nextStart < ourEnd`)

---

## [2.5.0] - 2025-10-07

### ✨ Added
- Added `addServicesToBooking` endpoint
- Supports adding multiple services to existing appointments
- Includes conflict detection for overlapping bookings

---

## [2.4.1] - 2025-10-07

### 🔧 Fixed
- `lookupBooking` now formats times to EDT
- Displays human-readable times for customer

---

## [2.4.0] - 2025-10-07

### 🔧 Fixed
- **CRITICAL**: Filters out already-booked time slots
- Fetches existing bookings and removes from availability
- Prevents double-booking issues

---

## [2.3.0] - 2025-10-06

### ✨ Initial Release
- Core booking functionality
- Square API integration
- ElevenLabs server tools format
- 8 endpoints for booking management

---

## Version Schema

We use semantic versioning: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes (architecture, API changes)
- **MINOR**: New features, enhancements
- **PATCH**: Bug fixes, small improvements

### Tags
- 🏗️ Architecture
- ✨ Added
- 🔧 Fixed
- 🔍 Enhanced
- 🔥 Critical
- ❌ Failed/Reverted
- 🔄 Changed
- 🐛 Bug
