const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const IntegrationService = require('../services/integration-service');

const router = express.Router();
const integrationService = new IntegrationService();

// Start complete onboarding process
router.post('/onboarding/start', authenticateToken, async (req, res) => {
  try {
    const { driverId } = req.body;
    
    if (!driverId) {
      return res.status(400).json({ 
        error: 'Driver ID is required' 
      });
    }

    console.log(`🚀 Starting onboarding for driver: ${driverId}`);
    
    // Get driver data
    const driverData = await integrationService.getDriverData(driverId);
    
    // Perform complete onboarding
    const onboardingResult = await integrationService.performCompleteOnboarding(driverData);
    
    res.status(200).json({
      message: 'Onboarding process started successfully',
      onboardingId: onboardingResult.driverId,
      status: onboardingResult.overallStatus,
      summary: onboardingResult.summary,
      recommendations: onboardingResult.recommendations
    });
  } catch (error) {
    console.error('Start onboarding failed:', error.message);
    res.status(500).json({ 
      error: 'Failed to start onboarding process',
      details: error.message 
    });
  }
});

// Get onboarding status
router.get('/onboarding/:driverId/status', authenticateToken, async (req, res) => {
  try {
    const { driverId } = req.params;
    
    const status = await integrationService.getOnboardingStatus(driverId);
    
    res.status(200).json({
      driverId,
      status: status.overallStatus || status.status,
      details: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get onboarding status failed:', error.message);
    res.status(500).json({ 
      error: 'Failed to get onboarding status',
      details: error.message 
    });
  }
});

// Retry failed onboarding step
router.post('/onboarding/:driverId/retry', authenticateToken, async (req, res) => {
  try {
    const { driverId } = req.params;
    const { stepName } = req.body;
    
    if (!stepName) {
      return res.status(400).json({ 
        error: 'Step name is required' 
      });
    }

    const validSteps = ['backgroundCheck', 'insuranceVerification', 'payment', 'documentStorage'];
    if (!validSteps.includes(stepName)) {
      return res.status(400).json({ 
        error: 'Invalid step name',
        validSteps 
      });
    }

    console.log(`🔄 Retrying ${stepName} for driver: ${driverId}`);
    
    const retryResult = await integrationService.retryOnboardingStep(driverId, stepName);
    
    res.status(200).json({
      message: `Step ${stepName} retry initiated`,
      driverId,
      stepName,
      result: retryResult
    });
  } catch (error) {
    console.error('Retry onboarding step failed:', error.message);
    res.status(500).json({ 
      error: 'Failed to retry onboarding step',
      details: error.message 
    });
  }
});

// Get integration health status
router.get('/health', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const health = await integrationService.getIntegrationHealth();
    
    res.status(200).json({
      message: 'Integration health check completed',
      health,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get integration health failed:', error.message);
    res.status(500).json({ 
      error: 'Failed to get integration health',
      details: error.message 
    });
  }
});

// Background check endpoints
router.post('/background-check/:driverId', authenticateToken, async (req, res) => {
  try {
    const { driverId } = req.params;
    
    console.log(`📋 Starting background check for driver: ${driverId}`);
    
    const driverData = await integrationService.getDriverData(driverId);
    const backgroundCheckResult = await integrationService.backgroundCheckService.performComprehensiveBackgroundCheck(driverData);
    
    res.status(200).json({
      message: 'Background check completed successfully',
      driverId,
      result: backgroundCheckResult,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Background check failed:', error.message);
    res.status(500).json({ 
      error: 'Background check failed',
      details: error.message 
    });
  }
});

// Insurance verification endpoints
router.post('/insurance-verification/:driverId', authenticateToken, async (req, res) => {
  try {
    const { driverId } = req.params;
    
    console.log(`🛡️ Starting insurance verification for driver: ${driverId}`);
    
    const driverData = await integrationService.getDriverData(driverId);
    const insuranceResult = await integrationService.insuranceVerificationService.performComprehensiveInsuranceVerification(driverData);
    
    res.status(200).json({
      message: 'Insurance verification completed successfully',
      driverId,
      result: insuranceResult,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Insurance verification failed:', error.message);
    res.status(500).json({ 
      error: 'Insurance verification failed',
      details: error.message 
    });
  }
});

// Payment processing endpoints
router.post('/payment/:driverId/onboarding', authenticateToken, async (req, res) => {
  try {
    const { driverId } = req.params;
    
    console.log(`💳 Processing onboarding payment for driver: ${driverId}`);
    
    const driverData = await integrationService.getDriverData(driverId);
    const paymentResult = await integrationService.processOnboardingPayment(driverData);
    
    res.status(200).json({
      message: 'Payment processing completed successfully',
      driverId,
      result: paymentResult,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Payment processing failed:', error.message);
    res.status(500).json({ 
      error: 'Payment processing failed',
      details: error.message 
    });
  }
});

// Document storage endpoints
router.post('/documents/:driverId/store', authenticateToken, async (req, res) => {
  try {
    const { driverId } = req.params;
    
    console.log(`📁 Storing documents for driver: ${driverId}`);
    
    const driverData = await integrationService.getDriverData(driverId);
    const documentResult = await integrationService.storeDriverDocuments(driverData);
    
    res.status(200).json({
      message: 'Document storage completed successfully',
      driverId,
      result: documentResult,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Document storage failed:', error.message);
    res.status(500).json({ 
      error: 'Document storage failed',
      details: error.message 
    });
  }
});

// Get background check pricing
router.get('/background-check/pricing', authenticateToken, async (req, res) => {
  try {
    const pricing = integrationService.backgroundCheckService.getBackgroundCheckPricing();
    
    res.status(200).json({
      message: 'Background check pricing retrieved successfully',
      pricing,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get background check pricing failed:', error.message);
    res.status(500).json({ 
      error: 'Failed to get background check pricing',
      details: error.message 
    });
  }
});

// Get insurance verification pricing
router.get('/insurance-verification/pricing', authenticateToken, async (req, res) => {
  try {
    const pricing = integrationService.insuranceVerificationService.getVerificationPricing();
    
    res.status(200).json({
      message: 'Insurance verification pricing retrieved successfully',
      pricing,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get insurance verification pricing failed:', error.message);
    res.status(500).json({ 
      error: 'Failed to get insurance verification pricing',
      details: error.message 
    });
  }
});

// Get payment plans
router.get('/payment/plans', authenticateToken, async (req, res) => {
  try {
    const { PAYMENT_PLANS, ONBOARDING_FEES } = require('../services/payment');
    
    res.status(200).json({
      message: 'Payment plans retrieved successfully',
      plans: PAYMENT_PLANS,
      onboardingFees: ONBOARDING_FEES,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get payment plans failed:', error.message);
    res.status(500).json({ 
      error: 'Failed to get payment plans',
      details: error.message 
    });
  }
});

// Manual verification endpoints (admin only)
router.post('/verification/:driverId/manual', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { driverId } = req.params;
    const { verificationType, status, notes } = req.body;
    
    if (!verificationType || !status) {
      return res.status(400).json({ 
        error: 'Verification type and status are required' 
      });
    }

    console.log(`👤 Manual verification for driver: ${driverId}, type: ${verificationType}`);
    
    // Update the verification status in the database
    await integrationService.updateOnboardingStepStatus(driverId, verificationType, status, { notes, manualVerification: true });
    
    res.status(200).json({
      message: 'Manual verification completed successfully',
      driverId,
      verificationType,
      status,
      notes,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Manual verification failed:', error.message);
    res.status(500).json({ 
      error: 'Manual verification failed',
      details: error.message 
    });
  }
});

// Bulk operations (admin only)
router.post('/bulk/onboarding', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { driverIds, operations } = req.body;
    
    if (!driverIds || !Array.isArray(driverIds) || driverIds.length === 0) {
      return res.status(400).json({ 
        error: 'Driver IDs array is required' 
      });
    }

    if (!operations || !Array.isArray(operations) || operations.length === 0) {
      return res.status(400).json({ 
        error: 'Operations array is required' 
      });
    }

    console.log(`🔄 Bulk operations for ${driverIds.length} drivers`);
    
    const results = [];
    
    for (const driverId of driverIds) {
      try {
        const driverData = await integrationService.getDriverData(driverId);
        const driverResult = { driverId, operations: [] };
        
        for (const operation of operations) {
          try {
            let operationResult;
            
            switch (operation) {
              case 'backgroundCheck':
                operationResult = await integrationService.backgroundCheckService.performComprehensiveBackgroundCheck(driverData);
                break;
              case 'insuranceVerification':
                operationResult = await integrationService.insuranceVerificationService.performComprehensiveInsuranceVerification(driverData);
                break;
              case 'payment':
                operationResult = await integrationService.processOnboardingPayment(driverData);
                break;
              case 'documentStorage':
                operationResult = await integrationService.storeDriverDocuments(driverData);
                break;
              default:
                operationResult = { error: 'Unknown operation' };
            }
            
            driverResult.operations.push({
              operation,
              status: 'completed',
              result: operationResult
            });
          } catch (error) {
            driverResult.operations.push({
              operation,
              status: 'failed',
              error: error.message
            });
          }
        }
        
        results.push(driverResult);
      } catch (error) {
        results.push({
          driverId,
          error: error.message,
          operations: []
        });
      }
    }
    
    res.status(200).json({
      message: 'Bulk operations completed',
      totalDrivers: driverIds.length,
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Bulk operations failed:', error.message);
    res.status(500).json({ 
      error: 'Bulk operations failed',
      details: error.message 
    });
  }
});

module.exports = router; 