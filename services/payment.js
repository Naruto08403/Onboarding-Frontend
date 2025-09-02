const stripe = require('stripe');
require('dotenv').config();

// Initialize Stripe only if API key is available
let stripeClient = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripeClient = stripe(process.env.STRIPE_SECRET_KEY);
} else {
  console.log('⚠️  Stripe not configured - STRIPE_SECRET_KEY not found in environment');
}

// Payment Service Class
class PaymentService {
  // Create a customer in Stripe
  static async createCustomer(userData) {
    if (!stripeClient) {
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables.');
    }
    
    try {
      const customer = await stripeClient.customers.create({
        email: userData.email,
        name: `${userData.firstName} ${userData.lastName}`,
        phone: userData.phoneNumber,
        metadata: {
          userId: userData.id,
          role: userData.role,
          status: userData.status
        }
      });

      return {
        customerId: customer.id,
        email: customer.email,
        name: customer.name,
        phone: customer.phone,
        created: customer.created
      };
    } catch (error) {
      console.error('Stripe create customer failed:', error.message);
      throw new Error(`Failed to create customer: ${error.message}`);
    }
  }

  // Create a payment intent for onboarding fee
  static async createOnboardingPaymentIntent(customerId, amount, currency = 'usd') {
    if (!stripeClient) {
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables.');
    }
    try {
      const paymentIntent = await stripeClient.paymentIntents.create({
        amount: amount, // Amount in cents
        currency: currency,
        customer: customerId,
        description: 'Driver Onboarding Fee',
        metadata: {
          type: 'onboarding_fee',
          customerId: customerId
        },
        automatic_payment_methods: {
          enabled: true
        }
      });

      return {
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        customerId: paymentIntent.customer
      };
    } catch (error) {
      console.error('Stripe create payment intent failed:', error.message);
      throw new Error(`Failed to create payment intent: ${error.message}`);
    }
  }

  // Create a subscription for recurring fees
  static async createSubscription(customerId, priceId, metadata = {}) {
    if (!stripeClient) {
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables.');
    }
    try {
      const subscription = await stripeClient.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        metadata: {
          type: 'driver_subscription',
          customerId: customerId,
          ...metadata
        },
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent']
      });

      return {
        subscriptionId: subscription.id,
        customerId: subscription.customer,
        status: subscription.status,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
        latestInvoice: subscription.latest_invoice
      };
    } catch (error) {
      console.error('Stripe create subscription failed:', error.message);
      throw new Error(`Failed to create subscription: ${error.message}`);
    }
  }

  // Process a payment with a payment method
  static async processPayment(paymentIntentId, paymentMethodId) {
    if (!stripeClient) {
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables.');
    }
    try {
      const paymentIntent = await stripeClient.paymentIntents.confirm(paymentIntentId, {
        payment_method: paymentMethodId
      });

      return {
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        customerId: paymentIntent.customer,
        paymentMethodId: paymentIntent.payment_method
      };
    } catch (error) {
      console.error('Stripe process payment failed:', error.message);
      throw new Error(`Failed to process payment: ${error.message}`);
    }
  }

  // Create a payment method
  static async createPaymentMethod(type, cardData) {
    if (!stripeClient) {
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables.');
    }
    try {
      const paymentMethod = await stripeClient.paymentMethods.create({
        type: type,
        card: cardData
      });

      return {
        paymentMethodId: paymentMethod.id,
        type: paymentMethod.type,
        card: {
          brand: paymentMethod.card.brand,
          last4: paymentMethod.card.last4,
          expMonth: paymentMethod.card.exp_month,
          expYear: paymentMethod.card.exp_year
        },
        customerId: paymentMethod.customer
      };
    } catch (error) {
      console.error('Stripe create payment method failed:', error.message);
      throw new Error(`Failed to create payment method: ${error.message}`);
    }
  }

  // Attach payment method to customer
  static async attachPaymentMethod(paymentMethodId, customerId) {
    if (!stripeClient) {
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables.');
    }
    try {
      const paymentMethod = await stripeClient.paymentMethods.attach(paymentMethodId, {
        customer: customerId
      });

      return {
        paymentMethodId: paymentMethod.id,
        customerId: paymentMethod.customer,
        attached: true
      };
    } catch (error) {
      console.error('Stripe attach payment method failed:', error.message);
      throw new Error(`Failed to attach payment method: ${error.message}`);
    }
  }

  // Get customer's payment methods
  static async getCustomerPaymentMethods(customerId) {
    if (!stripeClient) {
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables.');
    }
    try {
      const paymentMethods = await stripeClient.paymentMethods.list({
        customer: customerId,
        type: 'card'
      });

      return paymentMethods.data.map(pm => ({
        paymentMethodId: pm.id,
        type: pm.type,
        card: {
          brand: pm.card.brand,
          last4: pm.card.last4,
          expMonth: pm.card.exp_month,
          expYear: pm.card.exp_year
        },
        isDefault: pm.metadata.isDefault === 'true'
      }));
    } catch (error) {
      console.error('Stripe get customer payment methods failed:', error.message);
      throw new Error(`Failed to get payment methods: ${error.message}`);
    }
  }

  // Set default payment method
  static async setDefaultPaymentMethod(customerId, paymentMethodId) {
    if (!stripeClient) {
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables.');
    }
    try {
      await stripeClient.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId
        }
      });

      return { success: true, customerId, paymentMethodId };
    } catch (error) {
      console.error('Stripe set default payment method failed:', error.message);
      throw new Error(`Failed to set default payment method: ${error.message}`);
    }
  }

  // Create a refund
  static async createRefund(paymentIntentId, amount, reason = 'requested_by_customer') {
    if (!stripeClient) {
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables.');
    }
    try {
      const refund = await stripeClient.refunds.create({
        payment_intent: paymentIntentId,
        amount: amount,
        reason: reason
      });

      return {
        refundId: refund.id,
        paymentIntentId: refund.payment_intent,
        amount: refund.amount,
        currency: refund.currency,
        status: refund.status,
        reason: refund.reason
      };
    } catch (error) {
      console.error('Stripe create refund failed:', error.message);
      throw new Error(`Failed to create refund: ${error.message}`);
    }
  }

  // Get payment intent details
  static async getPaymentIntent(paymentIntentId) {
    if (!stripeClient) {
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables.');
    }
    try {
      const paymentIntent = await stripeClient.paymentIntents.retrieve(paymentIntentId);

      return {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        customerId: paymentIntent.customer,
        paymentMethodId: paymentIntent.payment_method,
        description: paymentIntent.description,
        metadata: paymentIntent.metadata,
        created: paymentIntent.created,
        lastPaymentError: paymentIntent.last_payment_error
      };
    } catch (error) {
      console.error('Stripe get payment intent failed:', error.message);
      throw new Error(`Failed to get payment intent: ${error.message}`);
    }
  }

  // Get customer details
  static async getCustomer(customerId) {
    if (!stripeClient) {
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables.');
    }
    try {
      const customer = await stripeClient.customers.retrieve(customerId);

      return {
        customerId: customer.id,
        email: customer.email,
        name: customer.name,
        phone: customer.phone,
        created: customer.created,
        metadata: customer.metadata,
        defaultSource: customer.default_source,
        defaultPaymentMethod: customer.invoice_settings?.default_payment_method
      };
    } catch (error) {
      console.error('Stripe get customer failed:', error.message);
      throw new Error(`Failed to get customer: ${error.message}`);
    }
  }

  // Update customer
  static async updateCustomer(customerId, updateData) {
    if (!stripeClient) {
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables.');
    }
    try {
      const customer = await stripeClient.customers.update(customerId, updateData);

      return {
        customerId: customer.id,
        email: customer.email,
        name: customer.name,
        phone: customer.phone,
        updated: true
      };
    } catch (error) {
      console.error('Stripe update customer failed:', error.message);
      throw new Error(`Failed to update customer: ${error.message}`);
    }
  }

  // Delete customer
  static async deleteCustomer(customerId) {
    if (!stripeClient) {
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables.');
    }
    try {
      const customer = await stripeClient.customers.del(customerId);

      return {
        customerId: customer.id,
        deleted: customer.deleted
      };
    } catch (error) {
      console.error('Stripe delete customer failed:', error.message);
      throw new Error(`Failed to delete customer: ${error.message}`);
    }
  }

  // Create a webhook endpoint
  static async createWebhookEndpoint(url, events = ['payment_intent.succeeded', 'payment_intent.payment_failed']) {
    if (!stripeClient) {
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables.');
    }
    try {
      const webhook = await stripeClient.webhookEndpoints.create({
        url: url,
        enabled_events: events
      });

      return {
        webhookId: webhook.id,
        url: webhook.url,
        status: webhook.status,
        events: webhook.enabled_events,
        secret: webhook.secret
      };
    } catch (error) {
      console.error('Stripe create webhook failed:', error.message);
      throw new Error(`Failed to create webhook: ${error.message}`);
    }
  }

  // Verify webhook signature
  static verifyWebhookSignature(payload, signature, secret) {
    if (!stripeClient) {
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables.');
    }
    try {
      const event = stripeClient.webhooks.constructEvent(payload, signature, secret);
      return { valid: true, event };
    } catch (error) {
      console.error('Webhook signature verification failed:', error.message);
      return { valid: false, error: error.message };
    }
  }

  // Get subscription details
  static async getSubscription(subscriptionId) {
    if (!stripeClient) {
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables.');
    }
    try {
      const subscription = await stripeClient.subscriptions.retrieve(subscriptionId);

      return {
        subscriptionId: subscription.id,
        customerId: subscription.customer,
        status: subscription.status,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
        items: subscription.items.data,
        metadata: subscription.metadata
      };
    } catch (error) {
      console.error('Stripe get subscription failed:', error.message);
      throw new Error(`Failed to get subscription: ${error.message}`);
    }
  }

  // Cancel subscription
  static async cancelSubscription(subscriptionId, cancelAtPeriodEnd = true) {
    if (!stripeClient) {
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables.');
    }
    try {
      const subscription = await stripeClient.subscriptions.update(subscriptionId, {
        cancel_at_period_end: cancelAtPeriodEnd
      });

      return {
        subscriptionId: subscription.id,
        status: subscription.status,
        canceledAt: subscription.canceled_at,
        cancelAtPeriodEnd: subscription.cancel_at_period_end
      };
    } catch (error) {
      console.error('Stripe cancel subscription failed:', error.message);
      throw new Error(`Failed to cancel subscription: ${error.message}`);
    }
  }

  // Create invoice
  static async createInvoice(customerId, description, amount, currency = 'usd') {
    if (!stripeClient) {
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables.');
    }
    try {
      const invoice = await stripeClient.invoices.create({
        customer: customerId,
        description: description,
        collection_method: 'charge_automatically',
        auto_advance: true
      });

      // Add invoice item
      await stripeClient.invoiceItems.create({
        customer: customerId,
        invoice: invoice.id,
        amount: amount,
        currency: currency,
        description: description
      });

      // Finalize and send invoice
      const finalizedInvoice = await stripeClient.invoices.finalizeInvoice(invoice.id);
      await stripeClient.invoices.sendInvoice(invoice.id);

      return {
        invoiceId: finalizedInvoice.id,
        customerId: finalizedInvoice.customer,
        amount: finalizedInvoice.amount_due,
        currency: finalizedInvoice.currency,
        status: finalizedInvoice.status,
        hostedInvoiceUrl: finalizedInvoice.hosted_invoice_url
      };
    } catch (error) {
      console.error('Stripe create invoice failed:', error.message);
      throw new Error(`Failed to create invoice: ${error.message}`);
    }
  }
}

// Payment Plans Configuration
const PAYMENT_PLANS = {
  BASIC: {
    id: 'price_basic_monthly',
    name: 'Basic Driver Plan',
    price: 29.99,
    interval: 'month',
    features: [
      'Basic background check',
      'Document storage',
      'Email support'
    ]
  },
  PREMIUM: {
    id: 'price_premium_monthly',
    name: 'Premium Driver Plan',
    price: 49.99,
    interval: 'month',
    features: [
      'Comprehensive background check',
      'Advanced document storage',
      'Priority support',
      'Insurance verification',
      'Payment processing'
    ]
  },
  ENTERPRISE: {
    id: 'price_enterprise_monthly',
    name: 'Enterprise Plan',
    price: 99.99,
    interval: 'month',
    features: [
      'All Premium features',
      'Custom integrations',
      'Dedicated support',
      'Analytics dashboard',
      'API access'
    ]
  }
};

// Onboarding Fee Configuration
const ONBOARDING_FEES = {
  BASIC: 99.99,
  PREMIUM: 149.99,
  ENTERPRISE: 299.99
};

module.exports = {
  PaymentService,
  PAYMENT_PLANS,
  ONBOARDING_FEES,
  stripeClient
}; 