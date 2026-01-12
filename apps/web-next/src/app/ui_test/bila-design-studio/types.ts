
export interface Project {
  id: string;
  title: string;
  category: string;
  colors: string[];
}

export interface Service {
  id: string;
  title: string;
  description: string;
  tags: string[];
}

export interface CookieConsent {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
}
