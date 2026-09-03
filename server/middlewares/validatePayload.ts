import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const PayloadObjectSchema = z.object({
  feeder_id: z.string().optional(),
  substation_id: z.string().optional(),
}).passthrough();

const PayloadSchema = z.union([
  PayloadObjectSchema,
  z.array(z.any())
]);

const validateUrls = (obj: any): string | null => {
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const err = validateUrls(item);
      if (err) return err;
    }
  } else if (obj !== null && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'google_maps_url' && typeof value === 'string' && value.trim() !== '') {
        if (value.length > 500) return 'URL Google Maps quá dài (tối đa 500 ký tự)';
        if (!value.startsWith('https://')) return 'URL Google Maps phải bắt đầu bằng https://';
        try {
          const parsed = new URL(value);
          const validDomains = ['maps.google.com', 'www.google.com', 'goo.gl', 'maps.app.goo.gl'];
          if (!validDomains.includes(parsed.hostname)) {
            return 'Chỉ chấp nhận URL từ các domain: ' + validDomains.join(', ');
          }
        } catch {
          return 'URL Google Maps không hợp lệ';
        }
      } else if (key === 'primary_image' && typeof value === 'string' && value.trim() !== '') {
        if (value.startsWith('data:image/')) return 'Ảnh Base64 phải tải lên Storage; API chỉ lưu storage URL.';
        if (value.length > 2048) return 'URL ảnh quá dài (tối đa 2048 ký tự)';
        if (!value.startsWith('http://') && !value.startsWith('https://')) return 'URL ảnh phải bắt đầu bằng http:// hoặc https://';
        try {
          new URL(value);
        } catch {
          return 'URL ảnh không hợp lệ';
        }
      } else {
        const err = validateUrls(value);
        if (err) return err;
      }
    }
  }
  return null;
};

export const validatePayload = (req: Request, res: Response, next: NextFunction) => {
  if (['POST', 'PUT'].includes(req.method)) {
    try {
      if (req.body && typeof req.body === 'object') {
         req.body = PayloadSchema.parse(req.body);
      }
      
      const urlError = validateUrls(req.body);
      if (urlError) {
        return res.status(400).json({ success: false, message: urlError });
      }

      next();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Lỗi định dạng dữ liệu',
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
