import express from 'express';
import toolsRoutes from './routes/toolsRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import { VERSION, LOCATION_ID, BOOKING_SOURCES, SERVICE_MAPPINGS } from './config/constants.js';

const app = express();
app.use(express.json());

// Mount routes
app.use('/tools', toolsRoutes);
app.use('/', analyticsRoutes);

const PORT = process.env.PORT || 8080;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Square Booking Server running on port ${PORT}`);
  console.log(`📍 Location: K BARBERSHOP (${LOCATION_ID})`);
  console.log(`🔧 Format: ElevenLabs Server Tools`);
  console.log(`📦 SDK: Square v43.0.2 (Legacy API)`);
  console.log(`📊 Version: ${VERSION}`);
  console.log(`🏛️ Architecture: Modular (config, utils, services, routes)`);
  console.log(`📊 Booking sources configured:`, BOOKING_SOURCES);
  console.log(`📞 Phone format:`);
  console.log(`   - Search: E.164 with + prefix (+15715276016)`);
  console.log(`   - Create: 10 digits, no +1 prefix (5715276016)`);
  console.log(`🕐 Timezone: America/New_York (EDT)`);
  console.log(`🐛 Field compatibility: snake_case + camelCase support`);
  console.log(`🔥 Features:`);
  console.log(`   ✅ Filters out cancelled bookings from availability`);
  console.log(`   ✅ Formats times in human-readable EDT format`);
  console.log(`   ✅ Conflict detection with overlap prevention`);
  console.log(`   ✅ 1-minute tolerance for time matching`);
  console.log(`   ✅ Timezone auto-validation and correction`);
  console.log(`   ✅ Enhanced error logging for debugging`);
  console.log(`   ✅ Modular architecture for maintainability`);
  console.log(`\n🌐 Endpoints available (8 tools):`);
  console.log(`   POST /tools/getCurrentDateTime`);
  console.log(`   POST /tools/getAvailability`);
  console.log(`   POST /tools/createBooking`);
  console.log(`   POST /tools/addServicesToBooking`);
  console.log(`   POST /tools/rescheduleBooking`);
  console.log(`   POST /tools/cancelBooking`);
  console.log(`   POST /tools/lookupBooking`);
  console.log(`   POST /tools/generalInquiry`);
  console.log(`\n📋 Available services:`, Object.keys(SERVICE_MAPPINGS).join(', '));
  console.log(`\n🚀 Server ready for requests!`);
});

export default app;
