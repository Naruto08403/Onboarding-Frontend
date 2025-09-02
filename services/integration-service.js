const { initializeFirebase, FirebaseAuthService, FirebaseStorageService, FirebaseFirestoreService } = require('./firebase');
const { PaymentService, PAYMENT_PLANS, ONBOARDING_FEES } = require('./payment');
const BackgroundCheckService = require('./background-check');
const InsuranceVerificationService = require('./insurance-verification');
const { query, transaction } = require('../database/connection');

// Comprehensive Integration Service
class IntegrationService {
  constructor() {
    this.firebaseInitialized = false;
    this.backgroundCheckService = new BackgroundCheckService();
    this.insuranceVerificationService = new InsuranceVerificationService();
    
    // Initialize Firebase if configured
    if (process.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      this.initializeFirebase();
    }
  }

  // Initialize Firebase
  async initializeFirebase() {
    try {
      if (this.firebaseInitialized) {
        return true;
      }

      const firebaseApp = initializeFirebase();
      if (firebaseApp) {
        this.firebaseInitialized = true;
        console.log('✅ Firebase integration initialized');
        return true;
      } else {
        console.warn('⚠️ Firebase integration not available');
        return false;
      }
    } catch (error) {
      console.error('❌ Firebase initialization failed:', error.message);
      return false;
    }
  }

  // Complete Driver Onboarding Process
  async performCompleteOnboarding(driverData) {
    try {
      console.log('🚀 Starting complete driver onboarding process...');
      
      const onboardingResult = {
        driverId: driverData.id,
        startedAt: new Date().toISOString(),
        steps: {},
        overallStatus: 'pending',
        summary: {},
        recommendations: []
      };

      // Step 1: Background Check
      console.log('📋 Step 1: Performing background check...');
      try {
        const backgroundCheckResult = await this.backgroundCheckService.performComprehensiveBackgroundCheck(driverData);
        onboardingResult.steps.backgroundCheck = {
          status: 'completed',
          result: backgroundCheckResult,
          completedAt: new Date().toISOString()
        };
      } catch (error) {
        onboardingResult.steps.backgroundCheck = {
          status: 'failed',
          error: error.message,
          completedAt: new Date().toISOString()
        };
      }

      // Step 2: Insurance Verification
      console.log('🛡️ Step 2: Verifying insurance...');
      try {
        const insuranceResult = await this.insuranceVerificationService.performComprehensiveInsuranceVerification(driverData);
        onboardingResult.steps.insuranceVerification = {
          status: 'completed',
          result: insuranceResult,
          completedAt: new Date().toISOString()
        };
      } catch (error) {
        onboardingResult.steps.insuranceVerification = {
          status: 'failed',
          error: error.message,
          completedAt: new Date().toISOString()
        };
      }

      // Step 3: Payment Processing
      console.log('💳 Step 3: Processing payment...');
      try {
        const paymentResult = await this.processOnboardingPayment(driverData);
        onboardingResult.steps.payment = {
          status: 'completed',
          result: paymentResult,
          completedAt: new Date().toISOString()
        };
      } catch (error) {
        onboardingResult.steps.payment = {
          status: 'failed',
          error: error.message,
          completedAt: new Date().toISOString()
        };
      }

      // Step 4: Document Storage (Firebase)
      console.log('📁 Step 4: Storing documents...');
      try {
        const documentResult = await this.storeDriverDocuments(driverData);
        onboardingResult.steps.documentStorage = {
          status: 'completed',
          result: documentResult,
          completedAt: new Date().toISOString()
        };
      } catch (error) {
        onboardingResult.steps.documentStorage = {
          status: 'failed',
          error: error.message,
          completedAt: new Date().toISOString()
        };
      }

      // Step 5: Database Integration
      console.log('🗄️ Step 5: Updating database...');
      try {
        const databaseResult = await this.updateOnboardingStatus(driverData.id, onboardingResult);
        onboardingResult.steps.databaseUpdate = {
          status: 'completed',
          result: databaseResult,
          completedAt: new Date().toISOString()
        };
      } catch (error) {
        onboardingResult.steps.databaseUpdate = {
          status: 'failed',
          error: error.message,
          completedAt: new Date().toISOString()
        };
      }

      // Determine overall status
      const completedSteps = Object.values(onboardingResult.steps).filter(step => step.status === 'completed').length;
      const totalSteps = Object.keys(onboardingResult.steps).length;
      
      if (completedSteps === totalSteps) {
        onboardingResult.overallStatus = 'completed';
      } else if (completedSteps > 0) {
        onboardingResult.overallStatus = 'partial';
      } else {
        onboardingResult.overallStatus = 'failed';
      }

      onboardingResult.completedAt = new Date().toISOString();
      onboardingResult.summary = this.generateOnboardingSummary(onboardingResult.steps);
      onboardingResult.recommendations = this.generateOnboardingRecommendations(onboardingResult.steps);

      console.log('✅ Complete driver onboarding process finished');
      return onboardingResult;
    } catch (error) {
      console.error('❌ Complete driver onboarding failed:', error.message);
      throw error;
    }
  }

  // Process onboarding payment
  async processOnboardingPayment(driverData) {
    try {
      // Create or get customer
      let customer;
      try {
        customer = await PaymentService.getCustomer(driverData.stripeCustomerId);
      } catch (error) {
        // Create new customer if doesn't exist
        customer = await PaymentService.createCustomer({
          id: driverData.id,
          email: driverData.email,
          firstName: driverData.firstName,
          lastName: driverData.lastName,
          phoneNumber: driverData.phoneNumber,
          role: driverData.role,
          status: driverData.status
        });
      }

      // Determine onboarding fee based on plan
      const plan = driverData.subscriptionPlan || 'BASIC';
      const onboardingFee = ONBOARDING_FEES[plan] * 100; // Convert to cents

      // Create payment intent
      const paymentIntent = await PaymentService.createOnboardingPaymentIntent(
        customer.customerId,
        onboardingFee,
        'usd'
      );

      return {
        customerId: customer.customerId,
        paymentIntentId: paymentIntent.paymentIntentId,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        plan: plan,
        onboardingFee: ONBOARDING_FEES[plan]
      };
    } catch (error) {
      console.error('Payment processing failed:', error.message);
      throw error;
    }
  }

  // Store driver documents in Firebase
  async storeDriverDocuments(driverData) {
    try {
      if (!this.firebaseInitialized) {
        throw new Error('Firebase not initialized');
      }

      const documentResults = [];
      
      // Store profile photo if exists
      if (driverData.profilePhoto) {
        const photoResult = await FirebaseStorageService.uploadFile(
          driverData.profilePhoto.buffer,
          driverData.profilePhoto.originalname,
          driverData.profilePhoto.mimetype,
          `drivers/${driverData.id}/profile`
        );
        documentResults.push({
          type: 'profile_photo',
          result: photoResult
        });
      }

      // Store driver license if exists
      if (driverData.driverLicense) {
        const licenseResult = await FirebaseStorageService.uploadFile(
          driverData.driverLicense.buffer,
          driverData.driverLicense.originalname,
          driverData.driverLicense.mimetype,
          `drivers/${driverData.id}/documents`
        );
        documentResults.push({
          type: 'driver_license',
          result: licenseResult
        });
      }

      // Store insurance certificate if exists
      if (driverData.insuranceCertificate) {
        const insuranceResult = await FirebaseStorageService.uploadFile(
          driverData.insuranceCertificate.buffer,
          driverData.insuranceCertificate.originalname,
          driverData.insuranceCertificate.mimetype,
          `drivers/${driverData.id}/documents`
        );
        documentResults.push({
          type: 'insurance_certificate',
          result: insuranceResult
        });
      }

      // Store additional documents
      if (driverData.additionalDocuments) {
        for (const doc of driverData.additionalDocuments) {
          const docResult = await FirebaseStorageService.uploadFile(
            doc.buffer,
            doc.originalname,
            doc.mimetype,
            `drivers/${driverData.id}/documents`
          );
          documentResults.push({
            type: 'additional_document',
            name: doc.originalname,
            result: docResult
          });
        }
      }

      return {
        totalDocuments: documentResults.length,
        documents: documentResults,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET
      };
    } catch (error) {
      console.error('Document storage failed:', error.message);
      throw error;
    }
  }

  // Update onboarding status in database
  async updateOnboardingStatus(driverId, onboardingResult) {
    try {
      const result = await transaction(async (client) => {
        // Update driver profile status
        await client.query(
          `UPDATE driver_profiles 
           SET onboarding_status = $1, 
               onboarding_completed_at = $2,
               updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $3`,
          [onboardingResult.overallStatus, onboardingResult.completedAt, driverId]
        );

        // Insert onboarding record
        const onboardingRecord = await client.query(
          `INSERT INTO onboarding_records 
           (driver_id, overall_status, background_check_status, insurance_status, 
            payment_status, document_status, database_status, started_at, completed_at, 
            summary_data, recommendations)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id`,
          [
            driverId,
            onboardingResult.overallStatus,
            onboardingResult.steps.backgroundCheck?.status || 'pending',
            onboardingResult.steps.insuranceVerification?.status || 'pending',
            onboardingResult.steps.payment?.status || 'pending',
            onboardingResult.steps.documentStorage?.status || 'pending',
            onboardingResult.steps.databaseUpdate?.status || 'pending',
            onboardingResult.startedAt,
            onboardingResult.completedAt,
            JSON.stringify(onboardingResult.summary),
            JSON.stringify(onboardingResult.recommendations)
          ]
        );

        return {
          onboardingRecordId: onboardingRecord.rows[0].id,
          updated: true
        };
      });

      return result;
    } catch (error) {
      console.error('Database update failed:', error.message);
      throw error;
    }
  }

  // Generate onboarding summary
  generateOnboardingSummary(steps) {
    const summary = {
      totalSteps: Object.keys(steps).length,
      completedSteps: 0,
      failedSteps: 0,
      pendingSteps: 0,
      riskLevel: 'low',
      flags: [],
      estimatedCompletion: null
    };

    Object.entries(steps).forEach(([stepName, step]) => {
      if (step.status === 'completed') {
        summary.completedSteps++;
      } else if (step.status === 'failed') {
        summary.failedSteps++;
      } else {
        summary.pendingSteps++;
      }
    });

    // Determine risk level based on failed steps
    if (summary.failedSteps > 2) {
      summary.riskLevel = 'high';
      summary.flags.push('Multiple critical steps failed');
    } else if (summary.failedSteps > 0) {
      summary.riskLevel = 'medium';
      summary.flags.push('Some steps require attention');
    }

    // Estimate completion time
    if (summary.pendingSteps === 0) {
      summary.estimatedCompletion = 'Immediate';
    } else if (summary.pendingSteps <= 2) {
      summary.estimatedCompletion = '1-2 business days';
    } else {
      summary.estimatedCompletion = '3-5 business days';
    }

    return summary;
  }

  // Generate onboarding recommendations
  generateOnboardingRecommendations(steps) {
    const recommendations = [];

    // Background check recommendations
    if (steps.backgroundCheck?.status === 'failed') {
      recommendations.push('Review background check requirements');
      recommendations.push('Provide additional identification documents');
    }

    // Insurance verification recommendations
    if (steps.insuranceVerification?.status === 'failed') {
      recommendations.push('Verify insurance policy information');
      recommendations.push('Ensure policy is active and not expired');
      recommendations.push('Check coverage limits meet requirements');
    }

    // Payment recommendations
    if (steps.payment?.status === 'failed') {
      recommendations.push('Verify payment method information');
      recommendations.push('Ensure sufficient funds are available');
      recommendations.push('Check for any payment restrictions');
    }

    // Document storage recommendations
    if (steps.documentStorage?.status === 'failed') {
      recommendations.push('Ensure all required documents are provided');
      recommendations.push('Check document format and size requirements');
      recommendations.push('Verify document authenticity');
    }

    // General recommendations based on overall status
    const completedSteps = Object.values(steps).filter(step => step.status === 'completed').length;
    const totalSteps = Object.keys(steps).length;

    if (completedSteps === totalSteps) {
      recommendations.push('Onboarding completed successfully');
      recommendations.push('Driver is ready for activation');
    } else if (completedSteps > totalSteps / 2) {
      recommendations.push('Onboarding is mostly complete');
      recommendations.push('Address remaining issues to finish');
    } else {
      recommendations.push('Onboarding requires significant attention');
      recommendations.push('Manual review may be necessary');
    }

    return recommendations;
  }

  // Get onboarding status
  async getOnboardingStatus(driverId) {
    try {
      const result = await query(
        `SELECT * FROM onboarding_records 
         WHERE driver_id = $1 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [driverId]
      );

      if (result.rows.length === 0) {
        return {
          driverId,
          status: 'not_started',
          message: 'No onboarding record found'
        };
      }

      const record = result.rows[0];
      return {
        driverId: record.driver_id,
        overallStatus: record.overall_status,
        backgroundCheckStatus: record.background_check_status,
        insuranceStatus: record.insurance_status,
        paymentStatus: record.payment_status,
        documentStatus: record.document_status,
        databaseStatus: record.database_status,
        startedAt: record.started_at,
        completedAt: record.completed_at,
        summary: record.summary_data,
        recommendations: record.recommendations,
        createdAt: record.created_at
      };
    } catch (error) {
      console.error('Get onboarding status failed:', error.message);
      throw error;
    }
  }

  // Retry failed onboarding step
  async retryOnboardingStep(driverId, stepName) {
    try {
      console.log(`🔄 Retrying ${stepName} for driver ${driverId}...`);
      
      // Get current onboarding status
      const currentStatus = await this.getOnboardingStatus(driverId);
      
      // Get driver data
      const driverData = await this.getDriverData(driverId);
      
      let stepResult;
      
      switch (stepName) {
        case 'backgroundCheck':
          stepResult = await this.backgroundCheckService.performComprehensiveBackgroundCheck(driverData);
          break;
        case 'insuranceVerification':
          stepResult = await this.insuranceVerificationService.performComprehensiveInsuranceVerification(driverData);
          break;
        case 'payment':
          stepResult = await this.processOnboardingPayment(driverData);
          break;
        case 'documentStorage':
          stepResult = await this.storeDriverDocuments(driverData);
          break;
        default:
          throw new Error(`Unknown step: ${stepName}`);
      }

      // Update the specific step in the database
      await this.updateOnboardingStepStatus(driverId, stepName, 'completed', stepResult);
      
      return {
        stepName,
        status: 'retried',
        result: stepResult,
        retryAt: new Date().toISOString()
      };
    } catch (error) {
      console.error(`Retry ${stepName} failed:`, error.message);
      throw error;
    }
  }

  // Get driver data for onboarding
  async getDriverData(driverId) {
    try {
      const result = await query(
        `SELECT u.*, dp.*, v.*, bc.*
         FROM users u
         LEFT JOIN driver_profiles dp ON u.id = dp.user_id
         LEFT JOIN vehicles v ON dp.user_id = v.driver_id
         LEFT JOIN background_checks bc ON dp.user_id = bc.driver_id
         WHERE u.id = $1`,
        [driverId]
      );

      if (result.rows.length === 0) {
        throw new Error('Driver not found');
      }

      const row = result.rows[0];
      return {
        id: row.id,
        email: row.email,
        firstName: row.first_name,
        lastName: row.last_name,
        phoneNumber: row.phone_number,
        role: row.role,
        status: row.status,
        personalInfo: {
          firstName: row.first_name,
          lastName: row.last_name,
          dateOfBirth: row.date_of_birth,
          ssn: row.ssn,
          addresses: row.previous_addresses || []
        },
        driverInfo: {
          driverLicenseNumber: row.driver_license_number,
          state: row.state,
          licenseClass: row.license_class
        },
        vehicleInfo: row.vin ? {
          vin: row.vin,
          make: row.make,
          model: row.model,
          year: row.year,
          licensePlate: row.license_plate
        } : null,
        businessInfo: row.business_name ? {
          businessName: row.business_name,
          businessType: row.business_type,
          ein: row.ein,
          address: row.business_address
        } : null,
        insuranceInfo: row.insurance_policy_number ? {
          policyNumber: row.insurance_policy_number,
          insuranceCompany: row.insurance_company,
          effectiveDate: row.insurance_effective_date,
          expirationDate: row.insurance_expiration_date
        } : null,
        subscriptionPlan: row.subscription_plan || 'BASIC',
        stripeCustomerId: row.stripe_customer_id
      };
    } catch (error) {
      console.error('Get driver data failed:', error.message);
      throw error;
    }
  }

  // Update specific onboarding step status
  async updateOnboardingStepStatus(driverId, stepName, status, result = null) {
    try {
      const stepColumn = `${stepName}_status`;
      const resultColumn = `${stepName}_result`;
      
      await query(
        `UPDATE onboarding_records 
         SET ${stepColumn} = $1, 
             ${resultColumn} = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE driver_id = $3`,
        [status, result ? JSON.stringify(result) : null, driverId]
      );

      return { updated: true };
    } catch (error) {
      console.error('Update step status failed:', error.message);
      throw error;
    }
  }

  // Get integration health status
  async getIntegrationHealth() {
    const health = {
      timestamp: new Date().toISOString(),
      services: {},
      overall: 'healthy'
    };

    // Check Firebase
    try {
      if (this.firebaseInitialized) {
        health.services.firebase = { status: 'healthy', message: 'Firebase integration active' };
      } else {
        health.services.firebase = { status: 'unavailable', message: 'Firebase not configured' };
      }
    } catch (error) {
      health.services.firebase = { status: 'unhealthy', message: error.message };
    }

    // Check Payment Service
    try {
      if (process.env.STRIPE_SECRET_KEY) {
        health.services.payment = { status: 'healthy', message: 'Stripe payment service configured' };
      } else {
        health.services.payment = { status: 'unavailable', message: 'Stripe not configured' };
      }
    } catch (error) {
      health.services.payment = { status: 'unhealthy', message: error.message };
    }

    // Check Background Check Service
    try {
      const hasApiKeys = Object.values(this.backgroundCheckService.apis).some(api => api.apiKey);
      if (hasApiKeys) {
        health.services.backgroundCheck = { status: 'healthy', message: 'Background check APIs configured' };
      } else {
        health.services.backgroundCheck = { status: 'unavailable', message: 'No background check APIs configured' };
      }
    } catch (error) {
      health.services.backgroundCheck = { status: 'unhealthy', message: error.message };
    }

    // Check Insurance Verification Service
    try {
      const hasApiKeys = Object.values(this.insuranceVerificationService.apis).some(api => api.apiKey);
      if (hasApiKeys) {
        health.services.insuranceVerification = { status: 'healthy', message: 'Insurance verification APIs configured' };
      } else {
        health.services.insuranceVerification = { status: 'unavailable', message: 'No insurance verification APIs configured' };
      }
    } catch (error) {
      health.services.insuranceVerification = { status: 'unhealthy', message: error.message };
    }

    // Determine overall health
    const unhealthyServices = Object.values(health.services).filter(service => service.status === 'unhealthy');
    const unavailableServices = Object.values(health.services).filter(service => service.status === 'unavailable');

    if (unhealthyServices.length > 0) {
      health.overall = 'unhealthy';
    } else if (unavailableServices.length > 0) {
      health.overall = 'degraded';
    }

    return health;
  }
}

// Export the service
module.exports = IntegrationService; 