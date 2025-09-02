const express = require('express');
const multer = require('multer');
const path = require('path');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validateDocumentUpload } = require('../middleware/validation');
const { query } = require('../database/connection');
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow only specific file types
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image, PDF, and document files are allowed'));
    }
  }
});

// Upload document
router.post('/upload', authenticateToken, upload.single('document'), validateDocumentUpload, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        message: 'Please select a file to upload'
      });
    }

    const {
      documentType,
      description,
      expiryDate
    } = req.body;

    const userId = req.user.userId;

    // Insert document record into database
    const result = await query(`
      INSERT INTO documents (
        user_id, file_name, original_name, file_path, file_size, mime_type, document_type, 
        description, expiry_date, status, uploaded_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `, [
      userId,
      req.file.filename,
      req.file.originalname,
      req.file.path,
      req.file.size,
      req.file.mimetype,
      documentType,
      description || '',
      expiryDate || null,
      'pending'
    ]);

    res.status(201).json({
      message: 'Document uploaded successfully',
      document: {
        id: result.rows[0].id,
        fileName: result.rows[0].file_name,
        documentType: result.rows[0].document_type,
        status: result.rows[0].status,
        uploadedAt: result.rows[0].uploaded_at
      }
    });

  } catch (error) {
    console.error('Document upload error:', error);
    res.status(500).json({
      error: 'Document upload failed',
      message: 'An error occurred while uploading document'
    });
  }
});

// Get all documents for current user
router.get('/my-documents', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 10, status, documentType } = req.query;
    const offset = (page - 1) * limit;

    let whereConditions = ['d.user_id = $1'];
    let queryParams = [userId];
    let paramCount = 1;

    if (status) {
      paramCount++;
      whereConditions.push(`d.status = $${paramCount}`);
      queryParams.push(status);
    }

    if (documentType) {
      paramCount++;
      whereConditions.push(`d.document_type = $${paramCount}`);
      queryParams.push(documentType);
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    // Get total count
    const countResult = await query(`
      SELECT COUNT(*) as total FROM documents d ${whereClause}
    `, queryParams);

    const totalDocuments = parseInt(countResult.rows[0].total);

    // Get paginated documents
    const documentsResult = await query(`
      SELECT 
        d.*,
        u.email as user_email,
        u.first_name as user_first_name,
        u.last_name as user_last_name
      FROM documents d
      LEFT JOIN users u ON d.user_id = u.id
      ${whereClause}
      ORDER BY d.uploaded_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `, [...queryParams, limit, offset]);

    res.json({
      documents: documentsResult.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalDocuments / limit),
        totalDocuments,
        documentsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Fetch documents error:', error);
    res.status(500).json({
      error: 'Failed to fetch documents',
      message: 'An error occurred while fetching documents'
    });
  }
});

// Get all documents (admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, documentType } = req.query;
    const offset = (page - 1) * limit;

    let whereConditions = [];
    let queryParams = [];
    let paramCount = 0;

    // Filter by status
    if (status) {
      paramCount++;
      whereConditions.push(`d.status = $${paramCount}`);
      queryParams.push(status);
    }

    // Filter by document type
    if (documentType) {
      paramCount++;
      whereConditions.push(`d.document_type = $${paramCount}`);
      queryParams.push(documentType);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await query(`
      SELECT COUNT(*) as total FROM documents d ${whereClause}
    `, queryParams);

    const totalDocuments = parseInt(countResult.rows[0].total);

    // Get paginated documents
    const documentsResult = await query(`
      SELECT 
        d.*,
        u.email as user_email,
        u.first_name as user_first_name,
        u.last_name as user_last_name
      FROM documents d
      LEFT JOIN users u ON d.user_id = u.id
      ${whereClause}
      ORDER BY d.uploaded_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `, [...queryParams, limit, offset]);

    res.json({
      documents: documentsResult.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalDocuments / limit),
        totalDocuments,
        documentsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Fetch documents error:', error);
    res.status(500).json({
      error: 'Failed to fetch documents',
      message: 'An error occurred while fetching documents'
    });
  }
});

// Get document by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const result = await query(`
      SELECT 
        d.*,
        u.email as user_email,
        u.first_name as user_first_name,
        u.last_name as user_last_name
      FROM documents d
      LEFT JOIN users u ON d.user_id = u.id
      WHERE d.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Document not found',
        message: 'Document with this ID does not exist'
      });
    }

    const document = result.rows[0];

    // Check if user can access this document
    if (req.user.role !== 'admin' && document.user_id !== userId) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only view your own documents'
      });
    }

    res.json({ document });
  } catch (error) {
    console.error('Fetch document error:', error);
    res.status(500).json({
      error: 'Failed to fetch document',
      message: 'An error occurred while fetching document'
    });
  }
});

// Update document status (admin only)
router.patch('/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const result = await query(`
      UPDATE documents SET 
        status = $1,
        notes = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `, [status, notes, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Document not found',
        message: 'Document with this ID does not exist'
      });
    }

    // Log the status change
    await query(`
      INSERT INTO audit_logs (admin_id, action, details, target_id, target_type, created_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
    `, [req.user.userId, 'UPDATE_DOCUMENT_STATUS', `Document status changed to ${status}. Notes: ${notes}`, id, 'document']);

    res.json({
      message: 'Document status updated successfully',
      document: result.rows[0]
    });
  } catch (error) {
    console.error('Update document status error:', error);
    res.status(500).json({
      error: 'Failed to update document status',
      message: 'An error occurred while updating document status'
    });
  }
});

// Delete document
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Get document to check ownership
    const documentResult = await query('SELECT * FROM documents WHERE id = $1', [id]);

    if (documentResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Document not found',
        message: 'Document with this ID does not exist'
      });
    }

    const document = documentResult.rows[0];

    // Check if user can delete this document
    if (req.user.role !== 'admin' && document.user_id !== userId) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only delete your own documents'
      });
    }

    // Delete document from database
    await query('DELETE FROM documents WHERE id = $1', [id]);

    res.json({
      message: 'Document deleted successfully'
    });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({
      error: 'Failed to delete document',
      message: 'An error occurred while deleting document'
    });
  }
});

// Get document types
router.get('/types/list', authenticateToken, async (req, res) => {
  try {
    const documentTypes = [
      { value: 'drivers_license', label: 'Driver\'s License' },
      { value: 'vehicle_registration', label: 'Vehicle Registration' },
      { value: 'insurance_card', label: 'Insurance Card' },
      { value: 'background_check', label: 'Background Check' },
      { value: 'vehicle_inspection', label: 'Vehicle Inspection' },
      { value: 'medical_certificate', label: 'Medical Certificate' },
      { value: 'other', label: 'Other' }
    ];

    res.json({ documentTypes });
  } catch (error) {
    console.error('Fetch document types error:', error);
    res.status(500).json({
      error: 'Failed to fetch document types',
      message: 'An error occurred while fetching document types'
    });
  }
});

module.exports = router; 