// Base64 helper functions
const arrayBufferToBase64 = (buffer) => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const base64ToArrayBuffer = (base64) => {
  const binary_string = atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
};

// Generate a new random AES-GCM key and return as base64 string
export const generateEncryptionKey = async () => {
  const key = await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const exported = await window.crypto.subtle.exportKey('raw', key);
  return arrayBufferToBase64(exported);
};

// Import a base64 string into a CryptoKey
export const importEncryptionKey = async (base64Key) => {
  if (!base64Key) return null;
  try {
    const keyBuffer = base64ToArrayBuffer(base64Key);
    return await window.crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
  } catch (e) {
    console.error('Failed to import key', e);
    return null;
  }
};

// Derive an AES-GCM key from a password
export const deriveKeyFromPassword = async (password, saltString = import.meta.env.VITE_CRYPTO_SALT || 'default-connect-sphere-salt') => {
  if (!password) return null;
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  const salt = enc.encode(saltString);
  return await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

// Encrypt string message
export const encryptMessage = async (message, cryptoKey) => {
  if (!cryptoKey) return message; // fallback if no key
  
  try {
    const enc = new TextEncoder();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    const ciphertextBuffer = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      enc.encode(message)
    );
    
    return JSON.stringify({
      ct: arrayBufferToBase64(ciphertextBuffer),
      iv: arrayBufferToBase64(iv)
    });
  } catch (error) {
    console.error('Encryption failed:', error);
    return message;
  }
};

// Decrypt message
export const decryptMessage = async (encryptedData, cryptoKey) => {
  if (!cryptoKey) return encryptedData; // fallback
  
  try {
    let parsed;
    try {
      parsed = JSON.parse(encryptedData);
      if (!parsed.ct || !parsed.iv) return encryptedData; // not our encrypted format
    } catch (e) {
      return encryptedData; // not JSON, return as is
    }
    
    const ciphertextBuffer = base64ToArrayBuffer(parsed.ct);
    const iv = new Uint8Array(base64ToArrayBuffer(parsed.iv));
    
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      ciphertextBuffer
    );
    
    const dec = new TextDecoder();
    return dec.decode(decryptedBuffer);
  } catch (error) {
    console.error('Decryption failed:', error);
    return '🔒 [Encrypted message - unable to decrypt]';
  }
};
