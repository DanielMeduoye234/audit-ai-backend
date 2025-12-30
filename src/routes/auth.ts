import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import userRepository from '../repositories/userRepository';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-change-in-prod';

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, organizationName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if user exists
    const existingUser = userRepository.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = {
      user_id: uuidv4(),
      email,
      password: hashedPassword,
      name: name || email.split('@')[0],
      company: organizationName || 'My Organization',
      profile_picture: `https://ui-avatars.com/api/?name=${email}&background=random`
    };

    try {
      userRepository.createUser(newUser);
      console.log('✅ User created successfully:', newUser.email);
    } catch (dbError: any) {
      console.error('❌ Database error creating user:', dbError);
      return res.status(500).json({ error: 'Database error saving new user' });
    }

    // Generate token
    const token = jwt.sign({ id: newUser.user_id, email: newUser.email }, JWT_SECRET, {
      expiresIn: '7d'
    });

    res.status(201).json({ 
      success: true, 
      token, 
      user: {
        id: newUser.user_id,
        email: newUser.email,
        name: newUser.name,
        company: newUser.company
      }
    });

  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message || 'Registration failed' });
  }
});

/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = userRepository.getUserByEmail(email);
    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign({ id: user.user_id, email: user.email }, JWT_SECRET, {
      expiresIn: '7d'
    });

    res.json({ 
      success: true, 
      token, 
      user: {
        id: user.user_id,
        email: user.email,
        name: user.name,
        company: user.company
      }
    });

  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * GET /api/auth/me
 * Validate session
 */
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = userRepository.getUser(decoded.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        id: user.user_id,
        email: user.email,
        name: user.name,
        company: user.company
      }
    });

  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
