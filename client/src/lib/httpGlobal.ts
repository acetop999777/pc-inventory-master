import http from './http';

// 挂到全局：解决你现在 TS 报 “Cannot find name 'http'” 的问题
// 这样老代码里直接 http.get(...) 也能跑，不需要到处加 import
(window as any).http = http;
