# FIX: AI Agent Hallucinating Booking Times

## Issue Description

User phone: `571-699-5142`  
Actual booking: **October 14, 3:00 PM**  
Agent said: **"Monday at 2:00 PM"** ❌ (completely made up!)

### Call Transcript Analysis
```
Agent: "Are you sure you want to cancel your appointment on Monday at 2:00 PM?"
User: "When?"
Agent: "I need to look up your appointment first..."
```

**The agent mentioned a specific time BEFORE calling `lookupBooking`!**

## Root Cause

The AI agent is **hallucinating appointment times** instead of looking them up first.

### Why This Happens

**Location 1: System Prompt Example** (Line 145-148 in `ELEVENLABS_SYSTEM_PROMPT.md`)

```markdown
### 9. Later in Same Conversation - Cancel
Customer: "Cancel everything"
You: "Are you sure you want to cancel your Monday 2pm appointment?"
```

**Problem**: The prompt shows the agent confirming with a made-up time ("Monday 2pm") WITHOUT calling `lookupBooking` first.

**Location 2: Tool Workflow Missing Step**

The `cancelBooking` tool expects a `bookingId`, but the workflow doesn't explicitly tell the agent to:
1. Call `lookupBooking` FIRST
2. Get the booking details (including time and ID)
3. THEN confirm with the ACTUAL time
4. THEN call `cancelBooking` with the real ID

---

## Required Fixes

### Fix #1: Update System Prompt Example

**File**: `ELEVENLABS_SYSTEM_PROMPT.md`  
**Lines**: 145-149

**Current (WRONG)**:
```markdown
### 9. Later in Same Conversation - Cancel
Customer: "Cancel everything"
You: "Are you sure you want to cancel your Monday 2pm appointment?"
```

**Fixed (CORRECT)**:
```markdown
### 9. Later in Same Conversation - Cancel
Customer: "Cancel everything"
You: [FIRST call lookupBooking with stored phone to get ACTUAL booking details]
You: "I found your appointment on [ACTUAL date/time from lookup]. Are you sure you want to cancel?"
```

### Fix #2: Add Explicit Tool Workflow Rule

**File**: `ELEVENLABS_SYSTEM_PROMPT.md`  
**Location**: Add new section after "Your Tools (9 Total)" (around line 170)

**Add This Section**:

```markdown
## 🚨 CRITICAL: Never Mention Booking Times Without Lookup

**RULE**: You must ALWAYS call `lookupBooking` BEFORE mentioning any appointment time.

**CORRECT Flow**:
```
Customer: "Cancel my appointment"
Step 1: Call lookupBooking with stored phone number
Step 2: Read the ACTUAL booking time from the response
Step 3: "I found your appointment on Thursday, October 14 at 3:00 PM. Are you sure you want to cancel?"
Step 4: Call cancelBooking with the booking ID
```

**WRONG Flow** (DO NOT DO THIS):
```
Customer: "Cancel my appointment"
You: "Are you sure you want to cancel your Monday 2pm appointment?" ❌ WRONG - you invented this time!
```

**Why This Matters**:
- You do NOT know appointment times from memory
- Every customer's appointment is different  
- You MUST look up the actual time from the database
- Never guess or make up appointment times

**This applies to**:
- Cancellations: Look up time before confirming cancellation
- Rescheduling: Look up current time before asking for new time
- Adding services: Look up booking details before checking for conflicts
- Any time you need to reference an appointment time
```

---

## Testing the Fix

After updating the prompt, test with:

**Test Case 1: Cancel Request**
```
User: "Cancel my appointment"
Expected: Agent calls lookupBooking first, then says actual time
Wrong: Agent says "Monday at 2pm" without lookup
```

**Test Case 2: Reschedule Request**
```
User: "Reschedule my appointment"  
Expected: Agent calls lookupBooking, says "I see you have an appointment on [actual time]"
Wrong: Agent asks "What time would you like?" without looking up current time
```

---

## Files to Update

1. ✅ `ELEVENLABS_SYSTEM_PROMPT.md` - Fix example on lines 145-149
2. ✅ `ELEVENLABS_SYSTEM_PROMPT.md` - Add new section after line 170
3. ✅ No backend code changes needed - lookup logic works correctly

---

## Priority: HIGH

This causes customer confusion when the agent references appointments that don't exist or have wrong times. Fix immediately before production use.
