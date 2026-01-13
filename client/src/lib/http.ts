import { apiFetch, type ApiFetchInit } from './api';

export const http = {
  get: (url: string, init: ApiFetchInit = {}) =>
    apiFetch(url, { ...init, method: 'GET' }),

  del: (url: string, init: ApiFetchInit = {}) =>
    apiFetch(url, { ...init, method: 'DELETE' }),

  post: (url: string, json?: any, init: ApiFetchInit = {}) =>
    apiFetch(url, { ...init, method: 'POST', json }),

  put: (url: string, json?: any, init: ApiFetchInit = {}) =>
    apiFetch(url, { ...init, method: 'PUT', json }),

  patch: (url: string, json?: any, init: ApiFetchInit = {}) =>
    apiFetch(url, { ...init, method: 'PATCH', json }),
};

export default http;
