import express from 'express';
import session from 'express-session';
import path from 'path';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

// Load environment variables
dotenv.config();

// Import routes
import productsRouter from './routes/products';
import cartRouter from './routes/cart';
import ordersRouter from './routes/orders';

const app = express();
const PORT = process.env.PORT || 3001;

// Configure session
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'tony-chips-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Set to true if using HTTPS
  })
);

// Initialize session ID for cart
app.use((req, res, next) => {
  if (!req.session.cartSessionId) {
    req.session.cartSessionId = uuidv4();
  }
  res.locals.sessionId = req.session.cartSessionId;
  next();
});

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Pass API URL to all views
app.use((req, res, next) => {
  res.locals.apiUrl = process.env.API_URL || 'http://localhost:3000';
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Routes
app.use('/', productsRouter);
app.use('/cart', cartRouter);
app.use('/orders', ordersRouter);

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).render('error', { error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
  console.log(`API URL: ${process.env.API_URL || 'http://localhost:3000'}`);
});
