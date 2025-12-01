import axios from 'axios';

// 환경변수에서 API URL 읽기 (Vite 빌드 시 치환됨)
// 프로덕션: Railway 백엔드 URL
// 개발: localhost:8000
const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const api = axios.create({
    baseURL: API_URL,
});

export default api;
