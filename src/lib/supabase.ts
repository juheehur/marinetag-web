import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/env';
import { Alert, Platform } from 'react-native';

console.log('Supabase 클라이언트 초기화...');
console.log('URL:', SUPABASE_URL);
console.log('API 키 길이:', SUPABASE_ANON_KEY ? SUPABASE_ANON_KEY.length : 0);

// 공통 헤더 설정 - API 키를 명시적으로 포함
const commonHeaders = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'X-Client-Info': 'marinetag-mobile-app'
};

// 이미지 로딩을 위한 커스텀 fetch 함수
const customFetch = (url: RequestInfo | URL, options: RequestInit = {}) => {
  // URL을 문자열로 변환
  const urlStr = typeof url === 'string' ? url : url.toString();
  
  // 스토리지 URL인 경우에만 타임스탬프 추가
  let modifiedUrl = urlStr;
  if (urlStr.includes('/storage/v1/')) {
    const timestamp = Date.now();
    modifiedUrl = urlStr.includes('?') 
      ? `${urlStr}&_t=${timestamp}` 
      : `${urlStr}?_t=${timestamp}`;
  }
  
  // API 키와 캐시 방지 헤더 추가 - 모든 요청에 API 키 포함
  const headers = {
    ...commonHeaders,
    ...options.headers
  };
  
  // 수정된 옵션으로 fetch 수행
  return fetch(modifiedUrl, {
    ...options,
    headers
  });
};

// Supabase 클라이언트를 최적화된 설정으로 생성
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    // API 키가 항상 헤더에 포함되도록 설정
    headers: commonHeaders,
    // 타임스탬프를 쿼리에 추가하지 않도록 fetch 함수 변경
    fetch: customFetch
  },
  // 타임아웃 시간 증가
  realtime: {
    params: {
      eventsPerSecond: 5
    }
  },
  // DB 스키마 설정
  db: {
    schema: 'public'
  }
});

// API 키가 유효한지 확인
export const ensureSession = async () => {
  try {
    console.log('세션 상태 확인 중...');
    
    // 현재 세션 가져오기
    const { data: sessionData } = await supabase.auth.getSession();
    
    if (sessionData?.session) {
      console.log('로그인된 세션이 있습니다.');
      return true;
    }
    
    console.log('로그인된 세션이 없습니다. API 키만 사용합니다.');
    return false;
  } catch (error) {
    console.error('세션 확인 중 오류 발생:', error);
    return false;
  }
};

// 데이터베이스 테이블 확인 및 필요시 생성
export const ensureTablesExist = async () => {
  try {
    console.log('데이터베이스 테이블 확인 중...');
    
    // fish_photos 테이블 있는지 확인
    // API 키만 사용하고 쿼리 파라미터를 간소화
    const { data, error } = await supabase
      .from('fish_photos')
      .select('id')
      .limit(1);
    
    if (error) {
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        console.warn('fish_photos 테이블이 없습니다.');
        
        // 여기서 테이블 생성 로직을 구현할 수 있지만
        // Supabase에서는 일반적으로 권한이 필요하므로 사용자에게 알림
        Alert.alert(
          '데이터베이스 오류',
          'fish_photos 테이블이 없습니다. 앱 관리자에게 문의하세요.',
          [{ text: '확인', style: 'default' }]
        );
      } else {
        console.error('테이블 확인 중 오류:', error);
      }
      return false;
    }
    
    console.log('fish_photos 테이블이 존재합니다.');
    return true;
  } catch (error) {
    console.error('테이블 확인 중 예외 발생:', error);
    return false;
  }
};

// Supabase 클라이언트 상태 진단
export const diagnoseSupabaseClient = async () => {
  try {
    console.log('Supabase 연결 진단 중...');
    
    // 환경변수 확인
    if (!SUPABASE_URL || SUPABASE_URL.includes('your-supabase-url')) {
      console.error('Supabase URL이 올바르게 설정되지 않았습니다.');
      return false;
    }
    
    if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.length < 20) {
      console.error('Supabase API 키가 올바르게 설정되지 않았습니다.');
      return false;
    }
    
    // 헤더에 API 키 포함 확인 - 개발 디버깅용
    console.log('API 키가 헤더에 포함되어 있는지 확인합니다.');
    console.log('헤더에 API 키 길이:', commonHeaders.apikey ? commonHeaders.apikey.length : 0);
    
    return true;
  } catch (error) {
    console.error('Supabase 진단 중 예외 발생:', error);
    return false;
  }
};

export default supabase; 