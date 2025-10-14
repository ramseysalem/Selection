import multer from 'multer';
import path from 'path';
import { Request } from 'express';
import sharp from 'sharp';

// Allowed file types and extensions
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

interface FileUploadConfig {
  maxFileSize?: number;
  allowedTypes?: string[];
  allowedExtensions?: string[];
  stripMetadata?: boolean;
  resizeImage?: { width: number; height: number };
}

class FileUploadSecurity {
  
  // Validate file type by checking both MIME type and extension
  validateFileType(file: Express.Multer.File, config: FileUploadConfig = {}): { isValid: boolean; error?: string } {
    const allowedTypes = config.allowedTypes || ALLOWED_IMAGE_TYPES;
    const allowedExtensions = config.allowedExtensions || ALLOWED_EXTENSIONS;
    
    // Check MIME type
    if (!allowedTypes.includes(file.mimetype)) {
      return {
        isValid: false,
        error: `File type ${file.mimetype} not allowed. Allowed types: ${allowedTypes.join(', ')}`
      };
    }
    
    // Check file extension
    const extension = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.includes(extension)) {
      return {
        isValid: false,
        error: `File extension ${extension} not allowed. Allowed extensions: ${allowedExtensions.join(', ')}`
      };
    }
    
    // Check file size
    const maxSize = config.maxFileSize || MAX_FILE_SIZE;
    if (file.size > maxSize) {
      return {
        isValid: false,
        error: `File size ${(file.size / (1024 * 1024)).toFixed(2)}MB exceeds maximum allowed size of ${(maxSize / (1024 * 1024)).toFixed(2)}MB`
      };
    }
    
    return { isValid: true };
  }
  
  // Check for malicious file content patterns
  async scanFileContent(buffer: Buffer): Promise<{ isSafe: boolean; threats?: string[] }> {
    const threats: string[] = [];
    
    // Convert buffer to string for text-based scanning
    const content = buffer.toString('utf8', 0, Math.min(buffer.length, 2048)); // First 2KB
    
    // Look for suspicious patterns that could indicate embedded scripts or malware
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /vbscript:/i,
      /onload\s*=/i,
      /onerror\s*=/i,
      /data:text\/html/i,
      /%3Cscript/i, // URL encoded <script
      /\x00/, // Null bytes
      /<iframe/i,
      /<object/i,
      /<embed/i
    ];
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(content)) {
        threats.push(`Suspicious pattern detected: ${pattern.source}`);
      }
    }
    
    // Check file headers for known malicious signatures
    const header = buffer.slice(0, 10);
    
    // Check for executable file signatures
    const executableSignatures = [
      [0x4D, 0x5A], // PE/EXE
      [0x7F, 0x45, 0x4C, 0x46], // ELF
      [0xCA, 0xFE, 0xBA, 0xBE], // Mach-O
    ];
    
    for (const signature of executableSignatures) {
      if (signature.every((byte, index) => header[index] === byte)) {
        threats.push('Executable file signature detected');
        break;
      }
    }
    
    return {
      isSafe: threats.length === 0,
      threats: threats.length > 0 ? threats : undefined
    };
  }
  
  // Process and sanitize image file
  async processImage(buffer: Buffer, config: FileUploadConfig = {}): Promise<Buffer> {
    try {
      let image = sharp(buffer);
      
      // Get image metadata
      const metadata = await image.metadata();
      
      // Validate image format
      if (!metadata.format || !['jpeg', 'png', 'webp'].includes(metadata.format)) {
        throw new Error('Invalid image format');
      }
      
      // Remove metadata (EXIF, etc.) for privacy
      if (config.stripMetadata !== false) {
        image = image.withMetadata({});
      }
      
      // Resize if specified
      if (config.resizeImage) {
        image = image.resize(config.resizeImage.width, config.resizeImage.height, {
          fit: 'inside',
          withoutEnlargement: true
        });
      }
      
      // Re-encode the image to ensure it's clean
      return await image
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer();
        
    } catch (error) {
      throw new Error(`Image processing failed: ${(error as Error).message}`);
    }
  }
  
  // Create multer configuration with security checks
  createSecureUpload(config: FileUploadConfig = {}) {
    return multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: config.maxFileSize || MAX_FILE_SIZE,
        files: 5, // Maximum 5 files per request
        fields: 10, // Maximum 10 form fields
      },
      fileFilter: (req: Request, file: Express.Multer.File, cb: any) => {
        const validation = this.validateFileType(file, config);
        
        if (!validation.isValid) {
          return cb(new Error(validation.error), false);
        }
        
        cb(null, true);
      }
    });
  }
  
  // Middleware for additional security checks after upload
  createSecurityMiddleware(config: FileUploadConfig = {}) {
    return async (req: any, res: any, next: any) => {
      if (!req.files && !req.file) {
        return next();
      }
      
      const files = req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : [req.file];
      
      try {
        for (const file of files) {
          if (!file || !file.buffer) continue;
          
          // Scan file content for threats
          const scanResult = await this.scanFileContent(file.buffer);
          if (!scanResult.isSafe) {
            return res.status(400).json({
              error: 'File contains potentially malicious content',
              threats: scanResult.threats
            });
          }
          
          // Process image if it's an image file
          if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
            try {
              file.buffer = await this.processImage(file.buffer, config);
              file.size = file.buffer.length;
            } catch (error) {
              return res.status(400).json({
                error: 'Image processing failed',
                details: (error as Error).message
              });
            }
          }
        }
        
        next();
      } catch (error) {
        console.error('File security check failed:', error);
        res.status(500).json({ error: 'File security check failed' });
      }
    };
  }
}

export const fileUploadSecurity = new FileUploadSecurity();

// Pre-configured secure upload middleware for images
export const secureImageUpload = fileUploadSecurity.createSecureUpload({
  maxFileSize: 20 * 1024 * 1024, // 20MB
  allowedTypes: ALLOWED_IMAGE_TYPES,
  allowedExtensions: ALLOWED_EXTENSIONS,
  stripMetadata: true,
  resizeImage: { width: 2048, height: 2048 } // Max resolution
});

// Security middleware to apply after upload
export const imageSecurityCheck = fileUploadSecurity.createSecurityMiddleware({
  stripMetadata: true,
  resizeImage: { width: 2048, height: 2048 }
});