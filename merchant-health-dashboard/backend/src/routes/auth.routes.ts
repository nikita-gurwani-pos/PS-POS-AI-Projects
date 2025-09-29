import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import logger from '../utils/logger';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Validation schemas
const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required')
});

// Dummy user (in production, this would be in a database)
const DUMMY_USER = {
  id: 1,
  username: 'admin',
  password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password: "password"
  role: 'admin'
};

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User login
 *     description: Authenticate user with username and password
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/login', async (req, res) => {
  try {
    // Validate input
    const { username, password } = loginSchema.parse(req.body);

    // Check if user exists
    if (username !== DUMMY_USER.username) {
      return res.status(401).json({ 
        error: 'Invalid credentials' 
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, DUMMY_USER.password);
    if (!isValidPassword) {
      return res.status(401).json({ 
        error: 'Invalid credentials' 
      });
    }

    console.log(process.env.JWT_SECRET);
    // Generate JWT token
    const token = await generateJWTToken();

    logger.info(`User ${username} logged in successfully`);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: DUMMY_USER.id,
        username: DUMMY_USER.username,
        role: DUMMY_USER.role
      }
    });

  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ 
        error: 'Validation error',
        details: error.errors 
      });
    }
    
    logger.error('Login error:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

/**
 * @swagger
 * /api/auth/verify:
 *   get:
 *     summary: Verify JWT token
 *     description: Verify if the provided JWT token is valid
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token is valid
 *         content:
 *           application/json:
 *             schema:
 *               type: 'object'
 *               properties:
 *                 valid:
 *                   type: 'boolean'
 *                   example: true
 *                 user:
 *                   type: 'object'
 *                   properties:
 *                     id: { type: 'number', example: 1 }
 *                     username: { type: 'string', example: 'admin' }
 *                     role: { type: 'string', example: 'admin' }
 *       401:
 *         description: Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        error: 'No token provided' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    
    res.json({
      valid: true
    });

  } catch (error: any) {
    logger.error('Token verification error:', error);
    res.status(401).json({ 
      valid: false
    });
  }
});

async function generateJWTToken(){

  const payload =  { 
    userId: DUMMY_USER.id, 
    username: DUMMY_USER.username,
    role: DUMMY_USER.role 
  };

  const token = jwt.sign(
    payload,
    process.env.JWT_SECRET as string,
    { expiresIn: '6h' , algorithm: "HS256"}
  );
  return token;
}



export default router;