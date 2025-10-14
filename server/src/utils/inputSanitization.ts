// Input sanitization utilities to prevent XSS and injection attacks

interface SanitizationOptions {
  allowHtml?: boolean;
  maxLength?: number;
  removeEmojis?: boolean;
  allowedTags?: string[];
}

class InputSanitizer {
  
  // Basic XSS prevention - remove or escape dangerous characters
  sanitizeString(input: string, options: SanitizationOptions = {}): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    let sanitized = input;

    // Remove null bytes and control characters
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Trim whitespace
    sanitized = sanitized.trim();

    // Apply length limit
    if (options.maxLength) {
      sanitized = sanitized.substring(0, options.maxLength);
    }

    // Remove emojis if specified
    if (options.removeEmojis) {
      sanitized = sanitized.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
    }

    if (!options.allowHtml) {
      // Escape HTML characters to prevent XSS
      sanitized = sanitized
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    } else {
      // If HTML is allowed, sanitize specific dangerous patterns
      sanitized = this.sanitizeHtml(sanitized, options.allowedTags);
    }

    return sanitized;
  }

  // Sanitize HTML while allowing specific tags
  private sanitizeHtml(input: string, allowedTags: string[] = []): string {
    // Remove script tags and their contents
    input = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    
    // Remove on* event handlers
    input = input.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
    
    // Remove javascript: protocols
    input = input.replace(/javascript:/gi, '');
    
    // Remove data: protocols except for images
    input = input.replace(/data:(?!image)/gi, '');
    
    // Remove style attributes (can contain JavaScript)
    input = input.replace(/\s*style\s*=\s*["'][^"']*["']/gi, '');

    // If specific tags are allowed, remove all others
    if (allowedTags.length > 0) {
      const allowedPattern = allowedTags.join('|');
      const regex = new RegExp(`<(?!\/?(?:${allowedPattern})(?:\s|>))[^>]*>`, 'gi');
      input = input.replace(regex, '');
    }

    return input;
  }

  // Sanitize email to prevent header injection
  sanitizeEmail(email: string): string {
    if (!email || typeof email !== 'string') {
      return '';
    }

    // Remove dangerous characters that could be used for email header injection
    const sanitized = email
      .replace(/[\r\n\t]/g, '')
      .replace(/[<>]/g, '')
      .trim()
      .toLowerCase();

    // Basic email validation pattern
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    
    return emailPattern.test(sanitized) ? sanitized : '';
  }

  // Sanitize file names
  sanitizeFileName(fileName: string): string {
    if (!fileName || typeof fileName !== 'string') {
      return '';
    }

    return fileName
      .replace(/[^\w\s.-]/g, '') // Keep only word chars, spaces, dots, hyphens
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/\.{2,}/g, '.') // Replace multiple dots with single dot
      .substring(0, 255) // Limit length
      .toLowerCase();
  }

  // Sanitize search queries
  sanitizeSearchQuery(query: string): string {
    if (!query || typeof query !== 'string') {
      return '';
    }

    return query
      .replace(/[^\w\s-]/g, '') // Keep only word characters, spaces, and hyphens
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .substring(0, 100); // Reasonable search length limit
  }

  // Sanitize user input for names
  sanitizeName(name: string): string {
    if (!name || typeof name !== 'string') {
      return '';
    }

    return name
      .replace(/[^\p{L}\p{M}\s.-]/gu, '') // Keep Unicode letters, marks, spaces, dots, hyphens
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .substring(0, 100); // Reasonable name length
  }

  // Sanitize color values (for wardrobe items)
  sanitizeColor(color: string): string {
    if (!color || typeof color !== 'string') {
      return '#000000';
    }

    // Remove any non-hex characters
    const cleaned = color.replace(/[^#0-9A-Fa-f]/g, '');
    
    // Ensure it starts with # and has valid length
    if (cleaned.length === 7 && cleaned.startsWith('#')) {
      return cleaned.toLowerCase();
    } else if (cleaned.length === 4 && cleaned.startsWith('#')) {
      // Convert 3-digit hex to 6-digit
      const short = cleaned.substring(1);
      return '#' + short.split('').map(c => c + c).join('').toLowerCase();
    }
    
    return '#000000'; // Default to black if invalid
  }

  // Sanitize JSON data to prevent JSON injection
  sanitizeJsonData(data: any): any {
    if (data === null || data === undefined) {
      return null;
    }

    if (typeof data === 'string') {
      return this.sanitizeString(data, { maxLength: 1000 });
    }

    if (typeof data === 'number') {
      return isNaN(data) || !isFinite(data) ? 0 : data;
    }

    if (typeof data === 'boolean') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.slice(0, 100).map(item => this.sanitizeJsonData(item)); // Limit array size
    }

    if (typeof data === 'object') {
      const sanitized: any = {};
      let propCount = 0;
      
      for (const [key, value] of Object.entries(data)) {
        if (propCount >= 50) break; // Limit object properties
        
        const sanitizedKey = this.sanitizeString(key, { maxLength: 50 });
        if (sanitizedKey) {
          sanitized[sanitizedKey] = this.sanitizeJsonData(value);
          propCount++;
        }
      }
      
      return sanitized;
    }

    return null;
  }

  // Validate and sanitize URL
  sanitizeUrl(url: string): string {
    if (!url || typeof url !== 'string') {
      return '';
    }

    try {
      const parsed = new URL(url);
      
      // Only allow specific protocols
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return '';
      }

      // Prevent local network access
      if (parsed.hostname === 'localhost' || 
          parsed.hostname === '127.0.0.1' || 
          parsed.hostname.includes('192.168.') ||
          parsed.hostname.includes('10.') ||
          parsed.hostname.includes('172.')) {
        return '';
      }

      return parsed.toString();
    } catch {
      return '';
    }
  }
}

export const inputSanitizer = new InputSanitizer();

// Middleware for sanitizing request bodies
export const sanitizeRequestBody = (req: any, res: any, next: any) => {
  if (req.body && typeof req.body === 'object') {
    req.body = inputSanitizer.sanitizeJsonData(req.body);
  }
  next();
};

// Middleware for sanitizing query parameters  
export const sanitizeQueryParams = (req: any, res: any, next: any) => {
  if (req.query && typeof req.query === 'object') {
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') {
        req.query[key] = inputSanitizer.sanitizeString(value, { maxLength: 200 });
      }
    }
  }
  next();
};