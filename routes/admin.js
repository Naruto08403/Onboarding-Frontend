const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { query } = require('../database/connection');
const router = express.Router();

// Get system dashboard statistics
router.get('/dashboard', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Get real-time statistics from database
    const [
      totalUsersResult,
      totalDriversResult,
      pendingApprovalsResult,
      activeDriversResult,
      suspendedDriversResult,
      documentsPendingReviewResult,
      backgroundChecksPendingResult
    ] = await Promise.all([
      query('SELECT COUNT(*) as count FROM users'),
      query('SELECT COUNT(*) as count FROM users WHERE role = $1', ['driver']),
      query('SELECT COUNT(*) as count FROM users WHERE status = $1', ['pending']),
      query('SELECT COUNT(*) as count FROM users WHERE status = $1', ['active']),
      query('SELECT COUNT(*) as count FROM users WHERE status = $1', ['suspended']),
      query('SELECT COUNT(*) as count FROM documents WHERE status = $1', ['pending']),
      query('SELECT COUNT(*) as count FROM background_checks WHERE status = $1', ['pending'])
    ]);

    const dashboardStats = {
      totalUsers: parseInt(totalUsersResult.rows[0].count),
      totalDrivers: parseInt(totalDriversResult.rows[0].count),
      pendingApprovals: parseInt(pendingApprovalsResult.rows[0].count),
      activeDrivers: parseInt(activeDriversResult.rows[0].count),
      suspendedDrivers: parseInt(suspendedDriversResult.rows[0].count),
      documentsPendingReview: parseInt(documentsPendingReviewResult.rows[0].count),
      backgroundChecksPending: parseInt(backgroundChecksPendingResult.rows[0].count),
      systemHealth: 'healthy',
      lastBackup: new Date().toISOString(),
      uptime: process.uptime()
    };

    res.json({
      dashboard: dashboardStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Dashboard fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch dashboard',
      message: 'An error occurred while fetching dashboard data'
    });
  }
});

// Get system settings
router.get('/settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await query('SELECT * FROM system_settings');
    const settings = result.rows[0] || {};

    res.json({
      settings,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Settings fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch settings',
      message: 'An error occurred while fetching system settings'
    });
  }
});

// Update system settings
router.put('/settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      max_file_size,
      allowed_file_types,
      max_login_attempts,
      lockout_duration,
      session_timeout,
      require_email_verification,
      require_phone_verification,
      require_background_check,
      require_vehicle_inspection
    } = req.body;

    // Update system settings
    await query(`
      UPDATE system_settings SET 
        max_file_size = COALESCE($1, max_file_size),
        allowed_file_types = COALESCE($2, allowed_file_types),
        max_login_attempts = COALESCE($3, max_login_attempts),
        lockout_duration = COALESCE($4, lockout_duration),
        session_timeout = COALESCE($5, session_timeout),
        require_email_verification = COALESCE($6, require_email_verification),
        require_phone_verification = COALESCE($7, require_phone_verification),
        require_background_check = COALESCE($8, require_background_check),
        require_vehicle_inspection = COALESCE($9, require_vehicle_inspection),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `, [
      max_file_size,
      allowed_file_types,
      max_login_attempts,
      lockout_duration,
      session_timeout,
      require_email_verification,
      require_phone_verification,
      require_background_check,
      require_vehicle_inspection
    ]);

    // Log the change
    await query(`
      INSERT INTO audit_logs (admin_id, action, details, target_type, created_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
    `, [req.user.userId, 'UPDATE_SETTINGS', 'System settings updated', 'system_settings']);

    // Get updated settings
    const result = await query('SELECT * FROM system_settings WHERE id = 1');
    const settings = result.rows[0];

    res.json({
      message: 'System settings updated successfully',
      settings
    });
  } catch (error) {
    console.error('Settings update error:', error);
    res.status(500).json({
      error: 'Failed to update settings',
      message: 'An error occurred while updating system settings'
    });
  }
});

// Get audit logs
router.get('/audit-logs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, action, admin_id, start_date, end_date } = req.query;
    const offset = (page - 1) * limit;

    let whereConditions = [];
    let queryParams = [];
    let paramCount = 0;

    if (action) {
      paramCount++;
      whereConditions.push(`action = $${paramCount}`);
      queryParams.push(action);
    }

    if (admin_id) {
      paramCount++;
      whereConditions.push(`admin_id = $${paramCount}`);
      queryParams.push(admin_id);
    }

    if (start_date) {
      paramCount++;
      whereConditions.push(`created_at >= $${paramCount}`);
      queryParams.push(start_date);
    }

    if (end_date) {
      paramCount++;
      whereConditions.push(`created_at <= $${paramCount}`);
      queryParams.push(end_date);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await query(`
      SELECT COUNT(*) as total FROM audit_logs ${whereClause}
    `, queryParams);

    const totalLogs = parseInt(countResult.rows[0].total);

    // Get paginated logs
    const logsResult = await query(`
      SELECT 
        al.*,
        u.email as admin_email,
        u.first_name as admin_first_name,
        u.last_name as admin_last_name
      FROM audit_logs al
      LEFT JOIN users u ON al.admin_id = u.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `, [...queryParams, limit, offset]);

    res.json({
      logs: logsResult.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalLogs / limit),
        totalLogs,
        logsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Audit logs fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch audit logs',
      message: 'An error occurred while fetching audit logs'
    });
  }
});

// Create audit log entry
router.post('/audit-logs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { action, details, target_id, target_type } = req.body;

    const result = await query(`
      INSERT INTO audit_logs (admin_id, action, details, target_id, target_type, created_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      RETURNING *
    `, [req.user.userId, action, details, target_id, target_type]);

    res.status(201).json({
      message: 'Audit log created successfully',
      log: result.rows[0]
    });
  } catch (error) {
    console.error('Audit log creation error:', error);
    res.status(500).json({
      error: 'Failed to create audit log',
      message: 'An error occurred while creating audit log'
    });
  }
});

// Get notifications
router.get('/notifications', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, read, type } = req.query;
    const offset = (page - 1) * limit;

    let whereConditions = [];
    let queryParams = [];
    let paramCount = 0;

    if (read !== undefined) {
      paramCount++;
      whereConditions.push(`is_read = $${paramCount}`);
      queryParams.push(read === 'true');
    }

    if (type) {
      paramCount++;
      whereConditions.push(`type = $${paramCount}`);
      queryParams.push(type);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await query(`
      SELECT COUNT(*) as total FROM notifications ${whereClause}
    `, queryParams);

    const totalNotifications = parseInt(countResult.rows[0].total);

    // Get paginated notifications
    const notificationsResult = await query(`
      SELECT 
        n.*,
        u.email as created_by_email,
        u.first_name as created_by_first_name,
        u.last_name as created_by_last_name
      FROM notifications n
      LEFT JOIN users u ON n.created_by = u.id
      ${whereClause}
      ORDER BY n.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `, [...queryParams, limit, offset]);

    res.json({
      notifications: notificationsResult.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalNotifications / limit),
        totalNotifications,
        notificationsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Notifications fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch notifications',
      message: 'An error occurred while fetching notifications'
    });
  }
});

// Mark notification as read
router.patch('/notifications/:id/read', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(`
      UPDATE notifications 
      SET is_read = true, read_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Notification not found',
        message: 'Notification with this ID does not exist'
      });
    }

    res.json({
      message: 'Notification marked as read',
      notification: result.rows[0]
    });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({
      error: 'Failed to mark notification as read',
      message: 'An error occurred while marking notification as read'
    });
  }
});

// Create notification
router.post('/notifications', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { title, message, type, priority, target_users } = req.body;

    const result = await query(`
      INSERT INTO notifications (title, message, type, priority, target_users, created_by, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      RETURNING *
    `, [title, message, type || 'general', priority || 'medium', target_users || 'all', req.user.userId]);

    res.status(201).json({
      message: 'Notification created successfully',
      notification: result.rows[0]
    });
  } catch (error) {
    console.error('Notification creation error:', error);
    res.status(500).json({
      error: 'Failed to create notification',
      message: 'An error occurred while creating notification'
    });
  }
});

// Get system health status
router.get('/health/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Test database connection
    const dbHealth = await query('SELECT 1 as test');
    const dbStatus = dbHealth.rows.length > 0 ? 'connected' : 'disconnected';

    const healthStatus = {
      status: dbStatus === 'connected' ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      environment: process.env.NODE_ENV || 'development',
      version: process.version,
      platform: process.platform,
      arch: process.arch,
      database: dbStatus
    };

    res.json({
      health: healthStatus
    });
  } catch (error) {
    console.error('Health status error:', error);
    res.status(500).json({
      error: 'Failed to fetch health status',
      message: 'An error occurred while fetching health status'
    });
  }
});

module.exports = router; 