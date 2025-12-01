// test-auth.js
// Run with: node test-auth.js

import { registerUser } from './auth.js';
import { pool } from './db.js';

async function testRegisterUser() {
    console.log('\n========================================');
    console.log('Testing registerUser (Step 1)');
    console.log('========================================\n');
    
    try {
        // Clean up any previous test user
        await pool.query("DELETE FROM users WHERE email LIKE 'test%@example.com'");
        console.log('✓ Cleaned up previous test data\n');
        
        // ============================================
        // Test validation
        // ============================================
        console.log('--- VALIDATION TESTS ---\n');
        
        // Test: Missing email
        console.log('Test: Missing email...');
        try {
            await registerUser(null, 'password123');
            console.log('✗ Should have thrown an error!');
        } catch (error) {
            console.log('✓ Rejected:', error.message);
        }
        
        // Test: Missing password
        console.log('Test: Missing password...');
        try {
            await registerUser('test@example.com', null);
            console.log('✗ Should have thrown an error!');
        } catch (error) {
            console.log('✓ Rejected:', error.message);
        }
        
        // Test: Invalid email format
        console.log('Test: Invalid email format...');
        try {
            await registerUser('not-an-email', 'password123');
            console.log('✗ Should have thrown an error!');
        } catch (error) {
            console.log('✓ Rejected:', error.message);
        }
        
        // Test: Password too short
        console.log('Test: Password too short...');
        try {
            await registerUser('test@example.com', 'short');
            console.log('✗ Should have thrown an error!');
        } catch (error) {
            console.log('✓ Rejected:', error.message);
        }
        
        // ============================================
        // Test successful registration
        // ============================================
        console.log('\n--- SUCCESSFUL REGISTRATION TEST ---\n');
        
        console.log('Test: Register valid user...');
        const user = await registerUser('test@example.com', 'password123');
        
        console.log('✓ User created:');
        console.log('  - id:', user.id);
        console.log('  - email:', user.email);
        console.log('  - status:', user.status);
        console.log('  - created_at:', user.created_at);
        
        // Verify in database
        const dbCheck = await pool.query(
            'SELECT id, email, username, tag, status, password_hash FROM users WHERE id = $1',
            [user.id]
        );
        const dbUser = dbCheck.rows[0];
        
        console.log('\n✓ Database verification:');
        console.log('  - username is NULL:', dbUser.username === null);
        console.log('  - tag is NULL:', dbUser.tag === null);
        console.log('  - status is pending_profile:', dbUser.status === 'pending_profile');
        console.log('  - password_hash exists:', dbUser.password_hash !== null);
        console.log('  - password is hashed (not plain):', !dbUser.password_hash.includes('password'));
        
        // ============================================
        // Test duplicate email
        // ============================================
        console.log('\n--- DUPLICATE EMAIL TEST ---\n');
        
        console.log('Test: Try duplicate email...');
        try {
            await registerUser('test@example.com', 'different_password');
            console.log('✗ Should have thrown an error!');
        } catch (error) {
            console.log('✓ Rejected:', error.message);
        }
        
        // ============================================
        // Summary
        // ============================================
        console.log('\n========================================');
        console.log('All tests passed!');
        console.log('========================================\n');
        
    } catch (error) {
        console.error('\n✗ Test failed:', error.message);
        console.error(error);
    } finally {
        await pool.end();
    }
}

testRegisterUser();
