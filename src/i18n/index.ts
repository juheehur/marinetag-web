import { I18n } from 'i18n-js';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

// 번역 파일 임포트
import ko from './translations/ko';
import en from './translations/en';
import zh from './translations/zh';

// i18n 인스턴스 생성
const i18n = new I18n({
  en,
  ko,
  zh,
});

// 기본 언어 설정
i18n.defaultLocale = 'en';
i18n.enableFallback = true;

// 언어 저장 키
const LANGUAGE_KEY = 'user_language';

// 초기 언어 설정 함수
export const initLanguage = async () => {
  try {
    // 저장된 언어 가져오기
    const savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
    
    if (savedLanguage) {
      // 저장된 언어가 있다면 해당 언어 사용
      i18n.locale = savedLanguage;
    } else {
      // 없다면 시스템 언어 감지
      const deviceLocale = Localization.locale.split('-')[0]; // 'ko-KR' -> 'ko'
      
      // 지원하는 언어인지 확인 (영어, 한국어, 중국어)
      if (['en', 'ko', 'zh'].includes(deviceLocale)) {
        i18n.locale = deviceLocale;
      } else {
        // 지원하지 않는 언어는 영어로 기본 설정
        i18n.locale = 'en';
      }
      
      // 언어 설정 저장
      await AsyncStorage.setItem(LANGUAGE_KEY, i18n.locale);
    }
    
    return i18n.locale;
  } catch (error) {
    console.error('언어 초기화 오류:', error);
    // 오류 발생 시 영어로 기본 설정
    i18n.locale = 'en';
    return 'en';
  }
};

// 언어 변경 함수
export const changeLanguage = async (locale: string) => {
  try {
    i18n.locale = locale;
    await AsyncStorage.setItem(LANGUAGE_KEY, locale);
    return true;
  } catch (error) {
    console.error('언어 변경 오류:', error);
    return false;
  }
};

// 현재 언어 가져오기
export const getCurrentLanguage = () => i18n.locale;

// 번역 함수
export const t = (key: string, options = {}) => {
  return i18n.t(key, options);
};

// React Hook
export const useTranslation = () => {
  const [locale, setLocale] = useState(i18n.locale);
  
  useEffect(() => {
    initLanguage().then(setLocale);
  }, []);
  
  const translate = (key: string, options = {}) => {
    return i18n.t(key, options);
  };
  
  const changeLocale = async (newLocale: string) => {
    const result = await changeLanguage(newLocale);
    if (result) {
      setLocale(newLocale);
    }
    return result;
  };
  
  return {
    t: translate,
    locale,
    changeLocale,
    supportedLocales: ['en', 'ko', 'zh']
  };
};

// 기본 모듈로 내보내기
export default i18n; 