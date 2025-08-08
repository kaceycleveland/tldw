-- Sample data for TLDW Chrome Extension development

-- Insert sample user (this would normally be created through auth, but for testing)
-- Note: In production, users are created via auth.users table automatically

-- Sample tags (would be created by users, but adding some defaults for testing)
-- These would be associated with a user_id in production
-- INSERT INTO public.tags (user_id, name, color) VALUES 
--   ('00000000-0000-0000-0000-000000000000', 'Important', '#EF4444'),
--   ('00000000-0000-0000-0000-000000000000', 'Reading List', '#10B981'),
--   ('00000000-0000-0000-0000-000000000000', 'Research', '#8B5CF6'),
--   ('00000000-0000-0000-0000-000000000000', 'Work', '#F59E0B');

-- Note: Sample extractions and profiles would be created after user authentication
-- This seed file is kept minimal since most data is user-specific and created after signup