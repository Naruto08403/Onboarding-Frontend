const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();

// Mock database for notifications
let notifications = [];
let webhooks = [];
let emailTemplates = [];

// Get user notifications
router.get('/my-notifications', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 20, read, type } = req.query;
    
    let userNotifications = notifications.filter(n => 
      n.targetUsers === 'all' || 
      n.targetUsers === userId || 
      (Array.isArray(n.targetUsers) && n.targetUsers.includes(userId))
    );

    // Filter by read status
    if (read !== undefined) {
      userNotifications = userNotifications.filter(n => n.read === (read === 'true'));
    }

    // Filter by type
    if (type) {
      userNotifications = userNotifications.filter(n => n.type === type);
    }

    // Sort by timestamp (newest first)
    userNotifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedNotifications = userNotifications.slice(startIndex, endIndex);

    res.json({
      notifications: paginatedNotifications,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(userNotifications.length / limit),
        totalNotifications: userNotifications.length,
        notificationsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Fetch notifications error:', error);
    res.status(500).json({
      error: 'Failed to fetch notifications',
      message: 'An error occurred while fetching notifications'
    });
  }
});

// Mark notification as read
router.patch('/:id/read', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    
    const notification = notifications.find(n => n.id === id);
    if (!notification) {
      return res.status(404).json({
        error: 'Notification not found',
        message: 'Notification with this ID does not exist'
      });
    }

    // Check if user has access to this notification
    if (notification.targetUsers !== 'all' && 
        notification.targetUsers !== userId && 
        !(Array.isArray(notification.targetUsers) && notification.targetUsers.includes(userId))) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have access to this notification'
      });
    }

    notification.read = true;
    notification.readAt = new Date().toISOString();

    res.json({
      message: 'Notification marked as read',
      notification
    });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({
      error: 'Failed to mark notification as read',
      message: 'An error occurred while marking notification as read'
    });
  }
});

// Mark all notifications as read
router.patch('/mark-all-read', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    
    const userNotifications = notifications.filter(n => 
      n.targetUsers === 'all' || 
      n.targetUsers === userId || 
      (Array.isArray(n.targetUsers) && n.targetUsers.includes(userId))
    );

    userNotifications.forEach(notification => {
      if (!notification.read) {
        notification.read = true;
        notification.readAt = new Date().toISOString();
      }
    });

    res.json({
      message: 'All notifications marked as read',
      count: userNotifications.length
    });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({
      error: 'Failed to mark all notifications as read',
      message: 'An error occurred while marking all notifications as read'
    });
  }
});

// Delete notification
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    
    const notificationIndex = notifications.findIndex(n => n.id === id);
    if (notificationIndex === -1) {
      return res.status(404).json({
        error: 'Notification not found',
        message: 'Notification with this ID does not exist'
      });
    }

    const notification = notifications[notificationIndex];
    
    // Check if user has access to this notification
    if (notification.targetUsers !== 'all' && 
        notification.targetUsers !== userId && 
        !(Array.isArray(notification.targetUsers) && notification.targetUsers.includes(userId))) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have access to this notification'
      });
    }

    notifications.splice(notificationIndex, 1);

    res.json({
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      error: 'Failed to delete notification',
      message: 'An error occurred while deleting notification'
    });
  }
});

// Get notification preferences
router.get('/preferences', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Mock user preferences - in production, this would come from database
    const userPreferences = {
      userId,
      emailNotifications: true,
      smsNotifications: true,
      pushNotifications: true,
      notificationTypes: {
        profile_updates: true,
        document_status: true,
        background_check: true,
        system_maintenance: false,
        promotions: false
      },
      quietHours: {
        enabled: false,
        startTime: '22:00',
        endTime: '08:00'
      }
    };

    res.json({
      preferences: userPreferences
    });
  } catch (error) {
    console.error('Fetch preferences error:', error);
    res.status(500).json({
      error: 'Failed to fetch notification preferences',
      message: 'An error occurred while fetching notification preferences'
    });
  }
});

// Update notification preferences
router.put('/preferences', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      emailNotifications,
      smsNotifications,
      pushNotifications,
      notificationTypes,
      quietHours
    } = req.body;

    // In production, this would update the database
    const updatedPreferences = {
      userId,
      emailNotifications: emailNotifications !== undefined ? emailNotifications : true,
      smsNotifications: smsNotifications !== undefined ? smsNotifications : true,
      pushNotifications: pushNotifications !== undefined ? pushNotifications : true,
      notificationTypes: notificationTypes || {
        profile_updates: true,
        document_status: true,
        background_check: true,
        system_maintenance: false,
        promotions: false
      },
      quietHours: quietHours || {
        enabled: false,
        startTime: '22:00',
        endTime: '08:00'
      }
    };

    res.json({
      message: 'Notification preferences updated successfully',
      preferences: updatedPreferences
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({
      error: 'Failed to update notification preferences',
      message: 'An error occurred while updating notification preferences'
    });
  }
});

// Get webhook endpoints (admin only)
router.get('/webhooks', authenticateToken, requireAdmin, (req, res) => {
  try {
    res.json({
      webhooks,
      count: webhooks.length
    });
  } catch (error) {
    console.error('Fetch webhooks error:', error);
    res.status(500).json({
      error: 'Failed to fetch webhooks',
      message: 'An error occurred while fetching webhooks'
    });
  }
});

// Create webhook endpoint (admin only)
router.post('/webhooks', authenticateToken, requireAdmin, (req, res) => {
  try {
    const {
      name,
      url,
      events,
      secret,
      active,
      description
    } = req.body;

    const newWebhook = {
      id: Date.now().toString(),
      name,
      url,
      events: events || ['all'],
      secret: secret || Math.random().toString(36).substring(2, 15),
      active: active !== undefined ? active : true,
      description: description || '',
      createdAt: new Date().toISOString(),
      createdBy: req.user.userId,
      lastTriggered: null,
      successCount: 0,
      failureCount: 0
    };

    webhooks.push(newWebhook);

    res.status(201).json({
      message: 'Webhook created successfully',
      webhook: newWebhook
    });
  } catch (error) {
    console.error('Create webhook error:', error);
    res.status(500).json({
      error: 'Failed to create webhook',
      message: 'An error occurred while creating webhook'
    });
  }
});

// Update webhook (admin only)
router.put('/webhooks/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      url,
      events,
      secret,
      active,
      description
    } = req.body;

    const webhook = webhooks.find(w => w.id === id);
    if (!webhook) {
      return res.status(404).json({
        error: 'Webhook not found',
        message: 'Webhook with this ID does not exist'
      });
    }

    // Update fields
    if (name !== undefined) webhook.name = name;
    if (url !== undefined) webhook.url = url;
    if (events !== undefined) webhook.events = events;
    if (secret !== undefined) webhook.secret = secret;
    if (active !== undefined) webhook.active = active;
    if (description !== undefined) webhook.description = description;

    webhook.updatedAt = new Date().toISOString();

    res.json({
      message: 'Webhook updated successfully',
      webhook
    });
  } catch (error) {
    console.error('Update webhook error:', error);
    res.status(500).json({
      error: 'Failed to update webhook',
      message: 'An error occurred while updating webhook'
    });
  }
});

// Delete webhook (admin only)
router.delete('/webhooks/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const webhookIndex = webhooks.findIndex(w => w.id === id);
    
    if (webhookIndex === -1) {
      return res.status(404).json({
        error: 'Webhook not found',
        message: 'Webhook with this ID does not exist'
      });
    }

    webhooks.splice(webhookIndex, 1);

    res.json({
      message: 'Webhook deleted successfully'
    });
  } catch (error) {
    console.error('Delete webhook error:', error);
    res.status(500).json({
      error: 'Failed to delete webhook',
      message: 'An error occurred while deleting webhook'
    });
  }
});

// Test webhook (admin only)
router.post('/webhooks/:id/test', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const webhook = webhooks.find(w => w.id === id);
    
    if (!webhook) {
      return res.status(404).json({
        error: 'Webhook not found',
        message: 'Webhook with this ID does not exist'
      });
    }

    // Mock webhook test
    const testPayload = {
      event: 'test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook payload',
        testId: Date.now().toString()
      }
    };

    // In production, this would actually send the webhook
    console.log(`Testing webhook ${webhook.name} at ${webhook.url}:`, testPayload);

    // Update webhook stats
    webhook.lastTriggered = new Date().toISOString();
    webhook.successCount++;

    res.json({
      message: 'Webhook test triggered successfully',
      testPayload,
      webhook: {
        id: webhook.id,
        name: webhook.name,
        lastTriggered: webhook.lastTriggered,
        successCount: webhook.successCount
      }
    });
  } catch (error) {
    console.error('Test webhook error:', error);
    res.status(500).json({
      error: 'Failed to test webhook',
      message: 'An error occurred while testing webhook'
    });
  }
});

// Get email templates (admin only)
router.get('/email-templates', authenticateToken, requireAdmin, (req, res) => {
  try {
    res.json({
      templates: emailTemplates,
      count: emailTemplates.length
    });
  } catch (error) {
    console.error('Fetch email templates error:', error);
    res.status(500).json({
      error: 'Failed to fetch email templates',
      message: 'An error occurred while fetching email templates'
    });
  }
});

// Create email template (admin only)
router.post('/email-templates', authenticateToken, requireAdmin, (req, res) => {
  try {
    const {
      name,
      subject,
      body,
      variables,
      active,
      description
    } = req.body;

    const newTemplate = {
      id: Date.now().toString(),
      name,
      subject,
      body,
      variables: variables || [],
      active: active !== undefined ? active : true,
      description: description || '',
      createdAt: new Date().toISOString(),
      createdBy: req.user.userId,
      updatedAt: new Date().toISOString()
    };

    emailTemplates.push(newTemplate);

    res.status(201).json({
      message: 'Email template created successfully',
      template: newTemplate
    });
  } catch (error) {
    console.error('Create email template error:', error);
    res.status(500).json({
      error: 'Failed to create email template',
      message: 'An error occurred while creating email template'
    });
  }
});

// Update email template (admin only)
router.put('/email-templates/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      subject,
      body,
      variables,
      active,
      description
    } = req.body;

    const template = emailTemplates.find(t => t.id === id);
    if (!template) {
      return res.status(404).json({
        error: 'Email template not found',
        message: 'Email template with this ID does not exist'
      });
    }

    // Update fields
    if (name !== undefined) template.name = name;
    if (subject !== undefined) template.subject = subject;
    if (body !== undefined) template.body = body;
    if (variables !== undefined) template.variables = variables;
    if (active !== undefined) template.active = active;
    if (description !== undefined) template.description = description;

    template.updatedAt = new Date().toISOString();

    res.json({
      message: 'Email template updated successfully',
      template
    });
  } catch (error) {
    console.error('Update email template error:', error);
    res.status(500).json({
      error: 'Failed to update email template',
      message: 'An error occurred while updating email template'
    });
  }
});

// Send test email (admin only)
router.post('/email-templates/:id/test', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { recipientEmail, variables } = req.body;

    const template = emailTemplates.find(t => t.id === id);
    if (!template) {
      return res.status(404).json({
        error: 'Email template not found',
        message: 'Email template with this ID does not exist'
      });
    }

    // Mock email sending
    const testEmail = {
      to: recipientEmail,
      subject: template.subject,
      body: template.body,
      variables: variables || {},
      sentAt: new Date().toISOString(),
      templateId: template.id
    };

    console.log('Test email sent:', testEmail);

    res.json({
      message: 'Test email sent successfully',
      email: testEmail
    });
  } catch (error) {
    console.error('Send test email error:', error);
    res.status(500).json({
      error: 'Failed to send test email',
      message: 'An error occurred while sending test email'
    });
  }
});

module.exports = router; 