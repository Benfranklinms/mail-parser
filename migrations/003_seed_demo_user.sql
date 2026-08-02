-- Seed script to allow demo/dev token (00000000-0000-0000-0000-000000000000) for local testing
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, role, aud)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000000',
    'demo@placementtracker.local',
    '',
    now(),
    now(),
    now(),
    'authenticated',
    'authenticated'
)
ON CONFLICT (id) DO NOTHING;
