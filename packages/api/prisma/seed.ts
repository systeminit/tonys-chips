import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Clear existing data
  await prisma.cartItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();

  // Create chip products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: "Classic Potato Chips",
        brand: "Lay's",
        description: "America's favorite classic potato chips with a simple, satisfying crunch and salt.",
        price: 3.99,
        imageUrl: "https://placehold.co/400x400/e3f2fd/1565c0?text=Lays+Classic",
        stockQuantity: 50,
      },
    }),
    prisma.product.create({
      data: {
        name: "Sour Cream & Onion",
        brand: "Lay's",
        description: "Creamy and tangy sour cream flavor mixed with savory onion.",
        price: 3.99,
        imageUrl: "https://placehold.co/400x400/f3e5f5/7b1fa2?text=Lays+SC%26O",
        stockQuantity: 45,
      },
    }),
    prisma.product.create({
      data: {
        name: "Original",
        brand: "Pringles",
        description: "The iconic stackable chip with a perfectly crispy texture and savory flavor.",
        price: 2.49,
        imageUrl: "https://placehold.co/400x400/e8f5e9/2e7d32?text=Pringles+Original",
        stockQuantity: 60,
      },
    }),
    prisma.product.create({
      data: {
        name: "Cheddar Cheese",
        brand: "Pringles",
        description: "Rich, bold cheddar cheese flavor in every stackable chip.",
        price: 2.49,
        imageUrl: "https://placehold.co/400x400/fff3e0/ef6c00?text=Pringles+Cheddar",
        stockQuantity: 40,
      },
    }),
    prisma.product.create({
      data: {
        name: "Sea Salt",
        brand: "Kettle Brand",
        description: "Kettle-cooked chips with simple, pure sea salt seasoning.",
        price: 4.49,
        imageUrl: "https://placehold.co/400x400/fce4ec/c2185b?text=Kettle+Sea+Salt",
        stockQuantity: 35,
      },
    }),
    prisma.product.create({
      data: {
        name: "Sea Salt & Vinegar",
        brand: "Kettle Brand",
        description: "The perfect tangy balance of sea salt and vinegar on kettle-cooked chips.",
        price: 4.49,
        imageUrl: "https://placehold.co/400x400/e0f2f1/00695c?text=Kettle+S%26V",
        stockQuantity: 30,
      },
    }),
    prisma.product.create({
      data: {
        name: "BBQ",
        brand: "Lay's",
        description: "Sweet and smoky barbecue flavor on crispy potato chips.",
        price: 3.99,
        imageUrl: "https://placehold.co/400x400/efebe9/4e342e?text=Lays+BBQ",
        stockQuantity: 55,
      },
    }),
    prisma.product.create({
      data: {
        name: "Nacho Cheese",
        brand: "Doritos",
        description: "Bold, cheesy nacho flavor on crunchy tortilla chips.",
        price: 4.29,
        imageUrl: "https://placehold.co/400x400/fff9c4/f57f17?text=Doritos+Nacho",
        stockQuantity: 70,
      },
    }),
    prisma.product.create({
      data: {
        name: "Cool Ranch",
        brand: "Doritos",
        description: "Cool and zesty ranch flavor on crispy tortilla chips.",
        price: 4.29,
        imageUrl: "https://placehold.co/400x400/e1f5fe/01579b?text=Doritos+Ranch",
        stockQuantity: 65,
      },
    }),
    prisma.product.create({
      data: {
        name: "Jalapeño",
        brand: "Kettle Brand",
        description: "Spicy jalapeño flavor on thick-cut kettle chips.",
        price: 4.49,
        imageUrl: "https://placehold.co/400x400/f1f8e9/558b2f?text=Kettle+Jalapeno",
        stockQuantity: 28,
      },
    }),
    prisma.product.create({
      data: {
        name: "Salt & Pepper",
        brand: "Kettle Brand",
        description: "Classic combination of sea salt and cracked black pepper.",
        price: 4.49,
        imageUrl: "https://placehold.co/400x400/eceff1/37474f?text=Kettle+S%26P",
        stockQuantity: 32,
      },
    }),
    prisma.product.create({
      data: {
        name: "Wavy Original",
        brand: "Lay's",
        description: "Thick and ridged chips perfect for dipping.",
        price: 3.99,
        imageUrl: "https://placehold.co/400x400/e3f2fd/1976d2?text=Lays+Wavy",
        stockQuantity: 42,
      },
    }),
  ]);

  console.log(`Created ${products.length} products`);
  console.log('Seed completed successfully!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
