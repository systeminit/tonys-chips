-- Seed initial product data
-- This migration inserts demo chip products for Tony's Chips application
-- Using hardcoded UUIDs to avoid dependency on pgcrypto extension

INSERT INTO "Product" ("id", "name", "brand", "description", "price", "imageUrl", "stockQuantity", "createdAt", "updatedAt")
VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'Classic Potato Chips', 'Lay''s', 'America''s favorite classic potato chips with a simple, satisfying crunch and salt.', 3.99, 'https://placehold.co/400x400/e3f2fd/1565c0?text=Lays+Classic', 50, NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440002', 'Sour Cream & Onion', 'Lay''s', 'Creamy and tangy sour cream flavor mixed with savory onion.', 3.99, 'https://placehold.co/400x400/f3e5f5/7b1fa2?text=Lays+SC%26O', 45, NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440003', 'Original', 'Pringles', 'The iconic stackable chip with a perfectly crispy texture and savory flavor.', 2.49, 'https://placehold.co/400x400/e8f5e9/2e7d32?text=Pringles+Original', 60, NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440004', 'Cheddar Cheese', 'Pringles', 'Rich, bold cheddar cheese flavor in every stackable chip.', 2.49, 'https://placehold.co/400x400/fff3e0/ef6c00?text=Pringles+Cheddar', 40, NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440005', 'Sea Salt', 'Kettle Brand', 'Kettle-cooked chips with simple, pure sea salt seasoning.', 4.49, 'https://placehold.co/400x400/fce4ec/c2185b?text=Kettle+Sea+Salt', 35, NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440006', 'Sea Salt & Vinegar', 'Kettle Brand', 'The perfect tangy balance of sea salt and vinegar on kettle-cooked chips.', 4.49, 'https://placehold.co/400x400/e0f2f1/00695c?text=Kettle+S%26V', 30, NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440007', 'BBQ', 'Lay''s', 'Sweet and smoky barbecue flavor on crispy potato chips.', 3.99, 'https://placehold.co/400x400/efebe9/4e342e?text=Lays+BBQ', 55, NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440008', 'Nacho Cheese', 'Doritos', 'Bold, cheesy nacho flavor on crunchy tortilla chips.', 4.29, 'https://placehold.co/400x400/fff9c4/f57f17?text=Doritos+Nacho', 70, NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440009', 'Cool Ranch', 'Doritos', 'Cool and zesty ranch flavor on crispy tortilla chips.', 4.29, 'https://placehold.co/400x400/e1f5fe/01579b?text=Doritos+Ranch', 65, NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440010', 'Jalapeño', 'Kettle Brand', 'Spicy jalapeño flavor on thick-cut kettle chips.', 4.49, 'https://placehold.co/400x400/f1f8e9/558b2f?text=Kettle+Jalapeno', 28, NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440011', 'Salt & Pepper', 'Kettle Brand', 'Classic combination of sea salt and cracked black pepper.', 4.49, 'https://placehold.co/400x400/eceff1/37474f?text=Kettle+S%26P', 32, NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440012', 'Wavy Original', 'Lay''s', 'Thick and ridged chips perfect for dipping.', 3.99, 'https://placehold.co/400x400/e3f2fd/1976d2?text=Lays+Wavy', 42, NOW(), NOW())
ON CONFLICT DO NOTHING;
