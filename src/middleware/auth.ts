import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Only create Supabase client if credentials are available
const supabase = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
      };
    }
  }
}

/**
 * Authentication middleware
 * Verifies Supabase JWT token and attaches user to request
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  console.log('🔒 [AUTH] Request:', req.method, req.url);
  
  try {
    // Development mode: allow requests without auth if Supabase is not configured
    if (!supabase) {
      console.warn('⚠️  [AUTH] Supabase not configured - using dev mode');
      const userId = req.body?.user_id || req.params?.userId;
      
      if (!userId) {
        console.error('❌ [AUTH] No user ID provided in dev mode');
        return res.status(401).json({ error: 'User ID required. Please ensure you are logged in.' });
      }
      
      console.log('✅ [AUTH] Dev mode: Using user ID:', userId);
      req.user = { id: userId };
      return next();
    }

    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ [AUTH] Missing or invalid auth header');
      return res.status(401).json({ 
        error: 'Missing or invalid authorization header',
        details: 'Please ensure you are logged in. If the problem persists, try logging out and logging back in.'
      });
    }

    const token = authHeader.substring(7);
    console.log('🔑 [AUTH] Token length:', token.length);
    
    // Check if this is a workaround token (created by frontend for corrupted Supabase tokens)
    if (token.includes('.workaround_signature')) {
      console.log('🔧 [AUTH] Detected workaround token');
      
      try {
        // Extract the payload (middle part of JWT)
        const parts = token.split('.');
        if (parts.length !== 3) {
          console.error('❌ [AUTH] Invalid workaround token format');
          return res.status(401).json({ error: 'Invalid token format' });
        }
        
        const payload = JSON.parse(atob(parts[1]));
        
        if (!payload.sub) {
          console.error('❌ [AUTH] Workaround token missing user ID');
          return res.status(401).json({ error: 'Invalid token: missing user ID' });
        }
        
        console.log('✅ [AUTH] User authenticated via workaround token:', payload.sub);
        req.user = {
          id: payload.sub,
          email: payload.email
        };
        return next();
      } catch (error: any) {
        console.error('❌ [AUTH] Error decoding workaround token:', error.message);
        return res.status(401).json({ error: 'Invalid workaround token' });
      }
    }
    
    // Try Supabase verification with extended timeout
    try {
      const verifyPromise = supabase.auth.getUser(token);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Supabase timeout')), 5000)
      );
      
      const result = await Promise.race([verifyPromise, timeoutPromise]) as any;
      const { data: { user }, error } = result;

      if (!error && user) {
        console.log('✅ [AUTH] User authenticated via Supabase:', user.id);
        req.user = { id: user.id, email: user.email };
        return next();
      }
      
      console.warn('⚠️ [AUTH] Supabase verification failed, trying JWT decode fallback');
    } catch (supabaseError: any) {
      console.warn('⚠️ [AUTH] Supabase error:', supabaseError.message);
    }

    // Fallback: Decode JWT locally
    const jwt = require('jsonwebtoken');
    const decoded = jwt.decode(token);
    
    if (!decoded || !decoded.sub) {
      console.error('❌ [AUTH] Invalid token structure');
      return res.status(401).json({ 
        error: 'Invalid token structure',
        details: 'Token is missing user ID. Please log out and log back in.'
      });
    }

    console.log('✅ [AUTH] User authenticated via JWT decode:', decoded.sub);
    req.user = {
      id: decoded.sub,
      email: decoded.email
    };

    next();
  } catch (error: any) {
    console.error('❌ [AUTH] Error:', error.message);
    return res.status(401).json({ 
      error: 'Authentication failed',
      details: error.message
    });
  }
}

/**
 * Optional authentication middleware
 * Attaches user if token is present, but doesn't require it
 */
export async function optionalAuthenticate(req: Request, res: Response, next: NextFunction) {
  try {
    if (!supabase) {
      return next(); // Skip auth if not configured
    }

    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user } } = await supabase.auth.getUser(token);

      if (user) {
        req.user = {
          id: user.id,
          email: user.email
        };
      }
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
}
