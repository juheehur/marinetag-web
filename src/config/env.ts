// Vercel 배포를 위한 환경 변수 접근 방식
// 환경 변수에 안전하게 접근합니다

// Webpack에 의해 환경 변수가 정의됩니다
export const SUPABASE_URL = 
  typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_SUPABASE_URL 
    ? process.env.NEXT_PUBLIC_SUPABASE_URL 
    : '';

export const SUPABASE_ANON_KEY = 
  typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY 
    ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY 
    : '';

export const OPENAI_API_KEY = 
  typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_OPENAI_API_KEY 
    ? process.env.NEXT_PUBLIC_OPENAI_API_KEY 
    : '';

// 환경 변수가 설정되어 있는지 확인
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !OPENAI_API_KEY) {
  console.warn('필수 환경 변수가 설정되지 않았습니다.');
}

export const APP_VERSION = '1.0.0';
export const IS_DEVELOPMENT = 
  typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development';

// 참고 메시지: 환경 변수는 .env 파일 또는 Vercel 프로젝트 설정에서 구성해야 합니다.
// Supabase 대시보드 > Project Settings > API에서 필요한 값을 찾을 수 있습니다. 