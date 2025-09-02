const Joi = require('joi');

// Validation schemas
const registrationSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  }),
  password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required().messages({
    'string.min': 'Password must be at least 8 characters long',
    'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
    'any.required': 'Password is required'
  }),
  confirmPassword: Joi.string().valid(Joi.ref('password')).messages({
    'any.only': 'Passwords must match'
  }),
  firstName: Joi.string().min(2).max(50).required().messages({
    'string.min': 'First name must be at least 2 characters long',
    'string.max': 'First name cannot exceed 50 characters',
    'any.required': 'First name is required'
  }),
  lastName: Joi.string().min(2).max(50).required().messages({
    'string.min': 'Last name must be at least 2 characters long',
    'string.max': 'Last name cannot exceed 50 characters',
    'any.required': 'Last name is required'
  }),
  phoneNumber: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).min(10).max(15).required().messages({
    'string.pattern.base': 'Please provide a valid phone number',
    'string.min': 'Phone number must be at least 10 digits',
    'string.max': 'Phone number cannot exceed 15 digits',
    'any.required': 'Phone number is required'
  }),
  terms: Joi.boolean().valid(true).messages({
    'any.only': 'You must accept the terms and conditions'
  })
});

const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  }),
  password: Joi.string().required().messages({
    'any.required': 'Password is required'
  })
});

const passwordResetSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  })
});

const passwordChangeSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    'any.required': 'Current password is required'
  }),
  newPassword: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required().messages({
    'string.min': 'New password must be at least 8 characters long',
    'string.pattern.base': 'New password must contain at least one uppercase letter, one lowercase letter, and one number',
    'any.required': 'New password is required'
  })
});

const passwordResetWithTokenSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  }),
  resetToken: Joi.string().required().messages({
    'any.required': 'Reset token is required'
  }),
  newPassword: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required().messages({
    'string.min': 'New password must be at least 8 characters long',
    'string.pattern.base': 'New password must contain at least one uppercase letter, one lowercase letter, and one number',
    'any.required': 'New password is required'
  })
});

const driverProfileSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).required().messages({
    'string.min': 'First name must be at least 2 characters long',
    'string.max': 'First name cannot exceed 50 characters',
    'any.required': 'First name is required'
  }),
  lastName: Joi.string().min(2).max(50).required().messages({
    'string.min': 'Last name must be at least 2 characters long',
    'string.max': 'Last name cannot exceed 50 characters',
    'any.required': 'Last name is required'
  }),
  dateOfBirth: Joi.date().max('now').required().messages({
    'date.max': 'Date of birth cannot be in the future',
    'any.required': 'Date of birth is required'
  }),
  phoneNumber: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).min(10).max(15).required().messages({
    'string.pattern.base': 'Please provide a valid phone number',
    'string.min': 'Phone number must be at least 10 digits',
    'string.max': 'Phone number cannot exceed 15 digits',
    'any.required': 'Phone number is required'
  }),
  address: Joi.object({
    street: Joi.string().min(5).max(100).required().messages({
      'string.min': 'Street address must be at least 5 characters long',
      'string.max': 'Street address cannot exceed 100 characters',
      'any.required': 'Street address is required'
    }),
    city: Joi.string().min(2).max(50).required().messages({
      'string.min': 'City must be at least 2 characters long',
      'string.max': 'City cannot exceed 50 characters',
      'any.required': 'City is required'
    }),
    state: Joi.string().min(2).max(50).required().messages({
      'string.min': 'State must be at least 2 characters long',
      'string.max': 'State cannot exceed 50 characters',
      'any.required': 'State is required'
    }),
    zipCode: Joi.string().pattern(/^\d{5}(-\d{4})?$/).required().messages({
      'string.pattern.base': 'Please provide a valid ZIP code',
      'any.required': 'ZIP code is required'
    })
  }).required(),
  licenseNumber: Joi.string().min(5).max(20).required().messages({
    'string.min': 'License number must be at least 5 characters long',
    'string.max': 'License number cannot exceed 20 characters',
    'any.required': 'License number is required'
  }),
  licenseExpiry: Joi.date().min('now').required().messages({
    'date.min': 'License expiry date must be in the future',
    'any.required': 'License expiry date is required'
  }),
  vehicleInfo: Joi.object({
    make: Joi.string().min(2).max(50).required().messages({
      'string.min': 'Vehicle make must be at least 2 characters long',
      'string.max': 'Vehicle make cannot exceed 50 characters',
      'any.required': 'Vehicle make is required'
    }),
    model: Joi.string().min(2).max(50).required().messages({
      'string.min': 'Vehicle model must be at least 2 characters long',
      'string.max': 'Vehicle model cannot exceed 50 characters',
      'any.required': 'Vehicle model is required'
    }),
    year: Joi.number().integer().min(1900).max(new Date().getFullYear() + 1).required().messages({
      'number.base': 'Vehicle year must be a valid number',
      'number.integer': 'Vehicle year must be a whole number',
      'number.min': 'Vehicle year must be at least 1900',
      'number.max': `Vehicle year cannot exceed ${new Date().getFullYear() + 1}`,
      'any.required': 'Vehicle year is required'
    }),
    color: Joi.string().min(2).max(30).required().messages({
      'string.min': 'Vehicle color must be at least 2 characters long',
      'string.max': 'Vehicle color cannot exceed 30 characters',
      'any.required': 'Vehicle color is required'
    }),
    plateNumber: Joi.string().min(2).max(15).required().messages({
      'string.min': 'License plate number must be at least 2 characters long',
      'string.max': 'License plate number cannot exceed 15 characters',
      'any.required': 'License plate number is required'
    })
  }).required(),
  emergencyContact: Joi.object({
    name: Joi.string().min(2).max(100).required().messages({
      'string.min': 'Emergency contact name must be at least 2 characters long',
      'string.max': 'Emergency contact name cannot exceed 100 characters',
      'any.required': 'Emergency contact name is required'
    }),
    relationship: Joi.string().min(2).max(50).required().messages({
      'string.min': 'Relationship must be at least 2 characters long',
      'string.max': 'Relationship cannot exceed 50 characters',
      'any.required': 'Relationship is required'
    }),
    phoneNumber: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).min(10).max(15).required().messages({
      'string.pattern.base': 'Please provide a valid phone number',
      'string.min': 'Phone number must be at least 10 digits',
      'string.max': 'Phone number cannot exceed 15 digits',
      'any.required': 'Phone number is required'
    })
  }).required()
});

const vehicleInfoSchema = Joi.object({
  make: Joi.string().min(2).max(50).required().messages({
    'string.min': 'Vehicle make must be at least 2 characters long',
    'string.max': 'Vehicle make cannot exceed 50 characters',
    'any.required': 'Vehicle make is required'
  }),
  model: Joi.string().min(2).max(50).required().messages({
    'string.min': 'Vehicle model must be at least 2 characters long',
    'string.max': 'Vehicle model cannot exceed 50 characters',
    'any.required': 'Vehicle model is required'
  }),
  year: Joi.number().integer().min(1900).max(new Date().getFullYear() + 1).required().messages({
    'number.base': 'Vehicle year must be a valid number',
    'number.integer': 'Vehicle year must be a whole number',
    'number.min': 'Vehicle year must be at least 1900',
    'number.max': `Vehicle year cannot exceed ${new Date().getFullYear() + 1}`,
    'any.required': 'Vehicle year is required'
  }),
  color: Joi.string().min(2).max(30).required().messages({
    'string.min': 'Vehicle color must be at least 2 characters long',
    'string.max': 'Vehicle color cannot exceed 30 characters',
    'any.required': 'Vehicle color is required'
  }),
  plateNumber: Joi.string().min(2).max(15).required().messages({
    'string.min': 'License plate number must be at least 2 characters long',
    'string.max': 'License plate number cannot exceed 15 characters',
    'any.required': 'License plate number is required'
  }),
  vin: Joi.string().length(17).optional().messages({
    'string.length': 'VIN must be exactly 17 characters long'
  }),
  insuranceProvider: Joi.string().min(2).max(100).optional().messages({
    'string.min': 'Insurance provider must be at least 2 characters long',
    'string.max': 'Insurance provider cannot exceed 100 characters'
  }),
  insurancePolicyNumber: Joi.string().min(5).max(50).optional().messages({
    'string.min': 'Insurance policy number must be at least 5 characters long',
    'string.max': 'Insurance policy number cannot exceed 50 characters'
  }),
  insuranceExpiry: Joi.date().min('now').optional().messages({
    'date.min': 'Insurance expiry date must be in the future'
  }),
  registrationExpiry: Joi.date().min('now').optional().messages({
    'date.min': 'Registration expiry date must be in the future'
  }),
  inspectionExpiry: Joi.date().min('now').optional().messages({
    'date.min': 'Inspection expiry date must be in the future'
  })
});

const backgroundCheckSchema = Joi.object({
  ssn: Joi.string().pattern(/^\d{3}-\d{2}-\d{4}$/).required().messages({
    'string.pattern.base': 'SSN must be in format XXX-XX-XXXX',
    'any.required': 'SSN is required'
  }),
  dateOfBirth: Joi.date().max('now').required().messages({
    'date.max': 'Date of birth cannot be in the future',
    'any.required': 'Date of birth is required'
  }),
  previousAddresses: Joi.array().items(Joi.object({
    street: Joi.string().min(5).max(100).required(),
    city: Joi.string().min(2).max(50).required(),
    state: Joi.string().min(2).max(50).required(),
    zipCode: Joi.string().pattern(/^\d{5}(-\d{4})?$/).required(),
    fromDate: Joi.date().max('now').required(),
    toDate: Joi.date().min(Joi.ref('fromDate')).max('now').required()
  })).min(1).max(10).required().messages({
    'array.min': 'At least one previous address is required',
    'array.max': 'Maximum 10 previous addresses allowed',
    'any.required': 'Previous addresses are required'
  }),
  criminalHistory: Joi.object({
    hasConvictions: Joi.boolean().required(),
    convictions: Joi.when('hasConvictions', {
      is: true,
      then: Joi.array().items(Joi.object({
        offense: Joi.string().min(5).max(200).required(),
        date: Joi.date().max('now').required(),
        location: Joi.string().min(2).max(100).required(),
        disposition: Joi.string().min(2).max(100).required()
      })).min(1).required(),
      otherwise: Joi.forbidden()
    })
  }).required(),
  drivingRecord: Joi.object({
    hasViolations: Joi.boolean().required(),
    violations: Joi.when('hasViolations', {
      is: true,
      then: Joi.array().items(Joi.object({
        violation: Joi.string().min(5).max(200).required(),
        date: Joi.date().max('now').required(),
        location: Joi.string().min(2).max(100).required(),
        points: Joi.number().integer().min(0).max(12).required()
      })).min(1).required(),
      otherwise: Joi.forbidden()
    })
  }).required(),
  employmentHistory: Joi.array().items(Joi.object({
    employer: Joi.string().min(2).max(100).required(),
    position: Joi.string().min(2).max(100).required(),
    fromDate: Joi.date().max('now').required(),
    toDate: Joi.date().min(Joi.ref('fromDate')).max('now').optional(),
    reasonForLeaving: Joi.string().max(500).optional(),
    contactPerson: Joi.string().min(2).max(100).optional(),
    contactPhone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).min(10).max(15).optional()
  })).min(1).max(10).required().messages({
    'array.min': 'At least one employment record is required',
    'array.max': 'Maximum 10 employment records allowed',
    'any.required': 'Employment history is required'
  })
});

const documentUploadSchema = Joi.object({
  documentType: Joi.string().valid(
    'drivers_license',
    'vehicle_registration',
    'insurance_card',
    'background_check',
    'vehicle_inspection',
    'medical_certificate',
    'other'
  ).required().messages({
    'any.only': 'Please select a valid document type',
    'any.required': 'Document type is required'
  }),
  description: Joi.string().max(500).optional().messages({
    'string.max': 'Description cannot exceed 500 characters'
  }),
  expiryDate: Joi.date().min('now').optional().messages({
    'date.min': 'Expiry date must be in the future'
  })
});

// Admin Login Schema
const adminLoginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please enter a valid email address',
    'any.required': 'Email is required'
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'Password must be at least 6 characters long',
    'any.required': 'Password is required'
  })
});

// Validation middleware functions
const validateRegistration = (req, res, next) => {
  const { error } = registrationSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Validation failed',
      message: error.details[0].message
    });
  }
  next();
};

const validateLogin = (req, res, next) => {
  const { error } = loginSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Validation failed',
      message: error.details[0].message
    });
  }
  next();
};

const validatePasswordReset = (req, res, next) => {
  const { error } = passwordResetSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Validation failed',
      message: error.details[0].message
    });
  }
  next();
};

const validatePasswordChange = (req, res, next) => {
  const { error } = passwordChangeSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Validation failed',
      message: error.details[0].message
    });
  }
  next();
};

const validatePasswordResetWithToken = (req, res, next) => {
  const { error } = passwordResetWithTokenSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Validation failed',
      message: error.details[0].message
    });
  }
  next();
};

const validateDriverProfile = (req, res, next) => {
  const { error } = driverProfileSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Validation failed',
      message: error.details[0].message
    });
  }
  next();
};

const validateVehicleInfo = (req, res, next) => {
  const { error } = vehicleInfoSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Validation failed',
      message: error.details[0].message
    });
  }
  next();
};

const validateBackgroundCheck = (req, res, next) => {
  const { error } = backgroundCheckSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Validation failed',
      message: error.details[0].message
    });
  }
  next();
};

const validateDocumentUpload = (req, res, next) => {
  const { error } = documentUploadSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Validation failed',
      message: error.details[0].message
    });
  }
  next();
};

// Admin Login Validation Middleware
const validateAdminLogin = (req, res, next) => {
  const { error } = adminLoginSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Validation Error',
      message: error.details[0].message
    });
  }
  next();
};

module.exports = {
  validateRegistration,
  validateLogin,
  validateDriverProfile,
  validateDocumentUpload,
  validatePasswordReset,
  validatePasswordChange,
  validatePasswordResetWithToken,
  validateVehicleInfo,
  validateBackgroundCheck,
  validateAdminLogin // Add this export
}; 