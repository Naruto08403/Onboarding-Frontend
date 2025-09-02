const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validateDriverProfile, validateVehicleInfo, validateBackgroundCheck } = require('../middleware/validation');
const { query } = require('../database/connection');
const router = express.Router();

// Get all drivers (admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    const offset = (page - 1) * limit;

    let whereConditions = [];
    let queryParams = [];
    let paramCount = 0;

    // Filter by status
    if (status) {
      paramCount++;
      whereConditions.push(`u.status = $${paramCount}`);
      queryParams.push(status);
    }

    // Search functionality
    if (search) {
      paramCount++;
      whereConditions.push(`(
        LOWER(u.first_name) LIKE LOWER($${paramCount}) OR 
        LOWER(u.last_name) LIKE LOWER($${paramCount}) OR 
        LOWER(u.email) LIKE LOWER($${paramCount}) OR
        LOWER(dp.license_number) LIKE LOWER($${paramCount})
      )`);
      queryParams.push(`%${search}%`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await query(`
      SELECT COUNT(*) as total 
      FROM users u
      LEFT JOIN driver_profiles dp ON u.id = dp.user_id
      ${whereClause}
    `, queryParams);

    const totalDrivers = parseInt(countResult.rows[0].total);

    // Get paginated drivers
    const driversResult = await query(`
      SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.phone_number,
        u.status,
        u.created_at,
        u.updated_at,
        dp.license_number,
        dp.license_expiry,
        dp.date_of_birth,
        dp.address_street,
        dp.address_city,
        dp.address_state,
        dp.address_zip_code,
        ec.name as emergency_contact_name,
        ec.phone_number as emergency_contact_phone,
        ec.relationship as emergency_contact_relationship
      FROM users u
      LEFT JOIN driver_profiles dp ON u.id = dp.user_id
      LEFT JOIN emergency_contacts ec ON dp.id = ec.driver_id
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `, [...queryParams, limit, offset]);

    res.json({
      drivers: driversResult.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalDrivers / limit),
        totalDrivers,
        driversPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Fetch drivers error:', error);
    res.status(500).json({
      error: 'Failed to fetch drivers',
      message: 'An error occurred while fetching drivers'
    });
  }
});

// Get driver by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user is requesting their own profile or is admin
    if (req.user.role !== 'admin' && req.user.userId !== id) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only view your own profile'
      });
    }

    const result = await query(`
      SELECT 
        u.*,
        dp.license_number,
        dp.license_expiry,
        dp.date_of_birth,
        dp.address_street,
        dp.address_city,
        dp.address_state,
        dp.address_zip_code,
        ec.name as emergency_contact_name,
        ec.phone_number as emergency_contact_phone,
        ec.relationship as emergency_contact_relationship,
        ec.email as emergency_contact_email,
        ec.address as emergency_contact_address,
        v.make as vehicle_make,
        v.model as vehicle_model,
        v.year as vehicle_year,
        v.color as vehicle_color,
        v.plate_number as vehicle_plate_number
      FROM users u
      LEFT JOIN driver_profiles dp ON u.id = dp.user_id
      LEFT JOIN emergency_contacts ec ON dp.id = ec.driver_id
      LEFT JOIN vehicles v ON dp.id = v.driver_id
      WHERE u.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Driver not found',
        message: 'Driver with this ID does not exist'
      });
    }

    res.json({ driver: result.rows[0] });
  } catch (error) {
    console.error('Fetch driver error:', error);
    res.status(500).json({
      error: 'Failed to fetch driver',
      message: 'An error occurred while fetching driver'
    });
  }
});

// Create/Update driver profile
router.post('/profile', authenticateToken, validateDriverProfile, async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      firstName,
      lastName,
      dateOfBirth,
      phoneNumber,
      address,
      licenseNumber,
      licenseExpiry,
      emergencyContact,
      vehicleInfo
    } = req.body;

    // Start transaction
    await query('BEGIN');

    try {
      // Update user information
      await query(`
        UPDATE users SET 
          first_name = $1,
          last_name = $2,
          phone_number = $3,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
      `, [firstName, lastName, phoneNumber, userId]);

      // Insert or update driver profile
      await query(`
        INSERT INTO driver_profiles (
          user_id, date_of_birth, address_street, address_city, address_state, address_zip_code,
          license_number, license_expiry, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id) DO UPDATE SET
          date_of_birth = EXCLUDED.date_of_birth,
          address_street = EXCLUDED.address_street,
          address_city = EXCLUDED.address_city,
          address_state = EXCLUDED.address_state,
          address_zip_code = EXCLUDED.address_zip_code,
          license_number = EXCLUDED.license_number,
          license_expiry = EXCLUDED.license_expiry,
          updated_at = CURRENT_TIMESTAMP
      `, [
        userId,
        dateOfBirth,
        address.street,
        address.city,
        address.state,
        address.zipCode,
        licenseNumber,
        licenseExpiry
      ]);

      // Insert or update emergency contact
      if (emergencyContact) {
        // First get the driver profile ID
        const driverProfileResult = await query('SELECT id FROM driver_profiles WHERE user_id = $1', [userId]);
        
        if (driverProfileResult.rows.length > 0) {
          const driverProfileId = driverProfileResult.rows[0].id;
          
          await query(`
            INSERT INTO emergency_contacts (
              driver_id, name, relationship, phone_number, email, address, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (driver_id) DO UPDATE SET
              name = EXCLUDED.name,
              relationship = EXCLUDED.relationship,
              phone_number = EXCLUDED.phone_number,
              email = EXCLUDED.email,
              address = EXCLUDED.address,
              updated_at = CURRENT_TIMESTAMP
          `, [
            driverProfileId,
            emergencyContact.name,
            emergencyContact.relationship,
            emergencyContact.phoneNumber,
            emergencyContact.email || null,
            emergencyContact.address || null
          ]);
        }
      }

      // Insert or update vehicle information
      if (vehicleInfo) {
        // First get the driver profile ID
        const driverProfileResult = await query('SELECT id FROM driver_profiles WHERE user_id = $1', [userId]);
        
        if (driverProfileResult.rows.length > 0) {
          const driverProfileId = driverProfileResult.rows[0].id;
          
          await query(`
            INSERT INTO vehicles (
              driver_id, make, model, year, color, plate_number, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (driver_id) DO UPDATE SET
              make = EXCLUDED.make,
              model = EXCLUDED.model,
              year = EXCLUDED.year,
              color = EXCLUDED.color,
              plate_number = EXCLUDED.plate_number,
              updated_at = CURRENT_TIMESTAMP
          `, [
            driverProfileId,
            vehicleInfo.make,
            vehicleInfo.model,
            vehicleInfo.year,
            vehicleInfo.color,
            vehicleInfo.plateNumber
          ]);
        }
      }

      await query('COMMIT');

      res.json({
        message: 'Driver profile updated successfully',
        userId
      });
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Update driver profile error:', error);
    res.status(500).json({
      error: 'Failed to update driver profile',
      message: 'An error occurred while updating driver profile'
    });
  }
});

// Get driver statistics
router.get('/:id/stats', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user is requesting their own stats or is admin
    if (req.user.role !== 'admin' && req.user.userId !== id) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only view your own statistics'
      });
    }

    const [
      documentsResult,
      backgroundChecksResult,
      vehiclesResult,
      notesResult
    ] = await Promise.all([
      query('SELECT COUNT(*) as count FROM documents WHERE user_id = $1', [id]),
      query('SELECT COUNT(*) as count FROM background_checks bc JOIN driver_profiles dp ON bc.driver_id = dp.id WHERE dp.user_id = $1', [id]),
      query('SELECT COUNT(*) as count FROM vehicles v JOIN driver_profiles dp ON v.driver_id = dp.id WHERE dp.user_id = $1', [id]),
      query('SELECT COUNT(*) as count FROM driver_notes dn JOIN driver_profiles dp ON dn.driver_id = dp.id WHERE dp.user_id = $1', [id])
    ]);

    const stats = {
      totalDocuments: parseInt(documentsResult.rows[0].count),
      totalBackgroundChecks: parseInt(backgroundChecksResult.rows[0].count),
      totalVehicles: parseInt(vehiclesResult.rows[0].count),
      totalNotes: parseInt(notesResult.rows[0].count)
    };

    res.json({ stats });
  } catch (error) {
    console.error('Fetch driver stats error:', error);
    res.status(500).json({
      error: 'Failed to fetch driver statistics',
      message: 'An error occurred while fetching driver statistics'
    });
  }
});

// Add driver note (admin only)
router.post('/:id/notes', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { note, type = 'general' } = req.body;

    // Get the driver profile ID
    const driverProfileResult = await query('SELECT id FROM driver_profiles WHERE user_id = $1', [id]);
    
    if (driverProfileResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Driver profile not found',
        message: 'Driver profile does not exist'
      });
    }

    const driverProfileId = driverProfileResult.rows[0].id;

    const result = await query(`
      INSERT INTO driver_notes (driver_id, note, note_type, admin_id, created_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      RETURNING *
    `, [driverProfileId, note, type, req.user.userId]);

    res.status(201).json({
      message: 'Driver note added successfully',
      note: result.rows[0]
    });
  } catch (error) {
    console.error('Add driver note error:', error);
    res.status(500).json({
      error: 'Failed to add driver note',
      message: 'An error occurred while adding driver note'
    });
  }
});

// Get driver notes
router.get('/:id/notes', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Check if user is requesting their own notes or is admin
    if (req.user.role !== 'admin' && req.user.userId !== id) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only view your own notes'
      });
    }

    // Get total count
    const countResult = await query(`
      SELECT COUNT(*) as total FROM driver_notes dn 
      JOIN driver_profiles dp ON dn.driver_id = dp.id 
      WHERE dp.user_id = $1
    `, [id]);

    const totalNotes = parseInt(countResult.rows[0].total);

    // Get paginated notes
    const notesResult = await query(`
      SELECT 
        dn.*,
        u.email as created_by_email,
        u.first_name as created_by_first_name,
        u.last_name as created_by_last_name
      FROM driver_notes dn
      JOIN driver_profiles dp ON dn.driver_id = dp.id
      LEFT JOIN users u ON dn.admin_id = u.id
      WHERE dp.user_id = $1
      ORDER BY dn.created_at DESC
      LIMIT $2 OFFSET $3
    `, [id, limit, offset]);

    res.json({
      notes: notesResult.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalNotes / limit),
        totalNotes,
        notesPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Fetch driver notes error:', error);
    res.status(500).json({
      error: 'Failed to fetch driver notes',
      message: 'An error occurred while fetching driver notes'
    });
  }
});

// Update driver status (admin only)
router.patch('/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    const result = await query(`
      UPDATE users SET 
        status = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [status, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Driver not found',
        message: 'Driver with this ID does not exist'
      });
    }

    // Log the status change
    await query(`
      INSERT INTO audit_logs (admin_id, action, details, target_id, target_type, created_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
    `, [req.user.userId, 'UPDATE_DRIVER_STATUS', `Driver status changed to ${status}. Reason: ${reason}`, id, 'driver']);

    res.json({
      message: 'Driver status updated successfully',
      driver: result.rows[0]
    });
  } catch (error) {
    console.error('Update driver status error:', error);
    res.status(500).json({
      error: 'Failed to update driver status',
      message: 'An error occurred while updating driver status'
    });
  }
});

router.get('/:id/activity', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 10 } = req.query;

    // Check if user is requesting their own activity or is admin
    if (req.user.role !== 'admin' && req.user.userId !== id) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only view your own activity'
      });
    }

    // Build a unified activity feed from multiple tables
    const activityResult = await query(`
      (
        SELECT 
          d.id::text as id,
          'user_document' as type,
          CONCAT('Document ', d.document_type, ' ', d.status) as message,
          d.status as status,
          d.uploaded_at as occurred_at
        FROM documents d
        WHERE d.user_id = $1
      )
      UNION ALL
      (
        SELECT 
          bc.id::text as id,
          'background_check' as type,
          CONCAT('Background check ', bc.status) as message,
          bc.status as status,
          bc.created_at as occurred_at
        FROM background_checks bc
        JOIN driver_profiles dp ON bc.driver_id = dp.id
        WHERE dp.user_id = $1
      )
      UNION ALL
      (
        SELECT 
          v.id::text as id,
          'vehicle' as type,
          CONCAT('Vehicle updated: ', COALESCE(v.make,'Unknown'), ' ', COALESCE(v.model,'')) as message,
          'updated' as status,
          COALESCE(v.updated_at, v.created_at) as occurred_at
        FROM vehicles v
        JOIN driver_profiles dp ON v.driver_id = dp.id
        WHERE dp.user_id = $1
      )
      UNION ALL
      (
        SELECT 
          dn.id::text as id,
          'driver_note' as type,
          CONCAT('Note added: ', LEFT(dn.note, 80)) as message,
          dn.note_type as status,
          dn.created_at as occurred_at
        FROM driver_notes dn
        JOIN driver_profiles dp ON dn.driver_id = dp.id
        WHERE dp.user_id = $1
      )
      ORDER BY occurred_at DESC
      LIMIT $2
    `, [id, limit]);

    res.json({
      activity: activityResult.rows
    });
  } catch (error) {
    console.error('Fetch driver activity error:', error);
    res.status(500).json({
      error: 'Failed to fetch driver activity',
      message: 'An error occurred while fetching driver activity'
    });
  }
});

module.exports = router; 