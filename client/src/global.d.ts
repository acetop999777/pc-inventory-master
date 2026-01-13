export {};

declare global {
  const http: {
    get: (url: string, init?: RequestInit) => Promise<Response>;
    del: (url: string, init?: RequestInit) => Promise<Response>;
    post: (url: string, body?: any, init?: RequestInit) => Promise<Response>;
    put: (url: string, body?: any, init?: RequestInit) => Promise<Response>;
    patch: (url: string, body?: any, init?: RequestInit) => Promise<Response>;
  };

  interface Window {
    http: typeof http;
  }
}
