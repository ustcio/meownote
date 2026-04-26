import { config } from '@/config';

const STORAGE_PREFIX = config.storage.prefix;

function getFullKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`;
}

function isStorageAvailable(storage: Storage): boolean {
  try {
    const testKey = '__storage_test__';
    storage.setItem(testKey, testKey);
    storage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

function encodeData(data: string): string {
  return btoa(encodeURIComponent(data));
}

function decodeData(data: string): string {
  try {
    return decodeURIComponent(atob(data));
  } catch {
    return data;
  }
}

export const secureStorage = {
  setItem(key: string, value: string, encode: boolean = false): boolean {
    if (!isStorageAvailable(localStorage)) {
      console.warn('[Storage] localStorage not available');
      return false;
    }
    
    try {
      const fullKey = getFullKey(key);
      const dataToStore = encode ? encodeData(value) : value;
      localStorage.setItem(fullKey, dataToStore);
      return true;
    } catch (error) {
      console.error('[Storage] Failed to set item:', error);
      return false;
    }
  },
  
  getItem(key: string, encoded: boolean = false): string | null {
    if (!isStorageAvailable(localStorage)) {
      return null;
    }
    
    try {
      const fullKey = getFullKey(key);
      const data = localStorage.getItem(fullKey);
      if (data === null) return null;
      return encoded ? decodeData(data) : data;
    } catch (error) {
      console.error('[Storage] Failed to get item:', error);
      return null;
    }
  },
  
  removeItem(key: string): boolean {
    if (!isStorageAvailable(localStorage)) {
      return false;
    }
    
    try {
      const fullKey = getFullKey(key);
      localStorage.removeItem(fullKey);
      return true;
    } catch (error) {
      console.error('[Storage] Failed to remove item:', error);
      return false;
    }
  },
  
  clear(): void {
    if (!isStorageAvailable(localStorage)) {
      return;
    }
    
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(STORAGE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.error('[Storage] Failed to clear:', error);
    }
  },
  
  setJSON<T>(key: string, value: T, encode: boolean = false): boolean {
    try {
      return this.setItem(key, JSON.stringify(value), encode);
    } catch {
      return false;
    }
  },
  
  getJSON<T>(key: string, encoded: boolean = false): T | null {
    try {
      const data = this.getItem(key, encoded);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },
};

export const sessionStorage_ = {
  setItem(key: string, value: string): boolean {
    if (!isStorageAvailable(sessionStorage)) {
      return false;
    }
    
    try {
      const fullKey = getFullKey(key);
      sessionStorage.setItem(fullKey, value);
      return true;
    } catch {
      return false;
    }
  },
  
  getItem(key: string): string | null {
    if (!isStorageAvailable(sessionStorage)) {
      return null;
    }
    
    try {
      const fullKey = getFullKey(key);
      return sessionStorage.getItem(fullKey);
    } catch {
      return null;
    }
  },
  
  removeItem(key: string): boolean {
    if (!isStorageAvailable(sessionStorage)) {
      return false;
    }
    
    try {
      const fullKey = getFullKey(key);
      sessionStorage.removeItem(fullKey);
      return true;
    } catch {
      return false;
    }
  },
};

export function getAuthToken(): string | null {
  return secureStorage.getItem(config.auth.tokenKey, true);
}

export function setAuthToken(token: string): boolean {
  return secureStorage.setItem(config.auth.tokenKey, token, true);
}

export function removeAuthToken(): boolean {
  return secureStorage.removeItem(config.auth.tokenKey);
}

export function getUserData<T>(): T | null {
  return secureStorage.getJSON<T>(config.auth.userKey);
}

export function setUserData<T>(data: T): boolean {
  return secureStorage.setJSON(config.auth.userKey, data);
}

export function removeUserData(): boolean {
  return secureStorage.removeItem(config.auth.userKey);
}

export function clearAuth(): void {
  removeAuthToken();
  removeUserData();
  secureStorage.removeItem(config.auth.refreshTokenKey);
}
