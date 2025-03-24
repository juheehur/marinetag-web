// Vercel 배포를 위한 환경 변수 접근 방식
// 환경 변수에 안전하게 접근합니다

// 웹 환경에서 process.env 접근 문제 해결
const getEnv = (key: string, defaultValue: string = ''): string => {
  if (typeof window !== 'undefined') {
    // 클라이언트 사이드 코드에서는 window.__ENV__ 객체에서 값을 찾습니다
    // @ts-ignore
    return window.__ENV__ && window.__ENV__[key] ? window.__ENV__[key] : defaultValue;
  }
  
  // 서버 사이드나 빌드 시에는 process.env에서 값을 찾습니다
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || defaultValue;
  }
  
  return defaultValue;
};

// Supabase 환경 변수
export const SUPABASE_URL = getEnv('NEXT_PUBLIC_SUPABASE_URL');
export const SUPABASE_ANON_KEY = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

// OpenAI API 키
export const OPENAI_API_KEY = getEnv('NEXT_PUBLIC_OPENAI_API_KEY');

// 환경 변수가 설정되어 있는지 콘솔에 로그
console.log('환경 변수 로드 상태:');
console.log('- SUPABASE_URL 길이:', SUPABASE_URL ? SUPABASE_URL.length : 0);
console.log('- SUPABASE_ANON_KEY 길이:', SUPABASE_ANON_KEY ? SUPABASE_ANON_KEY.length : 0);
console.log('- OPENAI_API_KEY 길이:', OPENAI_API_KEY ? OPENAI_API_KEY.length : 0);

// 앱 관련 상수
export const APP_VERSION = '1.0.0';
export const IS_DEVELOPMENT = getEnv('NODE_ENV') === 'development';

// 참고 메시지: 환경 변수는 .env 파일 또는 Vercel 프로젝트 설정에서 구성해야 합니다.
// Supabase 대시보드 > Project Settings > API에서 필요한 값을 찾을 수 있습니다. 