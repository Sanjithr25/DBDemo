const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const recipes = [
    {
        title: 'Peanut Butter Banana Smoothie',
        calories: 550,
        prep_time: 5,
        category: ['snack', 'breakfast'],
        description: 'A quick and high-calorie smoothie perfect for post-workout recovery. Very filling and ideal for busy mornings when you need an instant energy boost.',
        ingredients: 'banana, peanut butter, milk, honey'
    },
    {
        title: 'Greek Salad',
        calories: 200,
        prep_time: 10,
        category: ['salad', 'dinner'],
        description: 'A light dinner ideal for weight loss. Refreshing cucumbers, tomatoes, and feta with olive oil. Low calorie and incredibly filling.',
        ingredients: 'cucumber, tomato, red onion, feta cheese, kalamata olives, olive oil'
    },
    {
        title: 'Spaghetti Carbonara',
        calories: 650,
        prep_time: 20,
        category: ['italian', 'dinner', 'comfort'],
        description: 'The ultimate comfort food for evening cravings. Rich and creamy Roman pasta with egg yolk and pecorino — deeply satisfying after a long day.',
        ingredients: 'spaghetti, eggs, pecorino romano, guanciale, black pepper'
    },
    {
        title: 'High Protein Scrambled Eggs',
        calories: 350,
        prep_time: 8,
        category: ['breakfast'],
        description: 'A high protein breakfast to power your morning. Fluffy eggs packed with spinach and topped with feta for extra nutrients and taste.',
        ingredients: 'eggs, spinach, feta cheese, butter, salt, pepper'
    },
    {
        title: 'French Onion Soup',
        calories: 400,
        prep_time: 60,
        category: ['french', 'dinner', 'comfort'],
        description: 'Warm and hearty comfort food for a cozy evening. Rich caramelized onion broth topped with crusty toasted baguette and bubbling melted Gruyere.',
        ingredients: 'onions, beef broth, baguette, gruyere cheese, butter, thyme'
    },
    {
        title: 'Quick Oats with Berries',
        calories: 280,
        prep_time: 5,
        category: ['breakfast', 'snack'],
        description: 'An easy meal for busy mornings. Fiber-rich oats topped with fresh antioxidant blueberries and raspberries. Quick, nutritious, and light.',
        ingredients: 'oats, blueberries, raspberries, almond milk, honey'
    },
    {
        title: 'Chicken Tikka Masala',
        calories: 550,
        prep_time: 45,
        category: ['indian', 'dinner'],
        description: 'A flavorful high-calorie dinner with roasted marinated chicken in a rich spiced creamy tomato sauce. Hearty and deeply aromatic.',
        ingredients: 'chicken, yogurt, tomato puree, cream, garam masala, cumin, turmeric'
    },
    {
        title: 'Miso Soup',
        calories: 100,
        prep_time: 10,
        category: ['japanese', 'snack'],
        description: 'An extremely low calorie light snack or starter. Traditional Japanese soup made with fermented soybean paste, silken tofu, and seaweed.',
        ingredients: 'miso paste, tofu, seaweed, green onions, dashi'
    },
    {
        title: 'Beef Stir Fry',
        calories: 450,
        prep_time: 15,
        category: ['asian', 'dinner'],
        description: 'A quick and high-protein dinner with lean flank steak, broccoli, and bell peppers tossed in savory soy-ginger sauce. Fast and filling.',
        ingredients: 'flank steak, broccoli, bell peppers, soy sauce, ginger, garlic, sesame oil'
    },
    {
        title: 'Avocado Toast with Eggs',
        calories: 420,
        prep_time: 10,
        category: ['breakfast', 'snack'],
        description: 'A trendy high-protein breakfast for busy mornings. Creamy smashed avocado on sourdough topped with a perfectly poached egg and chili flakes.',
        ingredients: 'sourdough bread, avocado, eggs, lemon, chili flakes, salt'
    },
    {
        title: 'Margarita Pizza',
        calories: 800,
        prep_time: 30,
        category: ['italian', 'comfort', 'dinner'],
        description: 'Classic Italian comfort food for evening indulgence. A high-calorie crowd-pleaser with tomato sauce, fresh mozzarella, and fragrant basil.',
        ingredients: 'pizza dough, tomato sauce, fresh mozzarella, basil, olive oil'
    },
    {
        title: 'Protein Smoothie Bowl',
        calories: 480,
        prep_time: 5,
        category: ['breakfast', 'snack'],
        description: 'A quick high-calorie breakfast and post-workout snack. Thick blended banana-protein base topped with granola, seeds, and sliced fruit.',
        ingredients: 'banana, protein powder, almond milk, granola, chia seeds, strawberries'
    }
];

async function seed() {
    const client = await pool.connect();
    try {
        console.log('🌱 Starting seed...');

        // Truncate first so we can safely re-run the script
        await client.query('TRUNCATE TABLE recipes RESTART IDENTITY');
        console.log('🗑️  Cleared existing data.');

        for (const r of recipes) {
            await client.query(
                `INSERT INTO recipes (title, calories, prep_time, category, description, ingredients)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [r.title, r.calories, r.prep_time, r.category, r.description, r.ingredients]
            );
            console.log(`  ✅ Inserted: ${r.title}`);
        }

        console.log(`\n🎉 Seed complete! ${recipes.length} recipes inserted.`);
    } catch (err) {
        console.error('❌ Seed failed:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

seed();
