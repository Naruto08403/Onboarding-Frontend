-- Driver Onboarding System Database Schema
-- PostgreSQL 13+ compatible

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    role VARCHAR(20) DEFAULT 'driver' CHECK (role IN ('driver', 'admin', 'super_admin')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'deleted')),
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,
    last_login_at TIMESTAMP,
    login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Driver profiles table
CREATE TABLE driver_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    date_of_birth DATE NOT NULL,
    address_street VARCHAR(255) NOT NULL,
    address_city VARCHAR(100) NOT NULL,
    address_state VARCHAR(50) NOT NULL,
    address_zip_code VARCHAR(20) NOT NULL,
    license_number VARCHAR(50) UNIQUE NOT NULL,
    license_expiry DATE NOT NULL,
    background_check_status VARCHAR(20) DEFAULT 'pending' CHECK (background_check_status IN ('pending', 'approved', 'rejected', 'requires_additional_info')),
    vehicle_inspection_status VARCHAR(20) DEFAULT 'pending' CHECK (vehicle_inspection_status IN ('pending', 'approved', 'rejected')),
    insurance_status VARCHAR(20) DEFAULT 'pending' CHECK (insurance_status IN ('pending', 'approved', 'rejected')),
    onboarding_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vehicles table
CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID REFERENCES driver_profiles(id) ON DELETE CASCADE,
    make VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    year INTEGER NOT NULL CHECK (year >= 1900 AND year <= EXTRACT(YEAR FROM CURRENT_DATE) + 1),
    color VARCHAR(50) NOT NULL,
    plate_number VARCHAR(20) UNIQUE NOT NULL,
    vin VARCHAR(17) UNIQUE,
    insurance_provider VARCHAR(100),
    insurance_policy_number VARCHAR(50),
    insurance_expiry DATE,
    registration_expiry DATE,
    inspection_expiry DATE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Background checks table
CREATE TABLE background_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID REFERENCES driver_profiles(id) ON DELETE CASCADE,
    ssn VARCHAR(11) NOT NULL, -- Format: XXX-XX-XXXX
    date_of_birth DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'requires_additional_info')),
    notes TEXT,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Previous addresses table
CREATE TABLE previous_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    background_check_id UUID REFERENCES background_checks(id) ON DELETE CASCADE,
    street VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(50) NOT NULL,
    zip_code VARCHAR(20) NOT NULL,
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Criminal history table
CREATE TABLE criminal_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    background_check_id UUID REFERENCES background_checks(id) ON DELETE CASCADE,
    has_convictions BOOLEAN NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Criminal convictions table
CREATE TABLE criminal_convictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    criminal_history_id UUID REFERENCES criminal_history(id) ON DELETE CASCADE,
    offense VARCHAR(500) NOT NULL,
    date DATE NOT NULL,
    location VARCHAR(255) NOT NULL,
    disposition VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Driving record table
CREATE TABLE driving_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    background_check_id UUID REFERENCES background_checks(id) ON DELETE CASCADE,
    has_violations BOOLEAN NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Driving violations table
CREATE TABLE driving_violations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driving_record_id UUID REFERENCES driving_records(id) ON DELETE CASCADE,
    violation VARCHAR(500) NOT NULL,
    date DATE NOT NULL,
    location VARCHAR(255) NOT NULL,
    points INTEGER NOT NULL CHECK (points >= 0 AND points <= 12),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Employment history table
CREATE TABLE employment_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    background_check_id UUID REFERENCES background_checks(id) ON DELETE CASCADE,
    employer VARCHAR(255) NOT NULL,
    position VARCHAR(255) NOT NULL,
    from_date DATE NOT NULL,
    to_date DATE,
    reason_for_leaving TEXT,
    contact_person VARCHAR(255),
    contact_phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Documents table
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('drivers_license', 'vehicle_registration', 'insurance_card', 'background_check', 'vehicle_inspection', 'medical_certificate', 'other')),
    description TEXT,
    expiry_date DATE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    notes TEXT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Emergency contacts table
CREATE TABLE emergency_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID REFERENCES driver_profiles(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    relationship VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Driver notes table
CREATE TABLE driver_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID REFERENCES driver_profiles(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    note TEXT NOT NULL,
    note_type VARCHAR(50) DEFAULT 'general' CHECK (note_type IN ('general', 'status_change', 'training', 'warning', 'approval')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System settings table
CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    setting_type VARCHAR(20) DEFAULT 'string' CHECK (setting_type IN ('string', 'number', 'boolean', 'json')),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit logs table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    target_id UUID,
    target_type VARCHAR(50),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50) DEFAULT 'general' CHECK (notification_type IN ('general', 'profile_update', 'document_status', 'background_check', 'system_maintenance', 'promotion')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    target_users JSONB NOT NULL, -- Can be 'all', specific user ID, or array of user IDs
    read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User notification preferences table
CREATE TABLE user_notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    email_notifications BOOLEAN DEFAULT TRUE,
    sms_notifications BOOLEAN DEFAULT TRUE,
    push_notifications BOOLEAN DEFAULT TRUE,
    notification_types JSONB DEFAULT '{"profile_updates": true, "document_status": true, "background_check": true, "system_maintenance": false, "promotions": false}',
    quiet_hours JSONB DEFAULT '{"enabled": false, "startTime": "22:00", "endTime": "08:00"}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Webhooks table
CREATE TABLE webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    events JSONB NOT NULL, -- Array of event types
    secret VARCHAR(255) NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    description TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    last_triggered TIMESTAMP,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Email templates table
CREATE TABLE email_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,
    variables JSONB DEFAULT '[]',
    active BOOLEAN DEFAULT TRUE,
    description TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Password reset tokens table
CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Phone verification codes table
CREATE TABLE phone_verification_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    phone_number VARCHAR(20) NOT NULL,
    code VARCHAR(10) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_driver_profiles_user_id ON driver_profiles(user_id);
CREATE INDEX idx_driver_profiles_license_number ON driver_profiles(license_number);
CREATE INDEX idx_vehicles_driver_id ON vehicles(driver_id);
CREATE INDEX idx_vehicles_plate_number ON vehicles(plate_number);
CREATE INDEX idx_vehicles_vin ON vehicles(vin);
CREATE INDEX idx_background_checks_driver_id ON background_checks(driver_id);
CREATE INDEX idx_background_checks_status ON background_checks(status);
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_type ON documents(document_type);
CREATE INDEX idx_audit_logs_admin_id ON audit_logs(admin_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_notifications_target_users ON notifications USING GIN(target_users);
CREATE INDEX idx_notifications_type ON notifications(notification_type);
CREATE INDEX idx_webhooks_active ON webhooks(active);
CREATE INDEX idx_password_reset_tokens_email ON password_reset_tokens(email);
CREATE INDEX idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX idx_phone_verification_codes_user_id ON phone_verification_codes(user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_driver_profiles_updated_at BEFORE UPDATE ON driver_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_background_checks_updated_at BEFORE UPDATE ON background_checks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_emergency_contacts_updated_at BEFORE UPDATE ON emergency_contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_driver_notes_updated_at BEFORE UPDATE ON driver_notes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_notification_preferences_updated_at BEFORE UPDATE ON user_notification_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_webhooks_updated_at BEFORE UPDATE ON webhooks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON email_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default system settings
INSERT INTO system_settings (setting_key, setting_value, setting_type, description) VALUES
('max_file_size', '5242880', 'number', 'Maximum file upload size in bytes (5MB)'),
('allowed_file_types', '["jpeg", "jpg", "png", "pdf", "doc", "docx"]', 'json', 'Allowed file types for uploads'),
('max_login_attempts', '5', 'number', 'Maximum failed login attempts before account lockout'),
('lockout_duration', '900000', 'number', 'Account lockout duration in milliseconds (15 minutes)'),
('session_timeout', '86400000', 'number', 'Session timeout in milliseconds (24 hours)'),
('require_email_verification', 'true', 'boolean', 'Whether email verification is required'),
('require_phone_verification', 'true', 'boolean', 'Whether phone verification is required'),
('require_background_check', 'true', 'boolean', 'Whether background check is required'),
('require_vehicle_inspection', 'true', 'boolean', 'Whether vehicle inspection is required'),
('system_name', 'Driver Onboarding System', 'string', 'System display name'),
('company_name', 'Your Company Name', 'string', 'Company name for branding'),
('support_email', 'support@company.com', 'string', 'Support email address'),
('support_phone', '+1234567890', 'string', 'Support phone number');

-- Create admin user (password: AdminPass123)
INSERT INTO users (email, password_hash, first_name, last_name, phone_number, role, status, email_verified, phone_verified) VALUES
('admin@company.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5u.G', 'System', 'Administrator', '+1234567890', 'super_admin', 'active', true, true);

-- Create sample email templates
INSERT INTO email_templates (name, subject, body, variables, description) VALUES
('welcome_email', 'Welcome to {{company_name}}', 'Dear {{firstName}},\n\nWelcome to {{company_name}}! Your account has been successfully created.\n\nPlease complete your profile to get started with the onboarding process.\n\nBest regards,\n{{company_name}} Team', '["firstName", "company_name"]', 'Welcome email for new users'),
('document_approved', 'Document Approved - {{documentType}}', 'Dear {{firstName}},\n\nYour {{documentType}} has been approved by our team.\n\nDocument: {{documentName}}\nStatus: Approved\n\nYou can now proceed with the next step in your onboarding process.\n\nBest regards,\n{{company_name}} Team', '["firstName", "documentType", "documentName", "company_name"]', 'Email notification when document is approved'),
('background_check_complete', 'Background Check Complete', 'Dear {{firstName}},\n\nYour background check has been completed and {{status}}.\n\n{{#if notes}}Notes: {{notes}}{{/if}}\n\n{{#if status === "approved"}}You can now proceed with the next step in your onboarding process.{{else}}Please review the notes and take necessary action.{{/if}}\n\nBest regards,\n{{company_name}} Team', '["firstName", "status", "notes", "company_name"]', 'Email notification when background check is complete');

-- Grant permissions (adjust as needed for your setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_app_user; 