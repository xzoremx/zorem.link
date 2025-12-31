declare module 'speakeasy' {
  interface GenerateSecretOptions {
    name?: string;
    issuer?: string;
    length?: number;
  }

  interface GeneratedSecret {
    ascii: string;
    hex: string;
    base32: string;
    otpauth_url?: string;
  }

  interface VerifyOptions {
    secret: string;
    encoding?: 'ascii' | 'hex' | 'base32';
    token: string;
    window?: number;
    step?: number;
    time?: number;
    counter?: number;
  }

  export function generateSecret(options?: GenerateSecretOptions): GeneratedSecret;

  export const totp: {
    verify(options: VerifyOptions): boolean;
  };
}
