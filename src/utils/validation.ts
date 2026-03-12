import { config } from '@/config';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface PasswordStrength {
  score: number;
  level: 'weak' | 'medium' | 'strong' | 'very-strong';
  feedback: string[];
}

export const validators = {
  email(value: string): ValidationResult {
    const errors: string[] = [];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!value) {
      errors.push('邮箱不能为空');
    } else if (!emailRegex.test(value)) {
      errors.push('请输入有效的邮箱地址');
    }
    
    return { isValid: errors.length === 0, errors };
  },
  
  username(value: string): ValidationResult {
    const errors: string[] = [];
    const usernameRegex = /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/;
    
    if (!value) {
      errors.push('用户名不能为空');
    } else if (value.length < 3) {
      errors.push('用户名至少需要3个字符');
    } else if (value.length > 20) {
      errors.push('用户名不能超过20个字符');
    } else if (!usernameRegex.test(value)) {
      errors.push('用户名只能包含字母、数字、下划线和中文');
    }
    
    return { isValid: errors.length === 0, errors };
  },
  
  password(value: string): ValidationResult {
    const errors: string[] = [];
    const { minLength, requireUppercase, requireLowercase, requireNumber, requireSpecial, specialChars } = config.password;
    
    if (!value) {
      errors.push('密码不能为空');
    } else {
      if (value.length < minLength) {
        errors.push(`密码至少需要${minLength}个字符`);
      }
      
      if (requireUppercase && !/[A-Z]/.test(value)) {
        errors.push('密码需要包含至少一个大写字母');
      }
      
      if (requireLowercase && !/[a-z]/.test(value)) {
        errors.push('密码需要包含至少一个小写字母');
      }
      
      if (requireNumber && !/[0-9]/.test(value)) {
        errors.push('密码需要包含至少一个数字');
      }
      
      if (requireSpecial) {
        const hasSpecial = [...specialChars].some(char => value.includes(char));
        if (!hasSpecial) {
          errors.push('密码需要包含至少一个特殊字符');
        }
      }
    }
    
    return { isValid: errors.length === 0, errors };
  },
  
  passwordStrength(value: string): PasswordStrength {
    const feedback: string[] = [];
    let score = 0;
    
    if (value.length >= 8) score += 1;
    if (value.length >= 12) score += 1;
    if (value.length >= 16) score += 1;
    if (/[A-Z]/.test(value)) score += 1;
    if (/[a-z]/.test(value)) score += 1;
    if (/[0-9]/.test(value)) score += 1;
    if (/[^A-Za-z0-9]/.test(value)) score += 1;
    if (/(.)\1{2,}/.test(value)) score -= 1;
    
    if (value.length < 8) feedback.push('增加密码长度');
    if (!/[A-Z]/.test(value)) feedback.push('添加大写字母');
    if (!/[a-z]/.test(value)) feedback.push('添加小写字母');
    if (!/[0-9]/.test(value)) feedback.push('添加数字');
    if (!/[^A-Za-z0-9]/.test(value)) feedback.push('添加特殊字符');
    
    let level: PasswordStrength['level'];
    if (score <= 2) {
      level = 'weak';
    } else if (score <= 4) {
      level = 'medium';
    } else if (score <= 6) {
      level = 'strong';
    } else {
      level = 'very-strong';
    }
    
    return { score, level, feedback };
  },
  
  confirmPassword(password: string, confirm: string): ValidationResult {
    const errors: string[] = [];
    
    if (!confirm) {
      errors.push('请确认密码');
    } else if (password !== confirm) {
      errors.push('两次输入的密码不一致');
    }
    
    return { isValid: errors.length === 0, errors };
  },
  
  phone(value: string): ValidationResult {
    const errors: string[] = [];
    const phoneRegex = /^1[3-9]\d{9}$/;
    
    if (!value) {
      errors.push('手机号不能为空');
    } else if (!phoneRegex.test(value)) {
      errors.push('请输入有效的手机号');
    }
    
    return { isValid: errors.length === 0, errors };
  },
  
  url(value: string): ValidationResult {
    const errors: string[] = [];
    
    try {
      if (!value) {
        errors.push('URL不能为空');
      } else {
        new URL(value);
      }
    } catch {
      errors.push('请输入有效的URL');
    }
    
    return { isValid: errors.length === 0, errors };
  },
  
  required(value: string | null | undefined, fieldName: string = '此字段'): ValidationResult {
    const errors: string[] = [];
    
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      errors.push(`${fieldName}不能为空`);
    }
    
    return { isValid: errors.length === 0, errors };
  },
  
  minLength(value: string, min: number, fieldName: string = '输入'): ValidationResult {
    const errors: string[] = [];
    
    if (value.length < min) {
      errors.push(`${fieldName}至少需要${min}个字符`);
    }
    
    return { isValid: errors.length === 0, errors };
  },
  
  maxLength(value: string, max: number, fieldName: string = '输入'): ValidationResult {
    const errors: string[] = [];
    
    if (value.length > max) {
      errors.push(`${fieldName}不能超过${max}个字符`);
    }
    
    return { isValid: errors.length === 0, errors };
  },
  
  range(value: number, min: number, max: number, fieldName: string = '值'): ValidationResult {
    const errors: string[] = [];
    
    if (value < min || value > max) {
      errors.push(`${fieldName}必须在${min}到${max}之间`);
    }
    
    return { isValid: errors.length === 0, errors };
  },
};

export function validateForm(
  fields: Record<string, { value: string; validators: Array<(value: string) => ValidationResult> }>
): { isValid: boolean; errors: Record<string, string[]> } {
  const errors: Record<string, string[]> = {};
  let isValid = true;
  
  for (const [fieldName, { value, validators: fieldValidators }] of Object.entries(fields)) {
    const fieldErrors: string[] = [];
    
    for (const validator of fieldValidators) {
      const result = validator(value);
      if (!result.isValid) {
        fieldErrors.push(...result.errors);
        isValid = false;
      }
    }
    
    if (fieldErrors.length > 0) {
      errors[fieldName] = fieldErrors;
    }
  }
  
  return { isValid, errors };
}
