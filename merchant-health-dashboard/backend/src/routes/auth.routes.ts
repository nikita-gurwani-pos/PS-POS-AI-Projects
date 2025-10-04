import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import logger from '../utils/logger';
import dotenv from 'dotenv';
import { jwtDecode } from 'jwt-decode';

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
 *     summary: User authentication
 *     description: |
 *       Authenticate users to access the AI-powered Merchant Health Dashboard.
 *       
 *       **Authentication Flow:**
 *       1. Submit username and password
 *       2. Receive JWT token upon successful authentication
 *       3. Use JWT token in Authorization header for all subsequent requests
 *       
 *       **Default Credentials (Development):**
 *       - Username: `admin`
 *       - Password: `password`
 *       
 *       **Token Usage:**
 *       - Include token in Authorization header: `Bearer <token>`
 *       - Token expires in 6 hours
 *       - Use `/api/auth/verify` to check token validity
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *           examples:
 *             admin_login:
 *               summary: Admin user login
 *               value:
 *                 username: "admin"
 *                 password: "password"
 *     responses:
 *       200:
 *         description: Authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *             examples:
 *               successful_login:
 *                 summary: Successful authentication
 *                 value:
 *                   message: "Login successful"
 *                   token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoiYWRtaW4iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTk1OTA3NjAsImV4cCI6MTc1OTYxMjM2MH0.bbjaRurnF7EU2efVwrQDtbFWtLTPauTUsriMZYDfJ4E"
 *                   user:
 *                     id: 1
 *                     username: "admin"
 *                     role: "admin"
 *       400:
 *         description: Invalid request parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         description: Authentication failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Invalid credentials"
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
 *     summary: Verify JWT token validity
 *     description: |
 *       Check if the provided JWT token is valid and not expired.
 *       
 *       **Use Cases:**
 *       - Validate token before making API requests
 *       - Check token expiration status
 *       - Get current user information from token
 *       
 *       **Token Information:**
 *       - Tokens expire after 6 hours
 *       - Contains user ID, username, and role
 *       - Used for all authenticated API endpoints
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token is valid and not expired
 *         content:
 *           application/json:
 *             schema:
 *               type: 'object'
 *               properties:
 *                 valid:
 *                   type: 'boolean'
 *                   example: true
 *                   description: Whether the token is valid
 *                 user:
 *                   type: 'object'
 *                   properties:
 *                     id: 
 *                       type: 'number'
 *                       example: 1
 *                       description: User ID
 *                     username: 
 *                       type: 'string'
 *                       example: 'admin'
 *                       description: Username
 *                     role: 
 *                       type: 'string'
 *                       example: 'admin'
 *                       description: User role
 *             examples:
 *               valid_token:
 *                 summary: Valid token response
 *                 value:
 *                   valid: true
 *                   user:
 *                     id: 1
 *                     username: "admin"
 *                     role: "admin"
 *       401:
 *         description: Invalid, expired, or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               missing_token:
 *                 summary: No token provided
 *                 value:
 *                   error: "Access denied"
 *                   details: ["No token provided"]
 *               invalid_token:
 *                 summary: Invalid token format
 *                 value:
 *                   error: "Access denied"
 *                   details: ["Invalid token"]
 *               expired_token:
 *                 summary: Token has expired
 *                 value:
 *                   error: "Access denied"
 *                   details: ["Token expired"]
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



export function getTokenExpiry(token: string): Date | null {
  try {
    const decoded = jwtDecode<{ exp?: number }>(token);
    if (!decoded.exp) return null;

    const expiryDate = new Date(decoded.exp * 1000);
    return expiryDate;
  } catch (error) {
    console.error("Invalid token:", error);
    return null;
  }
}




export default router;