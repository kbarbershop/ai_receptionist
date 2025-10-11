#!/bin/bash
# Repository Documentation Cleanup Script
# This script archives historical troubleshooting documentation

echo "🧹 Starting repository cleanup..."
echo ""

# Create archive directory
mkdir -p archive/historical_fixes

# Files to archive
declare -a FILES=(
  "ACTION_REQUIRED.md"
  "CRITICAL_FIX_SQUARE_CUSTOMER_API.md"
  "DEPLOYMENT_TIME_FIX.md"
  "DEPLOY_NOW.md"
  "ENHANCED_ERROR_LOGGING_PATCH.md"
  "FINAL_SOLUTION.md"
  "FIX_ADD_SERVICES_20251008.md"
  "FIX_ADD_SERVICES_CONSECUTIVE_BOOKINGS.md"
  "FIX_AVAILABILITY_RESPONSE_20251007.md"
  "FIX_BIGINT_SERIALIZATION_20251006.md"
  "FIX_DATE_TIME_MATCHING_20251007.md"
  "FIX_ELEVENLABS_BOOKING_20251006.md"
  "FIX_ERROR_LOGGING_20251008.md"
  "FIX_PHONE_FORMAT_20251006.md"
  "FIX_PHONE_NUMBER_20251006.md"
  "INVESTIGATION_SUMMARY.md"
  "ISSUE_20251006_BOOKINGS_404.md"
  "MIGRATION_GUIDE.md"
  "PYTHON_BACKEND_IN_GITHUB.md"
  "QUICK_FIX_GUIDE.md"
  "SUMMARY.md"
  "TEST_VERIFICATION.md"
)

# Counter
archived=0
notfound=0

# Move files to archive
for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "📦 Archiving: $file"
    git mv "$file" "archive/historical_fixes/"
    ((archived++))
  else
    echo "⚠️  Not found: $file"
    ((notfound++))
  fi
done

echo ""
echo "📊 Summary:"
echo "  ✅ Archived: $archived files"
echo "  ⚠️  Not found: $notfound files"
echo ""

# Create README in archive folder
cat > archive/historical_fixes/README.md << 'EOF'
# Historical Fixes Archive

This folder contains historical troubleshooting documentation that has been consolidated into the main `TROUBLESHOOTING.md` guide.

## Why These Were Archived

All the key lessons and solutions from these documents have been extracted and organized into a single, comprehensive troubleshooting guide at the root of the repository.

## Archived Documents Include:

- **FIX_* files** - Step-by-step debugging and fixes for specific issues (Oct 2025)
- **ACTION_REQUIRED.md** - Historical deployment instructions
- **DEPLOYMENT_TIME_FIX.md** - Timezone fix documentation
- **CRITICAL_FIX_SQUARE_CUSTOMER_API.md** - Snake_case field naming fix
- **INVESTIGATION_SUMMARY.md** - Issue investigation notes
- **ISSUE_20251006_BOOKINGS_404.md** - Specific issue tracking
- **MIGRATION_GUIDE.md** - Migration from monolithic to modular architecture
- **PYTHON_BACKEND_IN_GITHUB.md** - Outdated Python backend reference
- **And more...**

## When to Reference These

These documents are preserved for:
- Historical context on how specific bugs were discovered and fixed
- Detailed debugging steps that led to solutions
- Learning from the development process
- Understanding the evolution of the system

## Current Documentation

For current troubleshooting, refer to:
- `/TROUBLESHOOTING.md` - Comprehensive troubleshooting guide
- `/README.md` - Main project documentation
- `/CHANGELOG.md` - Version history
- `/ELEVENLABS_*.md` - ElevenLabs-specific guides

---

**Archived:** October 2025  
**Total Documents:** 22 files
EOF

echo "📝 Created archive README"
echo ""

# Stage all changes
git add -A

# Commit
echo "💾 Creating commit..."
git commit -m "🗄️ Archive historical troubleshooting documentation

Moved 22 historical fix/debug files to archive/historical_fixes/

All key lessons have been consolidated into TROUBLESHOOTING.md

Archived files:
- ACTION_REQUIRED.md
- CRITICAL_FIX_SQUARE_CUSTOMER_API.md  
- DEPLOYMENT_TIME_FIX.md
- DEPLOY_NOW.md
- ENHANCED_ERROR_LOGGING_PATCH.md
- FINAL_SOLUTION.md
- All FIX_* debugging docs (9 files)
- INVESTIGATION_SUMMARY.md
- ISSUE_20251006_BOOKINGS_404.md
- MIGRATION_GUIDE.md
- PYTHON_BACKEND_IN_GITHUB.md
- QUICK_FIX_GUIDE.md
- SUMMARY.md
- TEST_VERIFICATION.md

Repository documentation is now clean and organized.
Historical fixes preserved in /archive for reference."

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "📤 To push changes to GitHub, run:"
echo "   git push origin main"
echo ""
echo "📁 Active documentation (kept in root):"
echo "   - README.md"
echo "   - TROUBLESHOOTING.md (NEW)"
echo "   - CHANGELOG.md"
echo "   - ELEVENLABS_SETUP.md"
echo "   - ELEVENLABS_SYSTEM_PROMPT.md"
echo "   - ELEVENLABS_TESTING_GUIDE.md"
echo "   - ELEVENLABS_TOOL_CONFIGS.md"
echo "   - SERVICE_VARIATION_IDS.md"
echo "   - QUICKREF.md"
