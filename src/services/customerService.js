import { randomUUID } from 'crypto';
import { squareClient } from '../config/square.js';
import { BOOKING_SOURCES } from '../config/constants.js';
import { normalizePhoneNumber, formatPhoneForCreation, getPhoneSearchFormats } from '../utils/phoneNumber.js';

/**
 * Find customer by phone number
 * Tries multiple phone format variations
 */
export async function findCustomerByPhone(customerPhone) {
  const normalizedPhone = normalizePhoneNumber(customerPhone);
  console.log(`🔍 Searching for customer with phone: ${normalizedPhone}`);
  
  const searchResponse = await squareClient.customersApi.searchCustomers({
    query: {
      filter: {
        phoneNumber: {
          exact: normalizedPhone
        }
      }
    }
  });
  
  if (searchResponse.result.customers && searchResponse.result.customers.length > 0) {
    const customer = searchResponse.result.customers[0];
    console.log(`✅ Found existing customer: ${customer.id}`);
    return customer;
  }
  
  return null;
}

/**
 * Find customer by phone (trying multiple formats)
 */
export async function findCustomerByPhoneMultiFormat(customerPhone) {
  const phoneFormats = getPhoneSearchFormats(customerPhone);
  
  for (const phoneFormat of phoneFormats) {
    const searchResponse = await squareClient.customersApi.searchCustomers({
      query: {
        filter: {
          phoneNumber: {
            exact: phoneFormat
          }
        }
      }
    });

    if (searchResponse.result.customers && searchResponse.result.customers.length > 0) {
      return searchResponse.result.customers[0];
    }
  }
  
  return null;
}

/**
 * Create new customer
 * 🔥 CRITICAL: Uses 10-digit phone format (no +1) for createCustomer API
 */
export async function createCustomer(customerName, customerPhone, customerEmail = null) {
  const normalizedPhone = normalizePhoneNumber(customerPhone);
  const nameParts = customerName.split(' ');
  
  // 🔥 v2.8.10 FIX: Remove +1 prefix for Square createCustomer API
  const phoneForCreation = formatPhoneForCreation(normalizedPhone);
  console.log(`🔧 Using phone for creation: ${phoneForCreation} (10 digits, no +1)`);
  
  const customerData = {
    idempotencyKey: randomUUID(),
    customer: {
      given_name: nameParts[0],
      family_name: nameParts.slice(1).join(' ') || '',
      phone_number: phoneForCreation,
      note: `First booking: ${BOOKING_SOURCES.PHONE} on ${new Date().toLocaleDateString()}`
    }
  };
  
  if (customerEmail) {
    customerData.customer.email_address = customerEmail;
  }
  
  console.log(`📋 Creating customer:`, {
    phone_number: phoneForCreation,
    given_name: nameParts[0],
    family_name: customerData.customer.family_name,
    email_address: customerEmail || 'not provided'
  });
  
  try {
    const createResponse = await squareClient.customersApi.createCustomer(customerData);
    console.log(`✅ Created new customer: ${createResponse.result.customer.id}`);
    return createResponse.result.customer;
  } catch (error) {
    console.error('❌ Customer creation failed:', {
      message: error.message,
      statusCode: error.statusCode,
      phone: phoneForCreation,
      name: customerName
    });
    
    if (error.errors && Array.isArray(error.errors)) {
      console.error('❌ Square API errors:', JSON.stringify(error.errors, null, 2));
    }
    if (error.result && error.result.errors) {
      console.error('❌ Square result.errors:', JSON.stringify(error.result.errors, null, 2));
    }
    
    throw error;
  }
}

/**
 * Find or create customer
 * Returns { customerId, isNewCustomer }
 */
export async function findOrCreateCustomer(customerName, customerPhone, customerEmail = null) {
  try {
    // Try to find existing customer
    const existingCustomer = await findCustomerByPhone(customerPhone);
    
    if (existingCustomer) {
      return {
        customerId: existingCustomer.id,
        isNewCustomer: false
      };
    }
    
    // Create new customer
    const newCustomer = await createCustomer(customerName, customerPhone, customerEmail);
    return {
      customerId: newCustomer.id,
      isNewCustomer: true
    };
  } catch (error) {
    console.error('❌ Customer find/create error:', {
      message: error.message,
      phone: customerPhone,
      name: customerName
    });
    throw new Error(`Failed to find/create customer: ${error.message}`);
  }
}
