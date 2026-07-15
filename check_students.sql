-- 1. All students and their profile + isAiProcessed status
SELECT
    u.id,
    u.email,
    sp."isAiProcessed",
    sp.id AS profile_id
FROM users u
LEFT JOIN student_profiles sp ON sp."userId" = u.id::text
LEFT JOIN user_roles ur ON ur.user_id = u.id
LEFT JOIN roles r ON r.id = ur.role_id
WHERE r.name = 'student'
LIMIT 20;

-- 2. Count breakdown
SELECT
    sp."isAiProcessed",
    COUNT(*) AS student_count
FROM users u
LEFT JOIN student_profiles sp ON sp."userId" = u.id::text
LEFT JOIN user_roles ur ON ur.user_id = u.id
LEFT JOIN roles r ON r.id = ur.role_id
WHERE r.name = 'student'
GROUP BY sp."isAiProcessed";

-- 3. Summary totals
SELECT
    COUNT(DISTINCT u.id) AS total_students,
    COUNT(DISTINCT sp.id) AS students_with_profile,
    COUNT(DISTINCT CASE WHEN sp."isAiProcessed" = true THEN u.id END) AS students_ai_processed
FROM users u
LEFT JOIN student_profiles sp ON sp."userId" = u.id::text
LEFT JOIN user_roles ur ON ur.user_id = u.id
LEFT JOIN roles r ON r.id = ur.role_id
WHERE r.name = 'student';
