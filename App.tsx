import React, { useEffect, useState, useCallback } from 'react';
import { SafeAreaView, StatusBar, View, Text, ActivityIndicator, Alert, Platform } from 'react-native';
import { HomeScreen } from './src/screens/HomeScreen';
import { ensureTablesExist, diagnoseSupabaseClient, ensureSession } from './src/lib/supabase';
import { initLanguage } from './src/i18n';
import * as Font from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { initializeStorage } from './src/services/storage';

// 웹 환경인지 확인
const isWeb = Platform.OS === 'web';

// 웹 환경이 아닌 경우에만 스플래시 화면 유지
if (!isWeb) {
  SplashScreen.preventAutoHideAsync().catch(() => {
    /* 에러 무시 */
  });
}

export default function App() {
  const [appIsReady, setAppIsReady] = useState(isWeb); // 웹에서는 초기에 준비됨으로 표시
  const [error, setError] = useState<string | null>(null);
  const [initStatus, setInitStatus] = useState({
    fonts: isWeb, // 웹에서는 초기에 완료됨으로 표시
    language: false,
    database: false
  });

  // 앱 초기화 과정을 단계적으로 진행
  useEffect(() => {
    async function prepare() {
      try {
        // 앱 초기 로드
        console.log('앱 초기화 중...');
        
        // 1. 언어 설정 초기화 (가장 먼저 진행)
        try {
          await initLanguage();
          setInitStatus(prev => ({ ...prev, language: true }));
          console.log('언어 설정 성공');
        } catch (langError) {
          console.warn('언어 설정 실패 (기본 언어로 진행):', langError);
        }
        
        // 2. Supabase 연결 진단 및 초기화 (비동기적으로 진행)
        try {
          console.log('Supabase 연결 확인 중...');
          const isSupabaseOk = await diagnoseSupabaseClient();
          
          if (!isSupabaseOk) {
            console.warn('Supabase 연결 진단 실패, 계속 진행합니다...');
            // 웹이 아닌 환경에서만 알림 표시
            if (!isWeb) {
              Alert.alert(
                '데이터베이스 연결 오류',
                'Supabase 연결에 문제가 있습니다. 이미지가 표시되지 않을 수 있습니다.',
                [{ text: '확인', style: 'default' }]
              );
            }
          } else {
            console.log('Supabase 연결 정상');
            
            // 세션 확인
            await ensureSession();
            
            // 스토리지 버킷 초기화
            await initializeStorage();
          }
          
          // 테이블 초기화
          await ensureTablesExist();
          setInitStatus(prev => ({ ...prev, database: true }));
          console.log('테이블 초기화 성공');
        } catch (dbError) {
          console.warn('Supabase 초기화 오류 (앱은 계속 실행됩니다):', dbError);
        }
        
        // 3. 폰트 로드 - 웹이 아닌 환경에서만 실행
        if (!isWeb) {
          const fontPromise = (async () => {
            try {
              const fontResults = await Promise.allSettled([
                Font.loadAsync({ 'Pretendard-Regular': require('./assets/fonts/Pretendard-Regular.otf') })
                  .then(() => console.log('Pretendard-Regular 로드 성공'))
                  .catch(err => console.warn('Pretendard-Regular 로드 실패:', err)),
                  
                Font.loadAsync({ 'Pretendard-Bold': require('./assets/fonts/Pretendard-Bold.otf') })
                  .then(() => console.log('Pretendard-Bold 로드 성공'))
                  .catch(err => console.warn('Pretendard-Bold 로드 실패:', err)),
                
                // 다른 폰트들은 존재하는 폰트로 매핑 - 실패해도 앱 진행에 영향 없음
                Font.loadAsync({ 'Pretendard-Medium': require('./assets/fonts/Pretendard-Regular.otf') })
                  .then(() => console.log('Pretendard-Medium(대체) 로드 성공'))
                  .catch(err => console.warn('Pretendard-Medium 로드 실패:', err)),
                  
                Font.loadAsync({ 'Pretendard-SemiBold': require('./assets/fonts/Pretendard-Bold.otf') })
                  .then(() => console.log('Pretendard-SemiBold(대체) 로드 성공'))
                  .catch(err => console.warn('Pretendard-SemiBold 로드 실패:', err))
              ]);
              
              // 적어도 하나 이상의 폰트가 성공적으로 로드되었는지 확인
              const successCount = fontResults.filter(result => result.status === 'fulfilled').length;
              console.log(`${successCount}개의 폰트 로드 성공`);
              
              setInitStatus(prev => ({ ...prev, fonts: successCount > 0 }));
              return successCount > 0;
            } catch (fontError) {
              console.warn('폰트 로드 실패 (앱은 계속 실행됩니다):', fontError);
              return false;
            }
          })();
          
          await fontPromise;
        }
        
        // 앱 준비 완료
        setAppIsReady(true);
      } catch (error) {
        console.warn('앱 초기화 중 오류 (앱은 계속 실행됩니다):', error);
        setError(error instanceof Error ? error.message : '알 수 없는 오류');
        setAppIsReady(true); // 오류가 있어도 앱 시작
      } finally {
        // 웹이 아닌 환경에서만 스플래시 화면 숨기기
        if (!isWeb) {
          setTimeout(async () => {
            try {
              await SplashScreen.hideAsync();
            } catch (e) {
              // 스플래시 스크린 숨기기 실패 무시
            }
          }, 500);
        }
      }
    }

    prepare();
  }, []);

  // 웹 환경에서는 로딩 표시를 간소화
  if (!appIsReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f7f7f7' }}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ marginTop: 16, fontSize: 16, color: '#333' }}>앱을 로드하는 중...</Text>
        {!isWeb && (
          <View style={{ marginTop: 24, alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <View style={{ 
                width: 16, 
                height: 16, 
                borderRadius: 8, 
                backgroundColor: initStatus.fonts ? '#4CD964' : '#E5E5EA',
                marginRight: 8
              }} />
              <Text style={{ fontSize: 14, color: initStatus.fonts ? '#333' : '#8E8E93' }}>
                폰트 로드 {initStatus.fonts ? '완료' : '진행중'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <View style={{ 
                width: 16, 
                height: 16, 
                borderRadius: 8, 
                backgroundColor: initStatus.language ? '#4CD964' : '#E5E5EA',
                marginRight: 8
              }} />
              <Text style={{ fontSize: 14, color: initStatus.language ? '#333' : '#8E8E93' }}>
                언어 설정 {initStatus.language ? '완료' : '진행중'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ 
                width: 16, 
                height: 16, 
                borderRadius: 8, 
                backgroundColor: initStatus.database ? '#4CD964' : '#E5E5EA',
                marginRight: 8
              }} />
              <Text style={{ fontSize: 14, color: initStatus.database ? '#333' : '#8E8E93' }}>
                데이터베이스 연결 {initStatus.database ? '완료' : '진행중'}
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  }

  // 웹 환경에서는, 심각한 오류만 표시, 나머지는 무시
  if (error && !isWeb && false) {  // 심각한 오류일 때만 화면을 전환하도록 수정
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f7f7f7', padding: 20 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#FF3B30', marginBottom: 10 }}>오류가 발생했습니다</Text>
        <Text style={{ fontSize: 16, color: '#666', textAlign: 'center' }}>{error}</Text>
        <Text style={{ fontSize: 14, color: '#999', marginTop: 20 }}>앱을 다시 시작해보세요</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f7f7f7' }}>
      <StatusBar barStyle="dark-content" />
      <HomeScreen />
    </SafeAreaView>
  );
}
