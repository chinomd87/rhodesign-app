// Stripe Payment Integration Service
// Subscription billing, payments, and invoice automation

import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc,
  query, 
  where, 
  orderBy,
  limit,
  getDocs,
  serverTimestamp 
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../firebase/config';

/**
 * Stripe Payment Integration Service
 * 
 * Provides comprehensive Stripe integration:
 * - Customer and subscription management
 * - Payment processing for signed contracts
 * - Invoice automation and billing
 * - Usage-based billing for API calls
 * - Payment link generation
 * - Webhook handling for payment events
 * - Revenue analytics and reporting
 */
class StripeIntegrationService {
  constructor() {
    this.integrationsCollection = collection(db, 'stripeIntegrations');
    this.customersCollection = collection(db, 'stripeCustomers');
    this.subscriptionsCollection = collection(db, 'stripeSubscriptions');
    this.paymentsCollection = collection(db, 'stripePayments');
    this.invoicesCollection = collection(db, 'stripeInvoices');
    this.webhookLogsCollection = collection(db, 'stripeWebhookLogs');

    // Stripe API configuration
    this.stripeConfig = {
      apiKey: process.env.REACT_APP_STRIPE_SECRET_KEY,
      publishableKey: process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY,
      webhookSecret: process.env.REACT_APP_STRIPE_WEBHOOK_SECRET,
      apiVersion: '2023-10-16',
      apiBaseUrl: 'https://api.stripe.com/v1'
    };

    // Pricing plans
    this.pricingPlans = {
      starter: {
        name: 'Starter Plan',
        description: 'Perfect for small businesses and individuals',
        monthlyPrice: 29,
        yearlyPrice: 290,
        features: [
          'Up to 50 documents per month',
          'Basic electronic signatures',
          'Email support',
          'Basic templates'
        ],
        limits: {
          documentsPerMonth: 50,
          apiCallsPerMonth: 1000,
          storageGB: 5
        },
        stripePriceIds: {
          monthly: 'price_starter_monthly',
          yearly: 'price_starter_yearly'
        }
      },
      professional: {
        name: 'Professional Plan',
        description: 'For growing businesses with advanced needs',
        monthlyPrice: 79,
        yearlyPrice: 790,
        features: [
          'Up to 200 documents per month',
          'Advanced electronic signatures',
          'Priority support',
          'Custom templates',
          'API access',
          'Team collaboration'
        ],
        limits: {
          documentsPerMonth: 200,
          apiCallsPerMonth: 10000,
          storageGB: 25
        },
        stripePriceIds: {
          monthly: 'price_professional_monthly',
          yearly: 'price_professional_yearly'
        }
      },
      enterprise: {
        name: 'Enterprise Plan',
        description: 'For large organizations with custom requirements',
        monthlyPrice: 199,
        yearlyPrice: 1990,
        features: [
          'Unlimited documents',
          'Qualified electronic signatures (eIDAS)',
          'Dedicated support',
          'Custom integrations',
          'Advanced API access',
          'White-label solutions',
          'SSO integration'
        ],
        limits: {
          documentsPerMonth: -1, // Unlimited
          apiCallsPerMonth: 100000,
          storageGB: 100
        },
        stripePriceIds: {
          monthly: 'price_enterprise_monthly',
          yearly: 'price_enterprise_yearly'
        }
      }
    };

    // Usage-based pricing
    this.usagePricing = {
      additionalDocuments: {
        price: 2, // $2 per document over plan limit
        stripePriceId: 'price_additional_documents'
      },
      additionalApiCalls: {
        price: 0.001, // $0.001 per API call over plan limit
        stripePriceId: 'price_additional_api_calls'
      },
      additionalStorage: {
        price: 5, // $5 per GB over plan limit
        stripePriceId: 'price_additional_storage'
      }
    };

    this.initializeStripeIntegration();
  }

  /**
   * Create or update Stripe customer
   */
  async createOrUpdateCustomer(customerRequest) {
    try {
      const {
        userId,
        organizationId,
        email,
        name,
        phone = null,
        address = null,
        metadata = {}
      } = customerRequest;

      const customerId = `customer_${Date.now()}`;

      // Check if customer already exists
      const existingCustomerQuery = query(
        this.customersCollection,
        where('userId', '==', userId),
        where('organizationId', '==', organizationId)
      );
      const existingSnapshot = await getDocs(existingCustomerQuery);

      let stripeCustomer;
      let customerRecord;

      if (!existingSnapshot.empty) {
        // Update existing customer
        const existingDoc = existingSnapshot.docs[0];
        const existingData = existingDoc.data();

        stripeCustomer = await this.updateStripeCustomer(existingData.stripeCustomerId, {
          email,
          name,
          phone,
          address,
          metadata: {
            ...metadata,
            userId,
            organizationId,
            rhodesignCustomerId: customerId
          }
        });

        customerRecord = {
          ...existingData,
          email,
          name,
          phone,
          address,
          metadata,
          updatedAt: serverTimestamp()
        };

        await updateDoc(doc(this.customersCollection, existingDoc.id), customerRecord);

      } else {
        // Create new customer
        stripeCustomer = await this.createStripeCustomer({
          email,
          name,
          phone,
          address,
          metadata: {
            ...metadata,
            userId,
            organizationId,
            rhodesignCustomerId: customerId
          }
        });

        customerRecord = {
          customerId,
          userId,
          organizationId,
          stripeCustomerId: stripeCustomer.id,
          email,
          name,
          phone,
          address,
          metadata,
          paymentMethods: [],
          defaultPaymentMethod: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        await addDoc(this.customersCollection, customerRecord);
      }

      return {
        success: true,
        customerId: customerRecord.customerId,
        stripeCustomerId: stripeCustomer.id,
        customer: customerRecord
      };

    } catch (error) {
      console.error('Failed to create/update Stripe customer:', error);
      throw new Error(`Customer management failed: ${error.message}`);
    }
  }

  /**
   * Create subscription for customer
   */
  async createSubscription(subscriptionRequest) {
    try {
      const {
        customerId,
        planId, // 'starter', 'professional', 'enterprise'
        billingCycle = 'monthly', // 'monthly', 'yearly'
        trialDays = 14,
        couponId = null,
        metadata = {}
      } = subscriptionRequest;

      const subscriptionId = `sub_${Date.now()}`;

      // Get customer record
      const customerQuery = query(
        this.customersCollection,
        where('customerId', '==', customerId)
      );
      const customerSnapshot = await getDocs(customerQuery);

      if (customerSnapshot.empty) {
        throw new Error('Customer not found');
      }

      const customerDoc = customerSnapshot.docs[0];
      const customerData = customerDoc.data();

      // Get pricing plan
      const plan = this.pricingPlans[planId];
      if (!plan) {
        throw new Error(`Invalid plan: ${planId}`);
      }

      // Create Stripe subscription
      const subscriptionData = {
        customer: customerData.stripeCustomerId,
        items: [{
          price: plan.stripePriceIds[billingCycle]
        }],
        trial_period_days: trialDays,
        metadata: {
          ...metadata,
          customerId,
          planId,
          billingCycle,
          rhodesignSubscriptionId: subscriptionId
        }
      };

      if (couponId) {
        subscriptionData.coupon = couponId;
      }

      const stripeSubscription = await this.createStripeSubscription(subscriptionData);

      // Create local subscription record
      const subscriptionRecord = {
        subscriptionId,
        customerId,
        stripeSubscriptionId: stripeSubscription.id,
        stripeCustomerId: customerData.stripeCustomerId,
        planId,
        billingCycle,
        status: stripeSubscription.status,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        trialEnd: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null,
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        planLimits: plan.limits,
        usage: {
          documentsThisPeriod: 0,
          apiCallsThisPeriod: 0,
          storageUsedGB: 0
        },
        couponId,
        metadata,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await addDoc(this.subscriptionsCollection, subscriptionRecord);

      // Update customer with subscription info
      await updateDoc(doc(this.customersCollection, customerDoc.id), {
        activeSubscriptionId: subscriptionId,
        planId,
        updatedAt: serverTimestamp()
      });

      return {
        success: true,
        subscriptionId,
        stripeSubscriptionId: stripeSubscription.id,
        subscription: subscriptionRecord,
        plan
      };

    } catch (error) {
      console.error('Failed to create subscription:', error);
      throw new Error(`Subscription creation failed: ${error.message}`);
    }
  }

  /**
   * Process payment for signed contract
   */
  async processContractPayment(paymentRequest) {
    try {
      const {
        customerId,
        documentId,
        amount, // in cents
        currency = 'usd',
        description,
        metadata = {},
        paymentMethodId = null,
        createInvoice = true
      } = paymentRequest;

      const paymentId = `payment_${Date.now()}`;

      // Get customer record
      const customerQuery = query(
        this.customersCollection,
        where('customerId', '==', customerId)
      );
      const customerSnapshot = await getDocs(customerQuery);

      if (customerSnapshot.empty) {
        throw new Error('Customer not found');
      }

      const customerData = customerSnapshot.docs[0].data();

      // Create payment intent
      const paymentIntentData = {
        amount,
        currency,
        customer: customerData.stripeCustomerId,
        description: description || 'Contract payment',
        metadata: {
          ...metadata,
          customerId,
          documentId,
          rhodesignPaymentId: paymentId
        }
      };

      if (paymentMethodId) {
        paymentIntentData.payment_method = paymentMethodId;
        paymentIntentData.confirm = true;
      }

      const paymentIntent = await this.createStripePaymentIntent(paymentIntentData);

      // Create local payment record
      const paymentRecord = {
        paymentId,
        customerId,
        documentId,
        stripePaymentIntentId: paymentIntent.id,
        stripeCustomerId: customerData.stripeCustomerId,
        amount,
        currency,
        status: paymentIntent.status,
        description,
        paymentMethodId,
        metadata,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await addDoc(this.paymentsCollection, paymentRecord);

      // Create invoice if requested
      let invoiceRecord = null;
      if (createInvoice) {
        invoiceRecord = await this.createContractInvoice({
          customerId,
          documentId,
          paymentId,
          amount,
          currency,
          description
        });
      }

      return {
        success: true,
        paymentId,
        stripePaymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        status: paymentIntent.status,
        invoice: invoiceRecord
      };

    } catch (error) {
      console.error('Failed to process contract payment:', error);
      throw new Error(`Payment processing failed: ${error.message}`);
    }
  }

  /**
   * Track usage and create usage-based billing
   */
  async trackUsage(usageRequest) {
    try {
      const {
        subscriptionId,
        usageType, // 'documents', 'api_calls', 'storage'
        quantity,
        timestamp = new Date()
      } = usageRequest;

      // Get subscription record
      const subscriptionQuery = query(
        this.subscriptionsCollection,
        where('subscriptionId', '==', subscriptionId)
      );
      const subscriptionSnapshot = await getDocs(subscriptionQuery);

      if (subscriptionSnapshot.empty) {
        throw new Error('Subscription not found');
      }

      const subscriptionDoc = subscriptionSnapshot.docs[0];
      const subscriptionData = subscriptionDoc.data();

      // Update usage tracking
      const currentUsage = subscriptionData.usage || {};
      const usageField = `${usageType}ThisPeriod`;
      const newUsage = (currentUsage[usageField] || 0) + quantity;

      // Check if usage exceeds plan limits
      const planLimits = subscriptionData.planLimits;
      const limitField = `${usageType}PerMonth`;
      const limit = planLimits[limitField];

      let overage = 0;
      if (limit > 0 && newUsage > limit) {
        overage = newUsage - limit;
      }

      // Update subscription usage
      await updateDoc(doc(this.subscriptionsCollection, subscriptionDoc.id), {
        [`usage.${usageField}`]: newUsage,
        updatedAt: serverTimestamp()
      });

      // Create usage record for Stripe if there's overage
      let usageRecord = null;
      if (overage > 0) {
        const usagePricing = this.usagePricing[`additional${usageType.charAt(0).toUpperCase()}${usageType.slice(1)}`];
        if (usagePricing) {
          usageRecord = await this.createStripeUsageRecord(
            subscriptionData.stripeSubscriptionId,
            usagePricing.stripePriceId,
            overage,
            timestamp
          );
        }
      }

      return {
        success: true,
        subscriptionId,
        usageType,
        quantity,
        totalUsage: newUsage,
        limit,
        overage,
        usageRecord
      };

    } catch (error) {
      console.error('Failed to track usage:', error);
      throw new Error(`Usage tracking failed: ${error.message}`);
    }
  }

  /**
   * Generate payment link for contract
   */
  async generatePaymentLink(linkRequest) {
    try {
      const {
        documentId,
        amount,
        currency = 'usd',
        description,
        customerEmail = null,
        expiresAt = null,
        metadata = {}
      } = linkRequest;

      const linkId = `link_${Date.now()}`;

      // Create Stripe payment link
      const paymentLinkData = {
        line_items: [{
          price_data: {
            currency,
            product_data: {
              name: description || 'Contract Payment',
              metadata: {
                documentId,
                rhodesignLinkId: linkId
              }
            },
            unit_amount: amount
          },
          quantity: 1
        }],
        metadata: {
          ...metadata,
          documentId,
          rhodesignLinkId: linkId
        }
      };

      if (customerEmail) {
        paymentLinkData.customer_creation = 'always';
        paymentLinkData.customer_email = customerEmail;
      }

      if (expiresAt) {
        paymentLinkData.expires_at = Math.floor(expiresAt.getTime() / 1000);
      }

      const stripePaymentLink = await this.createStripePaymentLink(paymentLinkData);

      // Store payment link record
      const linkRecord = {
        linkId,
        documentId,
        stripePaymentLinkId: stripePaymentLink.id,
        url: stripePaymentLink.url,
        amount,
        currency,
        description,
        customerEmail,
        expiresAt,
        status: 'active',
        metadata,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'paymentLinks'), linkRecord);

      return {
        success: true,
        linkId,
        url: stripePaymentLink.url,
        stripePaymentLinkId: stripePaymentLink.id,
        expiresAt
      };

    } catch (error) {
      console.error('Failed to generate payment link:', error);
      throw new Error(`Payment link generation failed: ${error.message}`);
    }
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhookEvent(webhookRequest) {
    try {
      const {
        event,
        signature,
        rawBody
      } = webhookRequest;

      const webhookId = `webhook_${Date.now()}`;

      // Verify webhook signature
      const isValid = await this.verifyWebhookSignature(rawBody, signature);
      if (!isValid) {
        throw new Error('Invalid webhook signature');
      }

      // Process event based on type
      let processResult = null;
      switch (event.type) {
        case 'payment_intent.succeeded':
          processResult = await this.handlePaymentSucceeded(event.data.object);
          break;
        case 'payment_intent.payment_failed':
          processResult = await this.handlePaymentFailed(event.data.object);
          break;
        case 'customer.subscription.created':
          processResult = await this.handleSubscriptionCreated(event.data.object);
          break;
        case 'customer.subscription.updated':
          processResult = await this.handleSubscriptionUpdated(event.data.object);
          break;
        case 'customer.subscription.deleted':
          processResult = await this.handleSubscriptionDeleted(event.data.object);
          break;
        case 'invoice.payment_succeeded':
          processResult = await this.handleInvoicePaymentSucceeded(event.data.object);
          break;
        case 'invoice.payment_failed':
          processResult = await this.handleInvoicePaymentFailed(event.data.object);
          break;
        default:
          processResult = { message: `Unhandled event type: ${event.type}` };
      }

      // Log webhook event
      await addDoc(this.webhookLogsCollection, {
        webhookId,
        eventId: event.id,
        eventType: event.type,
        processResult,
        status: 'processed',
        receivedAt: serverTimestamp()
      });

      return {
        success: true,
        webhookId,
        eventType: event.type,
        processResult
      };

    } catch (error) {
      console.error('Failed to handle webhook event:', error);
      
      // Log failed webhook
      await addDoc(this.webhookLogsCollection, {
        webhookId: `webhook_${Date.now()}`,
        eventType: webhookRequest.event?.type || 'unknown',
        error: error.message,
        status: 'failed',
        receivedAt: serverTimestamp()
      });

      throw new Error(`Webhook processing failed: ${error.message}`);
    }
  }

  // Helper methods

  async createStripeCustomer(customerData) {
    const response = await fetch(`${this.stripeConfig.apiBaseUrl}/customers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.stripeConfig.apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: this.buildFormData(customerData)
    });

    if (!response.ok) {
      throw new Error('Failed to create Stripe customer');
    }

    return await response.json();
  }

  async updateStripeCustomer(customerId, updateData) {
    const response = await fetch(`${this.stripeConfig.apiBaseUrl}/customers/${customerId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.stripeConfig.apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: this.buildFormData(updateData)
    });

    if (!response.ok) {
      throw new Error('Failed to update Stripe customer');
    }

    return await response.json();
  }

  async createStripeSubscription(subscriptionData) {
    const response = await fetch(`${this.stripeConfig.apiBaseUrl}/subscriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.stripeConfig.apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: this.buildFormData(subscriptionData)
    });

    if (!response.ok) {
      throw new Error('Failed to create Stripe subscription');
    }

    return await response.json();
  }

  async createStripePaymentIntent(paymentData) {
    const response = await fetch(`${this.stripeConfig.apiBaseUrl}/payment_intents`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.stripeConfig.apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: this.buildFormData(paymentData)
    });

    if (!response.ok) {
      throw new Error('Failed to create Stripe payment intent');
    }

    return await response.json();
  }

  async createStripePaymentLink(linkData) {
    const response = await fetch(`${this.stripeConfig.apiBaseUrl}/payment_links`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.stripeConfig.apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: this.buildFormData(linkData)
    });

    if (!response.ok) {
      throw new Error('Failed to create Stripe payment link');
    }

    return await response.json();
  }

  buildFormData(data, prefix = '') {
    const formData = new URLSearchParams();
    
    for (const [key, value] of Object.entries(data)) {
      const fieldName = prefix ? `${prefix}[${key}]` : key;
      
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        // Nested object
        for (const [nestedKey, nestedValue] of Object.entries(value)) {
          formData.append(`${fieldName}[${nestedKey}]`, nestedValue);
        }
      } else {
        formData.append(fieldName, value);
      }
    }
    
    return formData;
  }

  async verifyWebhookSignature(payload, signature) {
    // Implementation would use Stripe's webhook signature verification
    return true; // Mock implementation
  }

  async initializeStripeIntegration() {
    console.log('Stripe Integration Service initialized');
  }

  // Additional helper methods would be implemented here...
  async createContractInvoice(invoiceData) { return {}; }
  async createStripeUsageRecord(subscriptionId, priceId, quantity, timestamp) { return {}; }
  async handlePaymentSucceeded(paymentIntent) { return {}; }
  async handlePaymentFailed(paymentIntent) { return {}; }
  async handleSubscriptionCreated(subscription) { return {}; }
  async handleSubscriptionUpdated(subscription) { return {}; }
  async handleSubscriptionDeleted(subscription) { return {}; }
  async handleInvoicePaymentSucceeded(invoice) { return {}; }
  async handleInvoicePaymentFailed(invoice) { return {}; }
}

export default new StripeIntegrationService();
