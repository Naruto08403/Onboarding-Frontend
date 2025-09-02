const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validateRegistration, validateLogin, validatePasswordReset, validatePasswordChange } = require('../middleware/validation');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { query } = require('../database/connection');
const router = express.Router();

// User Registration
router.post('/register', validateRegistration, async (req, res) => {
  try {
    const { email, password, firstName, lastName, phoneNumber } = req.body;

    // Check if user already exists
    const existingUserResult = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUserResult.rows.length > 0) {
      return res.status(400).json({
        error: 'User already exists',
        message: 'A user with this email already exists'
      });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new user in PostgreSQL
    const newUserResult = await query(`
      INSERT INTO users (email, password_hash, first_name, last_name, phone_number, role, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, email, first_name, last_name, phone_number, role, status, email_verified, phone_verified, last_login_at, created_at, updated_at
    `, [email, hashedPassword, firstName, lastName, phoneNumber, 'driver', 'pending']);

    const newUser = newUserResult.rows[0];

    // Generate JWT token
    const token = jwt.sign(
      { userId: newUser.id, email: newUser.email, role: newUser.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      user: newUser,
      token
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      message: 'An error occurred during registration'
    });
  }
});

// User Login
router.post('/login', validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user in PostgreSQL
    const userResult = await query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid email or password'
      });
    }

    const user = userResult.rows[0];

    // Check if account is locked
    if (user.locked_until && new Date() < new Date(user.locked_until)) {
      return res.status(423).json({
        error: 'Account locked',
        message: 'Account is temporarily locked due to multiple failed login attempts'
      });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      // Increment login attempts
      const newLoginAttempts = (user.login_attempts || 0) + 1;
      let lockedUntil = null;
      
      if (newLoginAttempts >= 5) {
        lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // Lock for 15 minutes
      }
      
      await query(`
        UPDATE users SET 
          login_attempts = $1, 
          locked_until = $2, 
          updated_at = CURRENT_TIMESTAMP 
        WHERE id = $3
      `, [newLoginAttempts, lockedUntil, user.id]);

      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid email or password'
      });
    }

    // Reset login attempts on successful login
    await query(`
      UPDATE users SET 
        login_attempts = 0, 
        locked_until = NULL, 
        last_login_at = CURRENT_TIMESTAMP, 
        updated_at = CURRENT_TIMESTAMP 
      WHERE id = $1
    `, [user.id]);

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    // Remove password from response
    const { password_hash, ...userWithoutPassword } = user;

    res.json({
      message: 'Login successful',
      user: userWithoutPassword,
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      message: 'An error occurred during login'
    });
  }
});

// Get current user profile
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const userResult = await query(`
      SELECT id, email, first_name, last_name, phone_number, role, status, email_verified, phone_verified, last_login_at, created_at, updated_at
      FROM users WHERE id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User profile not found'
      });
    }

    const user = userResult.rows[0];
    res.json({ user });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({
      error: 'Failed to get user profile',
      message: 'An error occurred while fetching user profile'
    });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { firstName, lastName, phoneNumber } = req.body;
    const userId = req.user.userId;
    
    // Update user in PostgreSQL
    const updateResult = await query(`
      UPDATE users SET 
        first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        phone_number = COALESCE($3, phone_number),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING id, email, first_name, last_name, phone_number, role, status, email_verified, phone_verified, last_login_at, created_at, updated_at
    `, [firstName, lastName, phoneNumber, userId]);

    if (updateResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User profile not found'
      });
    }

    const updatedUser = updateResult.rows[0];
    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      error: 'Profile update failed',
      message: 'An error occurred while updating profile'
    });
  }
});

// Change password
router.post('/change-password', authenticateToken, validatePasswordChange, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;
    
    // Get current user
    const userResult = await query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User profile not found'
      });
    }

    const user = userResult.rows[0];

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValidPassword) {
      return res.status(400).json({
        error: 'Invalid password',
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // Update password in PostgreSQL
    await query(`
      UPDATE users SET 
        password_hash = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [hashedPassword, userId]);

    res.json({
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({
      error: 'Password change failed',
      message: 'An error occurred while changing password'
    });
  }
});

// Request password reset
router.post('/forgot-password', validatePasswordReset, async (req, res) => {
  try {
    const { email } = req.body;
    
    // Check if user exists in PostgreSQL
    const userResult = await query('SELECT id FROM users WHERE email = $1', [email]);
    
    if (userResult.rows.length === 0) {
      // Don't reveal if user exists or not for security
      return res.json({
        message: 'If an account with that email exists, a password reset link has been sent'
      });
    }

    // Generate reset token (in production, this would be sent via email)
    const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store reset token in database (you might want to create a password_reset_tokens table)
    // For now, we'll just log it
    console.log(`Password reset token for ${email}: ${resetToken}`);

    res.json({
      message: 'If an account with that email exists, a password reset link has been sent'
    });

  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({
      error: 'Password reset request failed',
      message: 'An error occurred while processing password reset request'
    });
  }
});

// Reset password with token
router.post('/reset-password', validatePasswordChange, async (req, res) => {
  try {
    const { email, resetToken, newPassword } = req.body;
    
    // In production, you would validate the reset token from database
    // For now, we'll just check if user exists
    const userResult = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User not found'
      });
    }

    // Hash new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // Update password in PostgreSQL
    await query(`
      UPDATE users SET 
        password_hash = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE email = $2
    `, [hashedPassword, email]);
    
    res.json({
      message: 'Password reset successfully'
    });

  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({
      error: 'Password reset failed',
      message: 'An error occurred while resetting password'
    });
  }
});

// Verify email (mock implementation)
router.post('/verify-email', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Update email verification in PostgreSQL
    await query(`
      UPDATE users SET 
        email_verified = true,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [userId]);

    res.json({
      message: 'Email verified successfully'
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      error: 'Email verification failed',
      message: 'An error occurred while verifying email'
    });
  }
});

// Verify phone (mock implementation)
router.post('/verify-phone', authenticateToken, async (req, res) => {
  try {
    const { verificationCode } = req.body;
    const userId = req.user.userId;
    
    // In production, this would verify the SMS verification code
    if (verificationCode === '123456') { // Mock verification
      await query(`
        UPDATE users SET 
          phone_verified = true,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [userId]);

      res.json({
        message: 'Phone number verified successfully'
      });
    } else {
      res.status(400).json({
        error: 'Invalid verification code',
        message: 'Please enter the correct verification code'
      });
    }

  } catch (error) {
    console.error('Phone verification error:', error);
    res.status(500).json({
      error: 'Phone verification failed',
      message: 'An error occurred while verifying phone number'
    });
  }
});

// Send phone verification code (mock implementation)
router.post('/send-verification-code', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get user phone number
    const userResult = await query('SELECT phone_number FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User profile not found'
      });
    }

    const phoneNumber = userResult.rows[0].phone_number;

    // In production, this would send an SMS with verification code
    console.log(`Verification code sent to ${phoneNumber}: 123456`);

    res.json({
      message: 'Verification code sent successfully'
    });

  } catch (error) {
    console.error('Send verification code error:', error);
    res.status(500).json({
      error: 'Failed to send verification code',
      message: 'An error occurred while sending verification code'
    });
  }
});

// Get all users (admin only)
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const usersResult = await query(`
      SELECT id, email, first_name, last_name, phone_number, role, status, email_verified, phone_verified, last_login_at, created_at, updated_at
      FROM users
      ORDER BY created_at DESC
    `);

    res.json({
      users: usersResult.rows,
      count: usersResult.rows.length
    });
  } catch (error) {
    console.error('Fetch users error:', error);
    res.status(500).json({
      error: 'Failed to fetch users',
      message: 'An error occurred while fetching users'
    });
  }
});

// Update user status (admin only)
router.patch('/users/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['pending', 'active', 'suspended', 'deleted'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        message: 'Status must be one of: pending, active, suspended, deleted'
      });
    }
    
    const updateResult = await query(`
      UPDATE users SET 
        status = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, email, first_name, last_name, phone_number, role, status, email_verified, phone_verified, last_login_at, created_at, updated_at
    `, [status, id]);

    if (updateResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User with this ID does not exist'
      });
    }
    
    res.json({
      message: 'User status updated successfully',
      user: updateResult.rows[0]
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      error: 'Failed to update user status',
      message: 'An error occurred while updating user status'
    });
  }
});

// Logout (client-side token removal)
router.post('/logout', authenticateToken, (req, res) => {
  res.json({
    message: 'Logout successful'
  });
});

// Refresh token
router.post('/refresh-token', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const userResult = await query('SELECT id, email, role FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User profile not found'
      });
    }

    const user = userResult.rows[0];

    // Generate new JWT token
    const newToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Token refreshed successfully',
      token: newToken
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      error: 'Token refresh failed',
      message: 'An error occurred while refreshing token'
    });
  }
});

module.exports = router; 