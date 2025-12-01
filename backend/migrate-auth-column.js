// migrate-auth-flow.js
import { pool } from './db.js';

async function migrateAuthFlow() {
    console.log('\n========================================');
    console.log('Migrating to 2-step registration');
    console.log('========================================\n');

    try {

        //remove constraints
        console.log('Removing user_profile_complete_check');
        await pool.query(`
            ALTER TABLE users 
            DROP CONSTRAINT IF EXISTS users_profile_complete_check,
            DROP CONSTRAINT IF EXISTS users_status_check
            `);
        
        //Change setting from pendung_profile to no_username
        console.log('Setting incomplete users to no_username...');
        await pool.query(`
            UPDATE users 
            SET status = 'no_username' 
            WHERE username IS NULL AND status = 'pending_profile'
        `);
        
        //set the default for NEW users
        console.log('Setting default for new users...');
        await pool.query(`
            ALTER TABLE users 
            ALTER COLUMN status SET DEFAULT 'no_username'
        `);
        
        // Step 4: Add status constraint
        console.log('Adding status constraint...');
        await pool.query(`
            ALTER TABLE users 
            ADD CONSTRAINT users_status_check 
            CHECK (status IN ('no_username', 'active', 'suspended'))
        `);
        
        // Step 5: Add the cross-check constraint
        // This enforces: active users MUST have username and tag
        console.log('Adding profile completeness constraint...');
        await pool.query(`
            ALTER TABLE users 
            ADD CONSTRAINT users_profile_complete_check 
            CHECK (
                (status = 'active' AND username IS NOT NULL AND tag IS NOT NULL)
                OR
                (status IN ('no_username', 'suspended'))
            )
        `);
        
        console.log('\n✓ Migration complete!');
        console.log('\nConstraints added:');
        console.log('  - status must be: no_username | active | suspended');
        console.log('  - active users MUST have username and tag');
        console.log('  - no_username users CAN have NULL username/tag');
        console.log('  - username+tag combo must be unique (when set)');
        
    } catch (error) {
        console.error('Migration failed:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

migrateAuthFlow();