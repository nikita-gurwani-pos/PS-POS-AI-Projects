import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export default (error: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error:', error);

  // Default error response
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal server error';

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
};