import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const PayloadSchema = z.object({
  feeder_id: z.string().optional(),
  substation_id: z.string().optional(),
}).passthrough();

export const validatePayload = (req: Request, res: Response, next: NextFunction) => {
  if (['POST', 'PUT'].includes(req.method)) {
    try {
      req.body = PayloadSchema.parse(req.body);
      next();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Lỗi định dạng dữ liệu (Type Mismatch)',
          errors: error.issues || []
        });
      }
      return res.status(500).json({ 
        success: false, 
        message: 'Lỗi xác thực payload' 
      });
    }
  } else {
    next();
  }
};
