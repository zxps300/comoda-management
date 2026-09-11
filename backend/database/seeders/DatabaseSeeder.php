<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\MenuItem;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Users
        $users = [
            ['full_name' => 'Admin User', 'username' => 'admin', 'password' => 'admin123', 'email' => 'admin@comoda.com', 'role' => 'Admin'],
            ['full_name' => 'John Doe', 'username' => 'cashier', 'password' => 'cashier123', 'email' => 'john@comoda.com', 'role' => 'Cashier'],
            ['full_name' => 'Jane Smith', 'username' => 'waiter', 'password' => 'waiter123', 'email' => 'jane@comoda.com', 'role' => 'Waiter'],
            ['full_name' => 'Chef Mike', 'username' => 'kitchen', 'password' => 'kitchen123', 'email' => 'chef@comoda.com', 'role' => 'Kitchen Staff'],
            ['full_name' => 'Sam Buyer', 'username' => 'purchaser', 'password' => 'purchaser123', 'email' => 'sam@comoda.com', 'role' => 'Purchaser'],
        ];

        foreach ($users as $userData) {
            User::create($userData);
        }

        // Menu Items
        $menuItems = [
            ['name' => 'Adobo (Chicken)', 'category' => 'Main Course', 'price' => 185, 'available' => true, 'image' => 'https://images.unsplash.com/photo-1598103442097-8b74df4f0129?w=400&h=300&fit=crop'],
            ['name' => 'Adobo (Pork)', 'category' => 'Main Course', 'price' => 195, 'available' => true, 'image' => 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=300&fit=crop'],
            ['name' => 'Sinigang na Baboy', 'category' => 'Main Course', 'price' => 220, 'available' => true, 'image' => 'https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=400&h=300&fit=crop'],
            ['name' => 'Grilled Chicken', 'category' => 'Main Course', 'price' => 210, 'available' => true, 'image' => 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=400&h=300&fit=crop'],
            ['name' => 'Fried Rice', 'category' => 'Rice Meals', 'price' => 55, 'available' => true, 'image' => 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&h=300&fit=crop'],
            ['name' => 'Plain Rice', 'category' => 'Rice Meals', 'price' => 30, 'available' => true, 'image' => 'https://images.unsplash.com/photo-1536304993881-460e97aa3088?w=400&h=300&fit=crop'],
            ['name' => 'Garlic Rice', 'category' => 'Rice Meals', 'price' => 45, 'available' => true, 'image' => 'https://images.unsplash.com/photo-1596560548464-f010549b84d7?w=400&h=300&fit=crop'],
            ['name' => 'Pancit Canton', 'category' => 'Noodles', 'price' => 150, 'available' => true, 'image' => 'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=400&h=300&fit=crop'],
            ['name' => 'Pancit Bihon', 'category' => 'Noodles', 'price' => 140, 'available' => true, 'image' => 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&h=300&fit=crop'],
            ['name' => 'Lumpiang Shanghai', 'category' => 'Appetizers', 'price' => 120, 'available' => true, 'image' => 'https://images.unsplash.com/photo-1548340748-6d2b7d7da280?w=400&h=300&fit=crop'],
            ['name' => 'Calamares', 'category' => 'Appetizers', 'price' => 165, 'available' => true, 'image' => 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop'],
            ['name' => 'Caesar Salad', 'category' => 'Salads', 'price' => 135, 'available' => true, 'image' => 'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400&h=300&fit=crop'],
            ['name' => 'Halo-Halo', 'category' => 'Desserts', 'price' => 95, 'available' => true, 'image' => 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop'],
            ['name' => 'Leche Flan', 'category' => 'Desserts', 'price' => 75, 'available' => true, 'image' => 'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=400&h=300&fit=crop'],
            ['name' => 'Iced Tea', 'category' => 'Beverages', 'price' => 45, 'available' => true, 'image' => 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&h=300&fit=crop'],
            ['name' => 'Coffee', 'category' => 'Beverages', 'price' => 65, 'available' => true, 'image' => 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop'],
            ['name' => 'Soft Drink', 'category' => 'Beverages', 'price' => 40, 'available' => true, 'image' => 'https://images.unsplash.com/photo-1581006852262-e4307cf6283a?w=400&h=300&fit=crop'],
            ['name' => 'Bottled Water', 'category' => 'Beverages', 'price' => 25, 'available' => true, 'image' => 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400&h=300&fit=crop'],
            ['name' => 'Kare-Kare', 'category' => 'Main Course', 'price' => 280, 'available' => true, 'image' => 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=400&h=300&fit=crop'],
            ['name' => 'Sisig', 'category' => 'Main Course', 'price' => 175, 'available' => true, 'image' => 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=300&fit=crop'],
        ];

        foreach ($menuItems as $item) {
            MenuItem::create($item);
        }
    }
}
