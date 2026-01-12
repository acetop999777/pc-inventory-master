export {};

declare global {
  interface Window {
    http: typeof http;
  }

  const http: {
    get(url: string, init?: RequestInit): Promise<Response>;
    post(url: string, body?: any, init?: RequestInit): Promise<Response>;
    put(url: string, body?: any, init?: RequestInit): Promise<Response>;
    del(url: string, init?: RequestInit): Promise<Response>;
  };
}
