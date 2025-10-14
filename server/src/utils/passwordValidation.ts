interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'fair' | 'good' | 'strong';
}

export const validatePassword = (password: string): PasswordValidationResult => {
  const errors: string[] = [];
  let strength: PasswordValidationResult['strength'] = 'weak';

  // Length requirements
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  } else if (password.length < 12) {
    // Fair if meets basic length
  } else {
    // Good if longer
  }

  // Character requirements
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  if (!hasLowercase) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!hasUppercase) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!hasNumbers) {
    errors.push('Password must contain at least one number');
  }
  if (!hasSpecialChars) {
    errors.push('Password must contain at least one special character');
  }

  // Common patterns to avoid
  const commonPatterns = [
    /(.)\1{3,}/, // Repeated characters (4 or more)
    /123456/,
    /password/i,
    /qwerty/i,
    /abc/i
  ];

  for (const pattern of commonPatterns) {
    if (pattern.test(password)) {
      errors.push('Password contains common patterns that are easily guessed');
      break;
    }
  }

  // Sequential characters
  if (/012|123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz/i.test(password)) {
    errors.push('Password should not contain sequential characters');
  }

  // Calculate strength based on criteria met
  const criteriaScore = [hasLowercase, hasUppercase, hasNumbers, hasSpecialChars].filter(Boolean).length;
  const lengthScore = password.length >= 12 ? 2 : password.length >= 8 ? 1 : 0;
  const totalScore = criteriaScore + lengthScore;

  if (errors.length === 0) {
    if (totalScore >= 6) strength = 'strong';
    else if (totalScore >= 4) strength = 'good';
    else if (totalScore >= 3) strength = 'fair';
  }

  return {
    isValid: errors.length === 0,
    errors,
    strength
  };
};

export const generatePasswordRequirements = (): string[] => {
  return [
    'At least 8 characters long (12+ recommended)',
    'At least one lowercase letter (a-z)',
    'At least one uppercase letter (A-Z)',
    'At least one number (0-9)',
    'At least one special character (!@#$%^&*)',
    'No common patterns or sequential characters',
    'Not a commonly used password'
  ];
};