const axios = require('axios');
require('dotenv').config();

// Insurance Verification Service Class
class InsuranceVerificationService {
  constructor() {
    // Initialize API clients for different insurance providers
    this.apis = {
      // Major insurance providers
      progressive: {
        baseUrl: process.env.PROGRESSIVE_API_URL || 'https://api.progressive.com',
        apiKey: process.env.PROGRESSIVE_API_KEY,
        timeout: 30000
      },
      geico: {
        baseUrl: process.env.GEICO_API_URL || 'https://api.geico.com',
        apiKey: process.env.GEICO_API_KEY,
        timeout: 30000
      },
      statefarm: {
        baseUrl: process.env.STATEFARM_API_URL || 'https://api.statefarm.com',
        apiKey: process.env.STATEFARM_API_KEY,
        timeout: 30000
      },
      allstate: {
        baseUrl: process.env.ALLSTATE_API_URL || 'https://api.allstate.com',
        apiKey: process.env.ALLSTATE_API_KEY,
        timeout: 30000
      },
      // Insurance verification aggregators
      verisk: {
        baseUrl: process.env.VERISK_API_URL || 'https://api.verisk.com',
        apiKey: process.env.VERISK_API_KEY,
        timeout: 30000
      },
      lexisnexis: {
        baseUrl: process.env.LEXISNEXIS_API_URL || 'https://api.lexisnexis.com',
        apiKey: process.env.LEXISNEXIS_API_KEY,
        timeout: 30000
      }
    };
  }

  // Verify insurance policy by policy number
  async verifyPolicyByNumber(policyInfo) {
    try {
      const { policyNumber, insuranceCompany, driverInfo } = policyInfo;
      
      // Determine which API to use based on insurance company
      const apiConfig = this.getApiConfig(insuranceCompany);
      if (!apiConfig) {
        throw new Error(`Insurance company ${insuranceCompany} not supported`);
      }

      const requestData = {
        policyNumber,
        driverInfo: {
          firstName: driverInfo.firstName,
          lastName: driverInfo.lastName,
          dateOfBirth: driverInfo.dateOfBirth,
          driverLicenseNumber: driverInfo.driverLicenseNumber,
          state: driverInfo.state
        },
        verificationType: 'policy_verification'
      };

      const response = await axios.post(
        `${apiConfig.baseUrl}/v1/insurance/verify`,
        requestData,
        {
          headers: {
            'Authorization': `Bearer ${apiConfig.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: apiConfig.timeout
        }
      );

      return {
        verificationId: response.data.verificationId,
        status: response.data.status,
        policyDetails: response.data.policyDetails,
        coverage: response.data.coverage,
        driverInfo: response.data.driverInfo,
        verificationDate: new Date().toISOString(),
        provider: insuranceCompany,
        apiProvider: this.getApiProviderName(insuranceCompany)
      };
    } catch (error) {
      console.error('Insurance policy verification failed:', error.message);
      throw new Error(`Insurance verification failed: ${error.message}`);
    }
  }

  // Verify insurance by driver information
  async verifyInsuranceByDriver(driverInfo) {
    try {
      const { firstName, lastName, dateOfBirth, driverLicenseNumber, state, vehicleInfo } = driverInfo;
      
      // Use aggregator API for broader search
      const apiConfig = this.apis.verisk;
      if (!apiConfig.apiKey) {
        throw new Error('Insurance verification API not configured');
      }

      const requestData = {
        driverInfo: {
          firstName,
          lastName,
          dateOfBirth,
          driverLicenseNumber,
          state
        },
        vehicleInfo: vehicleInfo ? {
          vin: vehicleInfo.vin,
          make: vehicleInfo.make,
          model: vehicleInfo.model,
          year: vehicleInfo.year
        } : null,
        searchType: 'comprehensive',
        includeExpired: false,
        includeCancelled: false
      };

      const response = await axios.post(
        `${apiConfig.baseUrl}/v1/insurance/search`,
        requestData,
        {
          headers: {
            'Authorization': `Bearer ${apiConfig.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: apiConfig.timeout
        }
      );

      return {
        verificationId: response.data.verificationId,
        status: response.data.status,
        policies: response.data.policies || [],
        activePolicies: response.data.policies?.filter(p => p.status === 'active') || [],
        verificationDate: new Date().toISOString(),
        provider: 'verisk',
        apiProvider: 'Verisk'
      };
    } catch (error) {
      console.error('Insurance verification by driver failed:', error.message);
      throw new Error(`Insurance verification failed: ${error.message}`);
    }
  }

  // Verify vehicle insurance coverage
  async verifyVehicleInsurance(vehicleInfo) {
    try {
      const { vin, make, model, year, licensePlate, state } = vehicleInfo;
      
      // Use LexisNexis for vehicle insurance verification
      const apiConfig = this.apis.lexisnexis;
      if (!apiConfig.apiKey) {
        throw new Error('Vehicle insurance verification API not configured');
      }

      const requestData = {
        vehicleInfo: {
          vin,
          make,
          model,
          year,
          licensePlate,
          state
        },
        verificationType: 'vehicle_coverage',
        includeOwnerInfo: true,
        includeLienholderInfo: true
      };

      const response = await axios.post(
        `${apiConfig.baseUrl}/v1/vehicle/insurance`,
        requestData,
        {
          headers: {
            'Authorization': `Bearer ${apiConfig.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: apiConfig.timeout
        }
      );

      return {
        verificationId: response.data.verificationId,
        status: response.data.status,
        vehicleInfo: response.data.vehicleInfo,
        insuranceInfo: response.data.insuranceInfo,
        ownerInfo: response.data.ownerInfo,
        verificationDate: new Date().toISOString(),
        provider: 'lexisnexis',
        apiProvider: 'LexisNexis'
      };
    } catch (error) {
      console.error('Vehicle insurance verification failed:', error.message);
      throw new Error(`Vehicle insurance verification failed: ${error.message}`);
    }
  }

  // Verify commercial insurance for business drivers
  async verifyCommercialInsurance(businessInfo) {
    try {
      const { businessName, businessType, ein, driverInfo, vehicleInfo } = businessInfo;
      
      // Use Verisk for commercial insurance verification
      const apiConfig = this.apis.verisk;
      if (!apiConfig.apiKey) {
        throw new Error('Commercial insurance verification API not configured');
      }

      const requestData = {
        businessInfo: {
          businessName,
          businessType,
          ein: this.maskEIN(ein),
          address: businessInfo.address
        },
        driverInfo: {
          firstName: driverInfo.firstName,
          lastName: driverInfo.lastName,
          dateOfBirth: driverInfo.dateOfBirth,
          driverLicenseNumber: driverInfo.driverLicenseNumber,
          state: driverInfo.state,
          role: driverInfo.role || 'employee'
        },
        vehicleInfo: vehicleInfo ? {
          vin: vehicleInfo.vin,
          make: vehicleInfo.make,
          model: vehicleInfo.model,
          year: vehicleInfo.year,
          vehicleType: vehicleInfo.vehicleType || 'commercial'
        } : null,
        verificationType: 'commercial_insurance',
        includeLiability: true,
        includeWorkersComp: true
      };

      const response = await axios.post(
        `${apiConfig.baseUrl}/v1/commercial/insurance`,
        requestData,
        {
          headers: {
            'Authorization': `Bearer ${apiConfig.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: apiConfig.timeout
        }
      );

      return {
        verificationId: response.data.verificationId,
        status: response.data.status,
        businessInfo: response.data.businessInfo,
        insuranceInfo: response.data.insuranceInfo,
        coverage: response.data.coverage,
        verificationDate: new Date().toISOString(),
        provider: 'verisk',
        apiProvider: 'Verisk'
      };
    } catch (error) {
      console.error('Commercial insurance verification failed:', error.message);
      throw new Error(`Commercial insurance verification failed: ${error.message}`);
    }
  }

  // Verify insurance certificate
  async verifyInsuranceCertificate(certificateInfo) {
    try {
      const { certificateNumber, insuranceCompany, policyNumber, effectiveDate, expirationDate } = certificateInfo;
      
      // Use the appropriate API based on insurance company
      const apiConfig = this.getApiConfig(insuranceCompany);
      if (!apiConfig) {
        throw new Error(`Insurance company ${insuranceCompany} not supported for certificate verification`);
      }

      const requestData = {
        certificateNumber,
        policyNumber,
        effectiveDate,
        expirationDate,
        verificationType: 'certificate_verification'
      };

      const response = await axios.post(
        `${apiConfig.baseUrl}/v1/certificate/verify`,
        requestData,
        {
          headers: {
            'Authorization': `Bearer ${apiConfig.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: apiConfig.timeout
        }
      );

      return {
        verificationId: response.data.verificationId,
        status: response.data.status,
        certificateDetails: response.data.certificateDetails,
        policyDetails: response.data.policyDetails,
        coverage: response.data.coverage,
        verificationDate: new Date().toISOString(),
        provider: insuranceCompany,
        apiProvider: this.getApiProviderName(insuranceCompany)
      };
    } catch (error) {
      console.error('Insurance certificate verification failed:', error.message);
      throw new Error(`Certificate verification failed: ${error.message}`);
    }
  }

  // Comprehensive insurance verification
  async performComprehensiveInsuranceVerification(driverData) {
    try {
      console.log('🚀 Starting comprehensive insurance verification...');
      
      const results = {
        driverId: driverData.id,
        startedAt: new Date().toISOString(),
        verifications: {},
        overallStatus: 'pending',
        summary: {}
      };

      // Perform all verifications in parallel
      const verificationPromises = [];

      // Policy verification if policy number is provided
      if (driverData.insuranceInfo?.policyNumber) {
        verificationPromises.push(
          this.verifyPolicyByNumber({
            policyNumber: driverData.insuranceInfo.policyNumber,
            insuranceCompany: driverData.insuranceInfo.insuranceCompany,
            driverInfo: driverData.personalInfo
          })
          .then(result => ({ type: 'policy', result }))
          .catch(error => ({ type: 'policy', error: error.message }))
        );
      }

      // Driver-based insurance search
      verificationPromises.push(
        this.verifyInsuranceByDriver({
          firstName: driverData.personalInfo.firstName,
          lastName: driverData.personalInfo.lastName,
          dateOfBirth: driverData.personalInfo.dateOfBirth,
          driverLicenseNumber: driverData.driverInfo.driverLicenseNumber,
          state: driverData.personalInfo.state,
          vehicleInfo: driverData.vehicleInfo
        })
        .then(result => ({ type: 'driver', result }))
        .catch(error => ({ type: 'driver', error: error.message }))
      );

      // Vehicle insurance verification if vehicle info is provided
      if (driverData.vehicleInfo?.vin) {
        verificationPromises.push(
          this.verifyVehicleInsurance(driverData.vehicleInfo)
          .then(result => ({ type: 'vehicle', result }))
          .catch(error => ({ type: 'vehicle', error: error.message }))
        );
      }

      // Commercial insurance verification if business info is provided
      if (driverData.businessInfo?.businessName) {
        verificationPromises.push(
          this.verifyCommercialInsurance({
            businessName: driverData.businessInfo.businessName,
            businessType: driverData.businessInfo.businessType,
            ein: driverData.businessInfo.ein,
            address: driverData.businessInfo.address,
            driverInfo: driverData.personalInfo,
            vehicleInfo: driverData.vehicleInfo
          })
          .then(result => ({ type: 'commercial', result }))
          .catch(error => ({ type: 'commercial', error: error.message }))
        );
      }

      const verificationResults = await Promise.allSettled(verificationPromises);

      // Process results
      verificationResults.forEach((verificationResult, index) => {
        if (verificationResult.status === 'fulfilled') {
          const { type, result, error } = verificationResult.value;
          if (error) {
            results.verifications[type] = { status: 'failed', error };
          } else {
            results.verifications[type] = { status: 'completed', result };
          }
        } else {
          const types = ['policy', 'driver', 'vehicle', 'commercial'];
          const type = types[index];
          results.verifications[type] = { status: 'failed', error: verificationResult.reason?.message || 'Unknown error' };
        }
      });

      // Determine overall status
      const completedVerifications = Object.values(results.verifications).filter(v => v.status === 'completed').length;
      const totalVerifications = Object.keys(results.verifications).length;
      
      if (completedVerifications === totalVerifications) {
        results.overallStatus = 'completed';
      } else if (completedVerifications > 0) {
        results.overallStatus = 'partial';
      } else {
        results.overallStatus = 'failed';
      }

      results.completedAt = new Date().toISOString();
      results.summary = this.generateVerificationSummary(results.verifications);

      console.log('✅ Comprehensive insurance verification completed');
      return results;
    } catch (error) {
      console.error('❌ Comprehensive insurance verification failed:', error.message);
      throw error;
    }
  }

  // Get verification status
  async getVerificationStatus(verificationId) {
    try {
      // This would typically query the database for stored results
      // For now, return a mock response
      return {
        verificationId,
        status: 'completed',
        lastUpdated: new Date().toISOString(),
        estimatedCompletion: null
      };
    } catch (error) {
      console.error('Get verification status failed:', error.message);
      throw error;
    }
  }

  // Generate verification summary
  generateVerificationSummary(verifications) {
    const summary = {
      totalVerifications: Object.keys(verifications).length,
      completedVerifications: 0,
      failedVerifications: 0,
      coverageStatus: 'unknown',
      flags: [],
      recommendations: []
    };

    let hasActiveInsurance = false;
    let hasExpiredInsurance = false;
    let hasInsufficientCoverage = false;

    Object.entries(verifications).forEach(([type, verification]) => {
      if (verification.status === 'completed') {
        summary.completedVerifications++;
        
        // Analyze results for coverage assessment
        if (type === 'policy' && verification.result?.policyDetails?.status === 'active') {
          hasActiveInsurance = true;
        }
        
        if (type === 'policy' && verification.result?.policyDetails?.status === 'expired') {
          hasExpiredInsurance = true;
        }
        
        if (type === 'policy' && verification.result?.coverage?.liability < 50000) {
          hasInsufficientCoverage = true;
        }
      } else {
        summary.failedVerifications++;
      }
    });

    // Determine coverage status
    if (hasActiveInsurance && !hasExpiredInsurance && !hasInsufficientCoverage) {
      summary.coverageStatus = 'adequate';
    } else if (hasActiveInsurance && hasInsufficientCoverage) {
      summary.coverageStatus = 'insufficient';
      summary.flags.push('Insufficient liability coverage');
    } else if (hasExpiredInsurance) {
      summary.coverageStatus = 'expired';
      summary.flags.push('Insurance policy expired');
    } else {
      summary.coverageStatus = 'unknown';
      summary.flags.push('Unable to verify insurance status');
    }

    // Generate recommendations
    if (summary.coverageStatus === 'adequate') {
      summary.recommendations.push('Insurance verification passed');
      summary.recommendations.push('Standard onboarding process');
    } else if (summary.coverageStatus === 'insufficient') {
      summary.recommendations.push('Increase liability coverage');
      summary.recommendations.push('Contact insurance provider');
    } else if (summary.coverageStatus === 'expired') {
      summary.recommendations.push('Renew insurance policy');
      summary.recommendations.push('Provide updated certificate');
    } else {
      summary.recommendations.push('Manual verification required');
      summary.recommendations.push('Provide additional documentation');
    }

    return summary;
  }

  // Get API configuration for specific insurance company
  getApiConfig(insuranceCompany) {
    const companyMap = {
      'progressive': this.apis.progressive,
      'geico': this.apis.geico,
      'statefarm': this.apis.statefarm,
      'allstate': this.apis.allstate
    };
    
    return companyMap[insuranceCompany.toLowerCase()];
  }

  // Get API provider name
  getApiProviderName(insuranceCompany) {
    const providerMap = {
      'progressive': 'Progressive',
      'geico': 'GEICO',
      'statefarm': 'State Farm',
      'allstate': 'Allstate'
    };
    
    return providerMap[insuranceCompany.toLowerCase()] || 'Unknown';
  }

  // Mask EIN for API calls (show only last 4 digits)
  maskEIN(ein) {
    if (!ein) return null;
    const cleaned = ein.replace(/\D/g, '');
    if (cleaned.length === 9) {
      return `**-****${cleaned.slice(-4)}`;
    }
    return ein;
  }

  // Validate insurance information
  validateInsuranceInfo(insuranceInfo) {
    const required = ['policyNumber', 'insuranceCompany', 'effectiveDate', 'expirationDate'];
    const missing = required.filter(field => !insuranceInfo[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required insurance fields: ${missing.join(', ')}`);
    }

    // Validate dates
    const effectiveDate = new Date(insuranceInfo.effectiveDate);
    const expirationDate = new Date(insuranceInfo.expirationDate);
    
    if (isNaN(effectiveDate.getTime()) || isNaN(expirationDate.getTime())) {
      throw new Error('Invalid insurance dates');
    }

    if (effectiveDate >= expirationDate) {
      throw new Error('Effective date must be before expiration date');
    }

    // Check if policy is expired
    const now = new Date();
    if (expirationDate < now) {
      throw new Error('Insurance policy has expired');
    }

    return true;
  }

  // Get insurance verification pricing
  getVerificationPricing() {
    return {
      policyVerification: {
        basic: 9.99,
        comprehensive: 19.99,
        includes: ['Policy status', 'Coverage details', 'Driver verification']
      },
      driverVerification: {
        basic: 14.99,
        comprehensive: 29.99,
        includes: ['Active policies', 'Coverage history', 'Multiple providers']
      },
      vehicleVerification: {
        basic: 12.99,
        comprehensive: 24.99,
        includes: ['Vehicle coverage', 'Owner information', 'Lienholder details']
      },
      commercialVerification: {
        basic: 24.99,
        comprehensive: 49.99,
        includes: ['Business coverage', 'Workers comp', 'Liability verification']
      },
      packages: {
        basic: 39.99,
        standard: 69.99,
        premium: 119.99
      }
    };
  }
}

// Export the service
module.exports = InsuranceVerificationService; 