const axios = require('axios');
require('dotenv').config();

// Background Check Service Class
class BackgroundCheckService {
  constructor() {
    // Initialize API clients for different background check providers
    this.apis = {
      criminal: {
        baseUrl: process.env.CRIMINAL_CHECK_API_URL || 'https://api.criminalcheck.com',
        apiKey: process.env.CRIMINAL_CHECK_API_KEY,
        timeout: 30000
      },
      driving: {
        baseUrl: process.env.DRIVING_RECORD_API_URL || 'https://api.drivingrecord.com',
        apiKey: process.env.DRIVING_RECORD_API_KEY,
        timeout: 30000
      },
      employment: {
        baseUrl: process.env.EMPLOYMENT_VERIFICATION_API_URL || 'https://api.employmentverify.com',
        apiKey: process.env.EMPLOYMENT_VERIFICATION_API_KEY,
        timeout: 30000
      },
      credit: {
        baseUrl: process.env.CREDIT_CHECK_API_URL || 'https://api.creditcheck.com',
        apiKey: process.env.CREDIT_CHECK_API_KEY,
        timeout: 30000
      }
    };
  }

  // Criminal Background Check
  async performCriminalBackgroundCheck(personalInfo) {
    try {
      const { firstName, lastName, dateOfBirth, ssn, addresses } = personalInfo;
      
      if (!this.apis.criminal.apiKey) {
        throw new Error('Criminal background check API not configured');
      }

      const requestData = {
        firstName,
        lastName,
        dateOfBirth,
        ssn: this.maskSSN(ssn),
        addresses: addresses.map(addr => ({
          street: addr.street,
          city: addr.city,
          state: addr.state,
          zipCode: addr.zipCode,
          country: addr.country || 'US',
          fromDate: addr.fromDate,
          toDate: addr.toDate
        })),
        searchType: 'comprehensive',
        includeAliases: true,
        includeArrests: true,
        includeConvictions: true,
        includeWarrants: true
      };

      const response = await axios.post(
        `${this.apis.criminal.baseUrl}/v1/criminal-check`,
        requestData,
        {
          headers: {
            'Authorization': `Bearer ${this.apis.criminal.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: this.apis.criminal.timeout
        }
      );

      return {
        checkId: response.data.checkId,
        status: response.data.status,
        results: response.data.results,
        summary: {
          totalRecords: response.data.results?.length || 0,
          hasCriminalHistory: response.data.results?.some(r => r.type === 'conviction') || false,
          hasArrests: response.data.results?.some(r => r.type === 'arrest') || false,
          hasWarrants: response.data.results?.some(r => r.type === 'warrant') || false
        },
        completedAt: new Date().toISOString(),
        provider: 'criminal_check_api'
      };
    } catch (error) {
      console.error('Criminal background check failed:', error.message);
      throw new Error(`Criminal background check failed: ${error.message}`);
    }
  }

  // Driving Record Check
  async performDrivingRecordCheck(driverInfo) {
    try {
      const { firstName, lastName, dateOfBirth, driverLicenseNumber, state } = driverInfo;
      
      if (!this.apis.driving.apiKey) {
        throw new Error('Driving record API not configured');
      }

      const requestData = {
        firstName,
        lastName,
        dateOfBirth,
        driverLicenseNumber,
        state,
        searchType: 'comprehensive',
        includeViolations: true,
        includeAccidents: true,
        includeSuspensions: true,
        includeRevocations: true
      };

      const response = await axios.post(
        `${this.apis.driving.baseUrl}/v1/driving-record`,
        requestData,
        {
          headers: {
            'Authorization': `Bearer ${this.apis.driving.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: this.apis.driving.timeout
        }
      );

      return {
        checkId: response.data.checkId,
        status: response.data.status,
        results: response.data.results,
        summary: {
          totalViolations: response.data.results?.violations?.length || 0,
          totalAccidents: response.data.results?.accidents?.length || 0,
          hasSuspensions: response.data.results?.suspensions?.length > 0,
          hasRevocations: response.data.results?.revocations?.length > 0,
          points: response.data.results?.points || 0
        },
        completedAt: new Date().toISOString(),
        provider: 'driving_record_api'
      };
    } catch (error) {
      console.error('Driving record check failed:', error.message);
      throw new Error(`Driving record check failed: ${error.message}`);
    }
  }

  // Employment Verification
  async performEmploymentVerification(employmentInfo) {
    try {
      const { firstName, lastName, ssn, employerName, employerPhone, position, startDate, endDate } = employmentInfo;
      
      if (!this.apis.employment.apiKey) {
        throw new Error('Employment verification API not configured');
      }

      const requestData = {
        firstName,
        lastName,
        ssn: this.maskSSN(ssn),
        employerName,
        employerPhone,
        position,
        startDate,
        endDate,
        verificationType: 'employment',
        includeSalary: false,
        includeReasonForLeaving: true
      };

      const response = await axios.post(
        `${this.apis.employment.baseUrl}/v1/employment-verification`,
        requestData,
        {
          headers: {
            'Authorization': `Bearer ${this.apis.employment.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: this.apis.employment.timeout
        }
      );

      return {
        checkId: response.data.checkId,
        status: response.data.status,
        results: response.data.results,
        summary: {
          verified: response.data.results?.verified || false,
          employmentConfirmed: response.data.results?.employmentConfirmed || false,
          datesConfirmed: response.data.results?.datesConfirmed || false,
          positionConfirmed: response.data.results?.positionConfirmed || false
        },
        completedAt: new Date().toISOString(),
        provider: 'employment_verification_api'
      };
    } catch (error) {
      console.error('Employment verification failed:', error.message);
      throw new Error(`Employment verification failed: ${error.message}`);
    }
  }

  // Credit Check (for financial responsibility)
  async performCreditCheck(personalInfo) {
    try {
      const { firstName, lastName, dateOfBirth, ssn, address } = personalInfo;
      
      if (!this.apis.credit.apiKey) {
        throw new Error('Credit check API not configured');
      }

      const requestData = {
        firstName,
        lastName,
        dateOfBirth,
        ssn: this.maskSSN(ssn),
        address: {
          street: address.street,
          city: address.city,
          state: address.state,
          zipCode: address.zipCode
        },
        reportType: 'soft_pull', // Soft pull for employment purposes
        includeScore: true,
        includeHistory: false
      };

      const response = await axios.post(
        `${this.apis.credit.baseUrl}/v1/credit-check`,
        requestData,
        {
          headers: {
            'Authorization': `Bearer ${this.apis.credit.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: this.apis.credit.timeout
        }
      );

      return {
        checkId: response.data.checkId,
        status: response.data.status,
        results: response.data.results,
        summary: {
          creditScore: response.data.results?.creditScore,
          hasCreditHistory: response.data.results?.hasCreditHistory || false,
          totalAccounts: response.data.results?.totalAccounts || 0,
          delinquentAccounts: response.data.results?.delinquentAccounts || 0
        },
        completedAt: new Date().toISOString(),
        provider: 'credit_check_api'
      };
    } catch (error) {
      console.error('Credit check failed:', error.message);
      throw new Error(`Credit check failed: ${error.message}`);
    }
  }

  // Comprehensive Background Check
  async performComprehensiveBackgroundCheck(driverData) {
    try {
      console.log('🚀 Starting comprehensive background check...');
      
      const results = {
        driverId: driverData.id,
        startedAt: new Date().toISOString(),
        checks: {},
        overallStatus: 'pending',
        summary: {}
      };

      // Perform all checks in parallel
      const checkPromises = [
        this.performCriminalBackgroundCheck(driverData.personalInfo)
          .then(result => ({ type: 'criminal', result }))
          .catch(error => ({ type: 'criminal', error: error.message })),
        
        this.performDrivingRecordCheck(driverData.driverInfo)
          .then(result => ({ type: 'driving', result }))
          .catch(error => ({ type: 'driving', error: error.message })),
        
        this.performEmploymentVerification(driverData.employmentInfo)
          .then(result => ({ type: 'employment', result }))
          .catch(error => ({ type: 'employment', error: error.message }))
      ];

      // Add credit check if enabled
      if (process.env.ENABLE_CREDIT_CHECK === 'true') {
        checkPromises.push(
          this.performCreditCheck(driverData.personalInfo)
            .then(result => ({ type: 'credit', result }))
            .catch(error => ({ type: 'credit', error: error.message }))
        );
      }

      const checkResults = await Promise.allSettled(checkPromises);

      // Process results
      checkResults.forEach((checkResult, index) => {
        if (checkResult.status === 'fulfilled') {
          const { type, result, error } = checkResult.value;
          if (error) {
            results.checks[type] = { status: 'failed', error };
          } else {
            results.checks[type] = { status: 'completed', result };
          }
        } else {
          const type = ['criminal', 'driving', 'employment', 'credit'][index];
          results.checks[type] = { status: 'failed', error: checkResult.reason?.message || 'Unknown error' };
        }
      });

      // Determine overall status
      const completedChecks = Object.values(results.checks).filter(c => c.status === 'completed').length;
      const totalChecks = Object.keys(results.checks).length;
      
      if (completedChecks === totalChecks) {
        results.overallStatus = 'completed';
      } else if (completedChecks > 0) {
        results.overallStatus = 'partial';
      } else {
        results.overallStatus = 'failed';
      }

      results.completedAt = new Date().toISOString();
      results.summary = this.generateSummary(results.checks);

      console.log('✅ Comprehensive background check completed');
      return results;
    } catch (error) {
      console.error('❌ Comprehensive background check failed:', error.message);
      throw error;
    }
  }

  // Get background check status
  async getBackgroundCheckStatus(checkId) {
    try {
      // This would typically query the database for stored results
      // For now, return a mock response
      return {
        checkId,
        status: 'completed',
        lastUpdated: new Date().toISOString(),
        estimatedCompletion: null
      };
    } catch (error) {
      console.error('Get background check status failed:', error.message);
      throw error;
    }
  }

  // Retry failed background check
  async retryBackgroundCheck(checkId, checkType) {
    try {
      console.log(`🔄 Retrying ${checkType} background check for ${checkId}...`);
      
      // Implementation would depend on the specific API provider
      // This is a placeholder for the retry logic
      
      return {
        checkId,
        checkType,
        status: 'retrying',
        retryCount: 1,
        retryAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Retry background check failed:', error.message);
      throw error;
    }
  }

  // Generate summary of background check results
  generateSummary(checks) {
    const summary = {
      totalChecks: Object.keys(checks).length,
      completedChecks: 0,
      failedChecks: 0,
      riskLevel: 'low',
      flags: [],
      recommendations: []
    };

    Object.entries(checks).forEach(([type, check]) => {
      if (check.status === 'completed') {
        summary.completedChecks++;
        
        // Analyze results for risk assessment
        if (type === 'criminal' && check.result?.summary?.hasCriminalHistory) {
          summary.flags.push('Criminal history detected');
          summary.riskLevel = 'high';
        }
        
        if (type === 'driving' && check.result?.summary?.totalViolations > 3) {
          summary.flags.push('Multiple driving violations');
          summary.riskLevel = 'medium';
        }
        
        if (type === 'employment' && !check.result?.summary?.verified) {
          summary.flags.push('Employment verification failed');
          summary.riskLevel = 'medium';
        }
      } else {
        summary.failedChecks++;
      }
    });

    // Generate recommendations based on results
    if (summary.riskLevel === 'high') {
      summary.recommendations.push('Manual review required');
      summary.recommendations.push('Additional documentation may be needed');
    } else if (summary.riskLevel === 'medium') {
      summary.recommendations.push('Review specific flagged items');
      summary.recommendations.push('Consider additional verification');
    } else {
      summary.recommendations.push('Standard onboarding process');
    }

    return summary;
  }

  // Mask SSN for API calls (show only last 4 digits)
  maskSSN(ssn) {
    if (!ssn) return null;
    const cleaned = ssn.replace(/\D/g, '');
    if (cleaned.length === 9) {
      return `***-**-${cleaned.slice(-4)}`;
    }
    return ssn;
  }

  // Validate personal information
  validatePersonalInfo(personalInfo) {
    const required = ['firstName', 'lastName', 'dateOfBirth', 'ssn'];
    const missing = required.filter(field => !personalInfo[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    // Validate SSN format
    const ssnRegex = /^\d{3}-?\d{2}-?\d{4}$/;
    if (!ssnRegex.test(personalInfo.ssn)) {
      throw new Error('Invalid SSN format');
    }

    // Validate date of birth
    const dob = new Date(personalInfo.dateOfBirth);
    if (isNaN(dob.getTime())) {
      throw new Error('Invalid date of birth');
    }

    // Check if person is at least 18 years old
    const age = Date.now() - dob.getTime();
    const ageInYears = age / (1000 * 60 * 60 * 24 * 365.25);
    if (ageInYears < 18) {
      throw new Error('Driver must be at least 18 years old');
    }

    return true;
  }

  // Get background check pricing
  getBackgroundCheckPricing() {
    return {
      criminal: {
        basic: 29.99,
        comprehensive: 49.99,
        includes: ['National criminal database', 'Sex offender registry', 'Terrorist watchlist']
      },
      driving: {
        basic: 19.99,
        comprehensive: 39.99,
        includes: ['License verification', 'Violation history', 'Accident reports']
      },
      employment: {
        basic: 24.99,
        comprehensive: 44.99,
        includes: ['Employment verification', 'Reference checks', 'Education verification']
      },
      credit: {
        basic: 14.99,
        comprehensive: 29.99,
        includes: ['Credit score', 'Credit history summary', 'Public records']
      },
      packages: {
        basic: 69.99,
        standard: 119.99,
        premium: 199.99
      }
    };
  }
}

// Export the service
module.exports = BackgroundCheckService; 