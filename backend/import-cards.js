import { pool } from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Import all Yu-Gi-Oh! cards from cards.json into the database
 * 
 * This script:
 * - Reads cards.json
 * - Filters to only relevant fields
 * - Batch inserts into cards table
 * - Shows progress and statistics
 */

async function importCards() {
    console.log('\n========================================');
    console.log('Yu-Gi-Oh! Card Database Import');
    console.log('========================================\n');



    try {
        // Read the JSON file
        console.log('Step 1: Reading cards.json...');
        const cardsPath = path.join(__dirname, 'cards.json');
        const cardsData = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));
        console.log(`✓ Found ${cardsData.length} cards in file\n`);

        // Prepare cards for import
        console.log('Step 2: Processing cards...');
        const processedCards = cardsData.map(card => ({
            id: card.id,
            name: card.name,
            type: card.type,
            humanReadableCardType: card.humanReadableCardType,
            frameType: card.frameType,
            description: card.desc,
            pendulum_description: card.pend_desc || null,
            race: card.race,
            archetype: card.archetype || null,
            atk: card.atk || null,
            def: card.def || null,
            level: card.level || null,
            attribute: card.attribute || null
        }));

        /* processedCards.forEach(c => {
            if (![
                'spell','effect','normal','link','trap','fusion','effect_pendulum',
                'xyz','synchro','ritual','skill','token','fusion_pendulum',
                'normal_pendulum','synchro_pendulum','xyz_pendulum','ritual_pendulum'
            ].includes(c.frameType)) {
                c.frameType = 'normal';
            }
        }); */

        // Batch insert (using chunking for better performance)
        console.log('Step 3: Inserting cards into database...');
        const BATCH_SIZE = 500;
        let imported = 0;

        for (let i = 0; i < processedCards.length; i += BATCH_SIZE) {
            const batch = processedCards.slice(i, i + BATCH_SIZE);

            // Build the VALUES clause for batch insert
            const values = [];
            const params = [];
            let paramIndex = 1;

            for (const card of batch) {
                values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, 
                $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, 
                $${paramIndex + 7}, $${paramIndex + 8}, $${paramIndex + 9}, $${paramIndex + 10}, 
                $${paramIndex + 11}, $${paramIndex + 12})`);
                params.push(
                    card.id,
                    card.name,
                    card.type,
                    card.humanReadableCardType,
                    card.frameType,
                    card.description,
                    card.pendulum_description,
                    card.race,
                    card.archetype,
                    card.atk,
                    card.def,
                    card.level,
                    card.attribute
                );
                paramIndex += 13;
            }

            const query = `
                INSERT INTO cards (id, name, type, humanReadableCardType, frameType, description, pendulum_description, race, archetype, atk, def, level, attribute)
                VALUES ${values.join(', ')}
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    type = EXCLUDED.type,
                    humanReadableCardType = EXCLUDED.humanReadableCardType,
                    frameType = EXCLUDED.frameType,
                    description = EXCLUDED.description,
                    pendulum_description = EXCLUDED.pendulum_description,
                    race = EXCLUDED.race,
                    archetype = EXCLUDED.archetype,
                    atk = EXCLUDED.atk,
                    def = EXCLUDED.def,
                    level = EXCLUDED.level,
                    attribute = EXCLUDED.attribute
            `;

            await pool.query(query, params);
            imported += batch.length;
            
            // Progress indicator
            const percentage = ((imported / processedCards.length) * 100).toFixed(1);
            process.stdout.write(`\r  Progress: ${imported}/${processedCards.length} (${percentage}%)`);
        }

        console.log('\n✓ All cards imported successfully\n');

        // Verify import
        console.log('Step 4: Verifying import...');
        const countResult = await pool.query('SELECT COUNT(*) as count FROM cards');
        const count = parseInt(countResult.rows[0].count);
        
        console.log(`✓ Database contains ${count} cards\n`);

        // Show some examples
        console.log('Sample cards:');
        const samples = await pool.query(`
            SELECT name, type, humanReadableCardType, archetype 
            FROM cards 
            LIMIT 5
        `);
        samples.rows.forEach(card => {
            console.log(`  - ${card.name} (${card.humanreadablecardtype}${card.archetype ? `, ${card.archetype}` : ''})`);
        });

        console.log('\n========================================');
        console.log('✓ Card Import Complete!');
        console.log('========================================\n');

        return { success: true, imported: count };

    } catch (error) {
        console.error('\n========================================');
        console.error('✗ Card Import Failed');
        console.error('========================================\n');
        console.error('Error:', error.message);
        console.error('\nStack:', error.stack);
        throw error;
    }
}

async function searchCards(searchTerm, limit = 10) {
    try {
        const result = await pool.query(
            `SELECT id, name, type, humanReadableCardType, archetype, atk, def, level, attribute
             FROM cards
             WHERE name ILIKE $1
             ORDER BY name
             LIMIT $2`,
            [`%${searchTerm}%`, limit]
        );
        return result.rows;
    } catch (error) {
        console.error('Error searching cards:', error);
        throw error;
    }
}

async function getCardById(cardId) {
    try {
        const result = await pool.query(
            'SELECT * FROM cards WHERE id = $1',
            [cardId]
        );
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error getting card:', error);
        throw error;
    }
}

async function getCardsByArchetype(archetype, limit = 50) {
    try {
        const result = await pool.query(
            `SELECT id, name, type, humanReadableCardType, atk, def, level, attribute
             FROM cards
             WHERE archetype = $1
             ORDER BY name
             LIMIT $2`,
            [archetype, limit]
        );
        return result.rows;
    } catch (error) {
        console.error('Error getting cards by archetype:', error);
        throw error;
    }
}

async function getCardStats() {
    try {
        const stats = await pool.query(`
            SELECT 
                COUNT(*) as total_cards,
                COUNT(*) FILTER (WHERE frameType NOT IN ('spell', 'trap')) as monsters,
                COUNT(*) FILTER (WHERE frameType = 'spell') as spells,
                COUNT(*) FILTER (WHERE frameType = 'trap') as traps,
                COUNT(*) FILTER (WHERE frameType = 'normal') as normal_monsters,
                COUNT(*) FILTER (WHERE frameType = 'effect') as effect_monsters,
                COUNT(*) FILTER (WHERE frameType = 'fusion') as fusion_monsters,
                COUNT(*) FILTER (WHERE frameType = 'synchro') as synchro_monsters,
                COUNT(*) FILTER (WHERE frameType = 'xyz') as xyz_monsters,
                COUNT(*) FILTER (WHERE frameType = 'link') as link_monsters,
                COUNT(DISTINCT archetype) as unique_archetypes
            FROM cards
        `);
        return stats.rows[0];
    } catch (error) {
        console.error('Error getting card stats:', error);
        throw error;
    }
}

export { 
    importCards, 
    searchCards, 
    getCardById, 
    getCardsByArchetype, 
    getCardStats 
};
