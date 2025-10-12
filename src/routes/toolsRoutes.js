import express from 'express';
import { DEFAULT_TEAM_MEMBER_ID, TIMEZONE, SERVICE_MAPPINGS } from '../config/constants.js';
import { findOrCreateCustomer, findCustomerByPhoneMultiFormat } from '../services/customerService.js';
import { createBooking, addServicesToBooking, rescheduleBooking, cancelBooking, lookupCustomerBookings } from '../services/bookingService.js';
import { getAvailability } from '../services/availabilityService.js';
import { squareClient } from '../config/square.js';
import { LOCATION_ID } from '../config/constants.js';
import { safeBigIntToString, sanitizeBigInt } from '../utils/bigint.js';

const router = express.Router();

/**
 * Get Current Date/Time - Provides context to the AI agent
 */
router.post('/getCurrentDateTime', async (req, res) => {
  try {
    const now = new Date();
    
    const edtString = now.toLocaleString('en-US', {
      timeZone: TIMEZONE,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    // Calculate next Thursday
    const nextThursday = new Date(now);
    const daysUntilThursday = (4 - now.getDay() + 7) % 7 || 7;
    nextThursday.setDate(now.getDate() + daysUntilThursday);
    
    const nextThursdayString = nextThursday.toLocaleString('en-US', {
      timeZone: TIMEZONE,
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
    
    // Calculate tomorrow
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    
    const tomorrowString = tomorrow.toLocaleString('en-US', {
      timeZone: TIMEZONE,
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
    
    res.json({
      success: true,
      current: {
        dateTime: edtString,
        timezone: `${TIMEZONE} (EDT)`,
        utc: now.toISOString()
      },
      context: {
        tomorrow: tomorrowString,
        nextThursday: nextThursdayString,
        message: `Today is ${edtString}. When the customer says 'thursday', they mean ${nextThursdayString}. When they say 'tomorrow', they mean ${tomorrowString}.`
      }
    });
  } catch (error) {
    console.error('getCurrentDateTime error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get Available Time Slots
 */
router.post('/getAvailability', async (req, res) => {
  try {
    const { startDate, datetime, serviceVariationId, teamMemberId } = req.body;
    
    console.log(`🔍 getAvailability called:`, { startDate, datetime, serviceVariationId, teamMemberId });
    
    const result = await getAvailability(startDate, datetime, serviceVariationId, teamMemberId);
    res.json(result);
  } catch (error) {
    console.error('❌ getAvailability error:', error.message);
    console.error('❌ Error stack:', error.stack);
    
    if (error.errors && Array.isArray(error.errors)) {
      console.error('❌ Square API errors:', JSON.stringify(error.errors, null, 2));
    }
    if (error.result && error.result.errors) {
      console.error('❌ Square result errors:', JSON.stringify(error.result.errors, null, 2));
    }
    
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.errors || error.result?.errors || []
    });
  }
});

/**
 * Create New Booking (supports single or multiple services)
 */
router.post('/createBooking', async (req, res) => {
  try {
    const { 
      customerName, 
      customerPhone, 
      customerEmail, 
      startTime, 
      serviceVariationId,
      serviceVariationIds, // NEW: array of service IDs
      teamMemberId 
    } = req.body;

    console.log(`📅 createBooking called:`, { 
      customerName, 
      customerPhone, 
      startTime, 
      serviceVariationId,
      serviceVariationIds,
      teamMemberId 
    });

    // Validate required fields
    if (!customerName || !customerPhone || !startTime) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: customerName, customerPhone, startTime'
      });
    }

    // Support both single service (backward compatible) and multiple services
    let finalServiceIds;
    
    if (serviceVariationIds && Array.isArray(serviceVariationIds) && serviceVariationIds.length > 0) {
      // Multiple services provided
      finalServiceIds = serviceVariationIds;
      console.log(`🎯 Multi-service booking: ${serviceVariationIds.length} services`);
    } else if (serviceVariationId) {
      // Single service (backward compatible)
      finalServiceIds = [serviceVariationId];
      console.log(`🎯 Single-service booking`);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: serviceVariationId or serviceVariationIds array'
      });
    }

    const finalTeamMemberId = teamMemberId || DEFAULT_TEAM_MEMBER_ID;
    console.log(`👤 Using team member: ${finalTeamMemberId}`);

    // Find or create customer
    const { customerId, isNewCustomer } = await findOrCreateCustomer(customerName, customerPhone, customerEmail);

    // Create booking with one or more services
    const booking = await createBooking(customerId, startTime, finalServiceIds, finalTeamMemberId);

    // Get service names for response
    const serviceNames = finalServiceIds.map(id => {
      const serviceName = Object.keys(SERVICE_MAPPINGS).find(name => SERVICE_MAPPINGS[name] === id);
      return serviceName || 'Unknown Service';
    });

    res.json({
      success: true,
      booking: booking,
      bookingId: booking.id,
      duration_minutes: booking.duration_minutes,
      service_count: booking.service_count,
      services: serviceNames,
      message: `Appointment created successfully for ${customerName}. Total duration: ${booking.duration_minutes} minutes (${serviceNames.join(', ')})`,
      newCustomer: isNewCustomer
    });
  } catch (error) {
    console.error('❌ ========== CREATEBOOKING TOP-LEVEL ERROR ==========');
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ ====================================================');
    
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.errors || []
    });
  }
});

/**
 * Add Services to Existing Booking
 */
router.post('/addServicesToBooking', async (req, res) => {
  try {
    const { bookingId, serviceNames } = req.body;

    console.log(`➕ addServicesToBooking called:`, { bookingId, serviceNames });

    if (!bookingId || !serviceNames || !Array.isArray(serviceNames) || serviceNames.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: bookingId and serviceNames (array)'
      });
    }

    const result = await addServicesToBooking(bookingId, serviceNames);
    res.json(result);
  } catch (error) {
    console.error('❌ addServicesToBooking error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.errors || []
    });
  }
});

/**
 * Reschedule Existing Booking
 */
router.post('/rescheduleBooking', async (req, res) => {
  try {
    const { bookingId, newStartTime } = req.body;

    if (!bookingId || !newStartTime) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: bookingId, newStartTime'
      });
    }

    const result = await rescheduleBooking(bookingId, newStartTime);
    res.json(result);
  } catch (error) {
    console.error('❌ rescheduleBooking error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Cancel Booking
 */
router.post('/cancelBooking', async (req, res) => {
  try {
    const { bookingId } = req.body;

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: bookingId'
      });
    }

    const result = await cancelBooking(bookingId);
    res.json(result);
  } catch (error) {
    console.error('cancelBooking error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Lookup Booking by Phone
 */
router.post('/lookupBooking', async (req, res) => {
  try {
    const { customerPhone, customerName } = req.body;

    if (!customerPhone) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: customerPhone'
      });
    }

    // Find customer
    const customer = await findCustomerByPhoneMultiFormat(customerPhone);
    
    if (!customer) {
      return res.json({
        success: true,
        found: false,
        message: 'No customer found with that phone number'
      });
    }

    // Get bookings
    const bookingResult = await lookupCustomerBookings(customer.id);

    // Sanitize BigInt values before returning
    const sanitizedResult = sanitizeBigInt({
      success: true,
      found: true,
      customer: customer,
      ...bookingResult
    });

    res.json(sanitizedResult);
  } catch (error) {
    console.error('lookupBooking error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * General Inquiry
 */
router.post('/generalInquiry', async (req, res) => {
  try {
    const { inquiryType } = req.body;
    const returnAll = !inquiryType;

    let result = { success: true };

    if (returnAll || inquiryType === 'hours' || inquiryType === 'location') {
      try {
        const locationResponse = await squareClient.locationsApi.retrieveLocation(LOCATION_ID);
        const location = locationResponse.result.location;
        
        result.businessHours = location.businessHours || {};
        result.timezone = location.timezone || TIMEZONE;
        result.locationName = location.name;
        result.address = location.address;
        result.phoneNumber = location.phoneNumber;
      } catch (error) {
        console.error('Location API error:', error);
        result.businessHoursError = error.message;
      }
    }

    if (returnAll || inquiryType === 'services' || inquiryType === 'pricing') {
      try {
        const catalogResponse = await squareClient.catalogApi.listCatalog(undefined, 'ITEM');

        result.services = (catalogResponse.result.objects || []).map(item => ({
          id: item.id,
          name: item.itemData?.name,
          description: item.itemData?.description,
          variations: (item.itemData?.variations || []).map(variation => ({
            id: variation.id,
            name: variation.itemVariationData?.name,
            price: variation.itemVariationData?.priceMoney?.amount 
              ? (Number(variation.itemVariationData.priceMoney.amount) / 100).toFixed(2)
              : null,
            currency: variation.itemVariationData?.priceMoney?.currency || 'USD',
            duration: safeBigIntToString(variation.itemVariationData?.serviceDuration)
          }))
        }));
        result.servicesCount = result.services.length;
      } catch (error) {
        console.error('Catalog API error:', error);
        result.servicesError = error.message;
      }
    }

    if (returnAll || inquiryType === 'staff' || inquiryType === 'barbers' || inquiryType === 'team') {
      try {
        const teamResponse = await squareClient.teamApi.searchTeamMembers({
          query: {
            filter: {
              locationIds: [LOCATION_ID],
              status: 'ACTIVE'
            }
          }
        });

        result.teamMembers = (teamResponse.result.teamMembers || []).map(member => ({
          id: member.id,
          givenName: member.givenName,
          familyName: member.familyName,
          fullName: `${member.givenName || ''} ${member.familyName || ''}`.trim(),
          emailAddress: member.emailAddress,
          phoneNumber: member.phoneNumber,
          isOwner: member.isOwner || false
        }));
        result.teamMembersCount = result.teamMembers.length;
      } catch (error) {
        console.error('Team API error:', error);
        result.teamMembersError = error.message;
      }
    }

    res.json(result);
  } catch (error) {
    console.error('generalInquiry error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
