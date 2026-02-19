CREATE TABLE IF NOT EXISTS recipes (
    id SERIAL PRIMARY KEY,
    title TEXT,
    calories INT,
    prep_time INT,
    category TEXT[],
    description TEXT,
    ingredients TEXT
);

TRUNCATE TABLE recipes;

INSERT INTO recipes (title, calories, prep_time, category, description, ingredients) VALUES
('Spaghetti Carbonara', 650, 20, ARRAY['Italian', 'Pasta'], 'Classic Roman pasta dish with eggs, cheese, guanciale, and pepper.', 'Spaghetti, Eggs, Pecorino Romano, Guanciale, Black Pepper'),
('Chicken Tikka Masala', 550, 45, ARRAY['Indian', 'Curry'], 'Roasted marinated chicken chunks in a spiced creamy sauce.', 'Chicken, Yogurt, Tomato Puree, Cream, Garam Masala, Cumin, Turmeric'),
('Guacamole', 250, 10, ARRAY['Mexican', 'Dip'], 'Creamy avocado-based dip with fresh ingredients.', 'Avocado, Lime, Onion, Cilantro, Tomato, Jalapeno'),
('Beef Stir Fry', 450, 15, ARRAY['Asian', 'Beef'], 'Quick and healthy beef stir fry with bell peppers and broccoli.', 'Flank Steak, Broccoli, Bell Peppers, Soy Sauce, Ginger, Garlic'),
('Caesar Salad', 350, 15, ARRAY['Salad', 'Healthy'], 'Traditional Caesar salad with crisp romaine and creamy dressing.', 'Romaine Lettuce, Croutons, Parmesan Cheese, Caesar Dressing'),
('Margarita Pizza', 800, 30, ARRAY['Italian', 'Pizza'], 'Simple pizza with tomato sauce, mozzarella, and fresh basil.', 'Pizza Dough, Tomato Sauce, Fresh Mozzarella, Basil, Olive Oil'),
('French Onion Soup', 400, 60, ARRAY['French', 'Soup'], 'Rich onion broth topped with toasted bread and melted Gruyere.', 'Onions, Beef Broth, Baguette, Gruyere Cheese, Butter'),
('Sushi Rolls', 300, 40, ARRAY['Japanese', 'Seafood'], 'Homemade sushi with fresh salmon and avocado.', 'Sushi Rice, Nori, Salmon, Avocado, Rice Vinegar'),
('Chocolate Lava Cake', 500, 25, ARRAY['Dessert', 'Chocolate'], 'Warm chocolate cake with a molten center.', 'Dark Chocolate, Butter, Eggs, Sugar, Flour'),
('Greek Salad', 200, 10, ARRAY['Salad', 'Mediterranean'], 'Refreshing salad with cucumbers, tomatoes, and feta cheese.', 'Cucumber, Tomato, Red Onion, Feta Cheese, Kalamata Olives'),
('Beef Tacos', 500, 20, ARRAY['Mexican', 'Street Food'], 'Spiced ground beef in soft tortillas with various toppings.', 'Ground Beef, Tortillas, Lettuce, Cheese, Salsa, Sour Cream'),
('Vegetable Biryani', 450, 50, ARRAY['Indian', 'Rice'], 'Fragrant basmati rice cooked with mixed vegetables and spices.', 'Basmati Rice, Carrots, Peas, Potatoes, Biryani Masala, Saffron'),
('Pancakes', 400, 15, ARRAY['Breakfast', 'Sweet'], 'Fluffy buttermilk pancakes served with maple syrup.', 'Flour, Milk, Eggs, Baking Powder, Butter, Maple Syrup'),
('Miso Soup', 100, 10, ARRAY['Japanese', 'Soup'], 'Traditional Japanese soup made with fermented soybean paste.', 'Miso Paste, Tofu, Seaweed, Green Onions, Dashi'),
('Linguine with Clams', 550, 25, ARRAY['Italian', 'Seafood'], 'Elegant pasta dish with fresh clams, garlic, and white wine.', 'Linguine, Fresh Clams, Garlic, White Wine, Parsley, Chili Flakes'),
('Chicken Caesar Wrap', 450, 10, ARRAY['Lunch', 'Chicken'], 'Quick wrap with grilled chicken and Caesar salad.', 'Tortilla, Grilled Chicken, Romaine Lettuce, Parmesan, Caesar Dressing'),
('Ratatouille', 300, 90, ARRAY['French', 'Vegetarian'], 'Classic Provençal stewed vegetable dish.', 'Eggplant, Zucchini, Bell Peppers, Tomatoes, Onions, Herbs de Provence'),
('Pad Thai', 600, 30, ARRAY['Thai', 'Noodles'], 'Stir-fried rice noodles with shrimp, peanuts, and lime.', 'Rice Noodles, Shrimp, Eggs, Tofu, Bean Sprouts, Peanuts, Tamarind Paste'),
('Beef Bourguignon', 700, 180, ARRAY['French', 'Beef'], 'Slow-cooked beef stew braised in red wine and beef stock.', 'Beef Brisket, Red Wine, Onions, Carrots, Mushrooms, Bacon'),
('Falafel Wrap', 400, 20, ARRAY['Middle Eastern', 'Vegetarian'], 'Crispy falafel balls in a pita wrap with tahini sauce.', 'Falafel, Pita Bread, Hummus, Tomato, Cucumber, Tahini Sauce'),
('Peanut Butter Banana Smoothie', 550, 5, ARRAY['snack', 'breakfast'], 'A quick and high-calorie smoothie perfect for post-workout recovery. Very filling and ideal for busy mornings when you need an instant energy boost.', 'banana, peanut butter, milk, honey');
