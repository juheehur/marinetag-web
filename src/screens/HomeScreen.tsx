import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  Image, 
  TouchableOpacity, 
  RefreshControl, 
  StatusBar, 
  SafeAreaView,
  Dimensions,
  Animated,
  Modal,
  FlatList,
  Platform,
  Alert,
  Pressable,
  ActivityIndicator,
  Easing,
  TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as MediaLibrary from 'expo-media-library';
import { FishAnalysis } from '../services/vision';
import { getFishPhotos, FishPhoto, uploadImageToBucket, getAllFishImages, getFishImages, shareFishToGallery } from '../services/storage';
import { useTranslation } from '../i18n';
import { SettingsScreen } from './SettingsScreen';
import { analyzeFishImage } from '../services/vision';
import { SUPABASE_ANON_KEY } from '../config/env';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

// AsyncStorage에 사용할 상수 정의
const SHARED_FISH_IDS_KEY = 'shared_fish_ids';

export const HomeScreen: React.FC = () => {
  const { t } = useTranslation();
  const [showSettings, setShowSettings] = useState(false);
  const [photos, setPhotos] = useState<FishPhoto[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showAllPhotos, setShowAllPhotos] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<FishAnalysis | null>(null);
  const [lastPhoto, setLastPhoto] = useState<string | null>(null);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [permissionRequested, setPermissionRequested] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [galleryPhotos, setGalleryPhotos] = useState<FishPhoto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showFishDetail, setShowFishDetail] = useState(false);
  const [selectedFish, setSelectedFish] = useState<FishPhoto | null>(null);
  
  // 검색 및 정렬 기능 추가
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [sortOrder, setSortOrder] = useState<'date' | 'name'>('date');
  
  // 애니메이션 값 추가
  const spinValue = useRef(new Animated.Value(0)).current;
  const pulseValue = useRef(new Animated.Value(1)).current;
  
  // 갤러리 모드 (개인/공유)
  const [galleryMode, setGalleryMode] = useState<'personal' | 'shared'>('personal');
  const [sharedPhotos, setSharedPhotos] = useState<any[]>([]);
  
  // 공유된 물고기 ID 관리를 위한 상태 추가
  const [sharedFishIds, setSharedFishIds] = useState<Record<string, boolean>>({});
  
  // 회전 애니메이션 함수
  useEffect(() => {
    if (isAnalyzing || isLoading || isUploading) {
      // 회전 애니메이션
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1200,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
      
      // 펄스 애니메이션
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseValue, {
            toValue: 1.2,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseValue, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          })
        ])
      ).start();
    } else {
      // 애니메이션 정지
      spinValue.stopAnimation();
      pulseValue.stopAnimation();
    }
  }, [isAnalyzing, isLoading, isUploading, spinValue, pulseValue]);
  
  // 회전 애니메이션 회전 각도로 변환
  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  const loadPhotos = async () => {
    try {
      setRefreshing(true);

      const fishPhotos = await getFishPhotos();
      setPhotos(fishPhotos);
      setRefreshing(false);
    } catch (error) {
      setRefreshing(false);
    }
  };

  // 앱 시작시 권한 확인
  useEffect(() => {
    checkPermissions();
  }, []);

  useEffect(() => {
    const loadInitialData = async () => {
      await loadPhotos();
      // 권한 요청
      const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
      if (locationStatus === 'granted') {
        try {
          const location = await Location.getCurrentPositionAsync({});
          setLocation(location.coords);
        } catch (error) {
          console.warn('위치 정보 가져오기 실패:', error);
        }
      }
    };
    
    loadInitialData();
  }, []);

  // 권한 체크 및 요청 함수
  const checkPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
      const { status: mediaStatus } = await MediaLibrary.requestPermissionsAsync();
      const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
      
      const allGranted = cameraStatus === 'granted' && mediaStatus === 'granted' && locationStatus === 'granted';
      setHasPermissions(allGranted);
      setPermissionRequested(true);
      
      if (!allGranted) {
        alert(t('permissions.required'));
      }
    } else {
      setHasPermissions(true);
      setPermissionRequested(true);
    }
  };
  
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPhotos();
    setRefreshing(false);
  };

  const getCurrentLocation = async () => {
    try {
      // 사용자에게 명시적으로 위치 정보 수집 동의 확인
      return new Promise<{ latitude: number; longitude: number } | null>((resolve) => {
        Alert.alert(
          t('location.permission'),
          t('location.confirmUse'),
          [
            {
              text: t('common.cancel'),
              onPress: () => resolve(null),
              style: 'cancel'
            },
            {
              text: t('common.save'),
              onPress: async () => {
                try {
                  const location = await Location.getCurrentPositionAsync({});
                  resolve({
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude
                  });
                } catch (error) {
                  console.error(t('location.permission'), error);
                  resolve(null);
                }
              }
            }
          ],
          { cancelable: false }
        );
      });
    } catch (error) {
      console.error(t('location.permission'), error);
      return null;
    }
  };

  const handleCapture = async () => {
    try {
      setIsAnalyzing(true);
      setLastAnalysis(null);
      setLastPhoto(null);
      
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const capturedImage = result.assets[0].uri;
        setLastPhoto(capturedImage);
        
        // 위치 정보 가져오기 (병렬 실행)
        const locationPromise = getCurrentLocation();
        
        // 이미지 분석 시작
        const analysis = await analyzeFishImage(capturedImage);
        setIsAnalyzing(false);
        setLastAnalysis(analysis);
        
        // 위치 정보 가져오기 완료 대기
        const location = await locationPromise;
        
        // 이미지 업로드 진행
        if (analysis.isFish) {
          setIsUploading(true);
          const uploadedPhoto = await uploadImageToBucket(
            capturedImage,
            analysis.species || t('fish.unknown'),
            location || undefined,
            {
              confidence: analysis.confidence,
              description: analysis.description || ''
            }
          );
          setIsUploading(false);
          
          // 업로드가 성공하면 즉시 갤러리 새로고침
          if (uploadedPhoto) {
            // 약간의 지연 후 새로고침 (Supabase에 데이터가 저장되는 시간 고려)
            setTimeout(() => {
              loadFishPhotos();
            }, 1000);
          }
        } else {
          // 물고기가 아니라도 갤러리는 새로고침
          loadFishPhotos();
        }
      } else {
        setIsAnalyzing(false);
      }
    } catch (error) {
      setIsAnalyzing(false);
      setIsUploading(false);
      Alert.alert('오류', '이미지 처리 중 오류가 발생했습니다.');
    }
  };
  
  const handleSettingsBack = () => {
    setShowSettings(false);
  };

  // 이미지 오류 처리 함수
  const handleImageError = useCallback((photoId: string) => {
    setImageErrors(prev => ({ ...prev, [photoId]: true }));
  }, []);

  // 이미지 URL에 캐시 무효화 파라미터 추가 함수
  const getImageUrlWithCacheBuster = useCallback((url: string): string => {
    if (!url) return '';
    // 현재 시간을 밀리초로 추가하여 캐시 방지
    const cacheBuster = `t=${Date.now()}`;
    // URL에 이미 파라미터가 있는지 확인
    return url.includes('?') ? `${url}&${cacheBuster}` : `${url}?${cacheBuster}`;
  }, []);

  // 대체 이미지 URL 가져오기
  const getFallbackImageUrl = useCallback(() => {
    const fallbackImages = [
      'https://images.pexels.com/photos/128756/pexels-photo-128756.jpeg?auto=compress&cs=tinysrgb&w=600',
      'https://images.pexels.com/photos/213399/pexels-photo-213399.jpeg?auto=compress&cs=tinysrgb&w=600',
      'https://images.pexels.com/photos/1145274/pexels-photo-1145274.jpeg?auto=compress&cs=tinysrgb&w=600'
    ];
    return fallbackImages[Math.floor(Math.random() * fallbackImages.length)];
  }, []);

  // 이미지 URL 검증
  const validateImageUrl = useCallback((url: string | undefined): boolean => {
    if (!url) return false;
    
    // URL이 비어있지 않고 형식이 올바른지 확인
    try {
      // URL이 유효한지 확인
      return url.startsWith('http://') || url.startsWith('https://');
    } catch (error) {
      console.error('URL 검증 오류:', error);
      return false;
    }
  }, []);

  // 안전한 이미지 URL 반환
  const getSafeImageUrl = useCallback((photo: FishPhoto): string => {
    try {
      // 이미 오류가 있는 이미지인 경우
      if (imageErrors[photo.id]) {
        return getFallbackImageUrl();
      }
      
      // URL이 없거나 유효하지 않은 경우
      if (!photo.url || !validateImageUrl(photo.url)) {
        return getFallbackImageUrl();
      }
      
      // 유효한 URL에 캐시 방지 파라미터 추가
      const urlWithCache = getImageUrlWithCacheBuster(photo.url);
      return urlWithCache;
    } catch (error) {
      return getFallbackImageUrl();
    }
  }, [imageErrors, validateImageUrl, getFallbackImageUrl, getImageUrlWithCacheBuster]);

  // 물고기 사진 로드
  const loadFishPhotos = useCallback(async () => {
    setIsLoading(true);
    try {
      const photos = await getFishPhotos();

      if (photos.length > 0) {
        // URL이 유효한지 검사
        const validPhotos = photos.filter(photo => validateImageUrl(photo.url));
        
        // 두 상태 모두 동일한 데이터로 업데이트
        setGalleryPhotos(photos);
        setPhotos(photos); // photos 상태도 함께 업데이트
      } else {
        setGalleryPhotos([]);
        setPhotos([]); // photos 상태도 함께 업데이트
      }
    } catch (error) {
      Alert.alert('오류', '사진을 불러오는 중 오류가 발생했습니다.');
      setGalleryPhotos([]);
      setPhotos([]); // photos 상태도 함께 업데이트
    } finally {
      setIsLoading(false);
    }
  }, [validateImageUrl]);

  // 자동 새로고침을 위한 타이머 추가
  useEffect(() => {
    // 앱이 시작될 때 데이터 로드
    loadFishPhotos();
    
    // 주기적으로 사진 목록 새로고침 (30초마다)
    const refreshInterval = setInterval(() => {
      loadFishPhotos();
    }, 30000); // 30초마다 갱신
    
    // 컴포넌트 언마운트 시 타이머 정리
    return () => clearInterval(refreshInterval);
  }, [loadFishPhotos]);

  // 최근 찍은 물고기 사진 분석 데이터 가져오기
  const getLatestFishData = useCallback(() => {
    if (!photos || photos.length === 0) {

      return null;
    }
    
    // 가장 최근 찍은 물고기 사진
    const latestPhoto = photos[0];
    console.log('최근 사진 데이터:', latestPhoto);
    
    // 데이터가 누락된 경우 기본값을 반환
    return {
      ...latestPhoto,
      environmental_data: latestPhoto.environmental_data || {},
      morphological_data: latestPhoto.morphological_data || {}
    };
  }, [photos]);

  // 물고기 클릭 핸들러 함수
  const handleFishPress = (photo: FishPhoto) => {
    setSelectedFish(photo);
    setShowFishDetail(true);
    console.log('사진 상세 보기:', photo.id);
  };

  // 검색 필터링 기능
  const getFilteredPhotos = useCallback(() => {
    if (!searchQuery) return galleryPhotos;
    
    return galleryPhotos.filter(photo => {
      const species = photo.species?.toLowerCase() || '';
      const query = searchQuery.toLowerCase();
      return species.includes(query);
    });
  }, [galleryPhotos, searchQuery]);
  
  // 정렬 기능
  const getSortedPhotos = useCallback(() => {
    const filteredPhotos = getFilteredPhotos();
    
    if (sortOrder === 'name') {
      return [...filteredPhotos].sort((a, b) => {
        const nameA = a.species?.toLowerCase() || '';
        const nameB = b.species?.toLowerCase() || '';
        return nameA.localeCompare(nameB);
      });
    } else {
      return [...filteredPhotos].sort((a, b) => {
        const dateA = a.captured_at ? new Date(a.captured_at).getTime() : 0;
        const dateB = b.captured_at ? new Date(b.captured_at).getTime() : 0;
        return dateB - dateA; // 최신순 정렬
      });
    }
  }, [getFilteredPhotos, sortOrder]);
  
  // 정렬 순서 토글
  const toggleSortOrder = useCallback(() => {
    setSortOrder(prev => prev === 'date' ? 'name' : 'date');
  }, []);

  // 개인/공유 갤러리 전환
  const toggleGalleryMode = useCallback(() => {
    setGalleryMode(prev => prev === 'personal' ? 'shared' : 'personal');
  }, []);

  // 공유 갤러리 로드
  const loadSharedGallery = useCallback(async () => {
    setIsLoading(true);
    try {
      const sharedImages = await getAllFishImages();
      setSharedPhotos(sharedImages);
    } catch (error) {
      console.error('공유 갤러리 로드 오류:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 갤러리 모드가 변경될 때마다 적절한 데이터 로드
  useEffect(() => {
    if (galleryMode === 'shared' && showAllPhotos) {
      loadSharedGallery();
    } else if (galleryMode === 'personal' && showAllPhotos) {
      loadFishPhotos();
    }
  }, [galleryMode, showAllPhotos, loadSharedGallery, loadFishPhotos]);

  // 개선된 그리드 레이아웃 - 개인/공유 갤러리 분기 처리
  const getGalleryData = useCallback(() => {
    if (galleryMode === 'shared') {
      if (!searchQuery) return sharedPhotos;
      
      return sharedPhotos.filter(photo => {
        const name = photo.name?.toLowerCase() || '';
        const query = searchQuery.toLowerCase();
        return name.includes(query);
      });
    } else {
      return getSortedPhotos(); // 기존 개인 갤러리 데이터
    }
  }, [galleryMode, sharedPhotos, searchQuery, getSortedPhotos]);

  const [isSharing, setIsSharing] = useState(false);
  
  // 공유된 물고기 ID 로드
  const loadSharedFishIds = async () => {
    try {
      const storedIds = await AsyncStorage.getItem(SHARED_FISH_IDS_KEY);
      if (storedIds) {
        setSharedFishIds(JSON.parse(storedIds));
      }
    } catch (error) {
      console.error('공유된 물고기 ID 로드 오류:', error);
    }
  };

  // 공유된 물고기 ID 저장
  const saveSharedFishIds = async (ids: Record<string, boolean>) => {
    try {
      await AsyncStorage.setItem(SHARED_FISH_IDS_KEY, JSON.stringify(ids));
    } catch (error) {
      console.error('공유된 물고기 ID 저장 오류:', error);
    }
  };

  // 초기 로딩 시 공유 ID 불러오기
  useEffect(() => {
    loadSharedFishIds();
  }, []);
  
  // 물고기 공유 함수
  const handleShareFish = async (fish: FishPhoto) => {
    try {
      // 이미 공유된 물고기인지 확인
      if (sharedFishIds[fish.id]) {
        Alert.alert(
          t('common.shareAlreadyShared'),
          t('common.shareAlreadySharedMessage'),
          [{ text: t('common.save') }]
        );
        return;
      }
      
      setIsSharing(true);
      
      console.log('물고기 공유 시작:', fish.id, fish.species);
      console.log('이미지 URL:', fish.url);
      
      // 공유 갤러리에 물고기 공유
      const shareResult = await shareFishToGallery(fish);
      
      setIsSharing(false);
      
      if (shareResult) {
        // 공유 성공 시 공유된 물고기 ID 저장
        const updatedIds = {
          ...sharedFishIds,
          [fish.id]: true
        };
        setSharedFishIds(updatedIds);
        saveSharedFishIds(updatedIds);
        
        Alert.alert(
          t('common.shareSuccess'),
          t('common.shareSuccessMessage'),
          [{ text: t('common.save'), onPress: () => loadSharedGallery() }]
        );
      } else {
        Alert.alert(
          t('common.shareFailed'),
          t('common.shareFailedMessage'),
          [
            { 
              text: '자세한 오류 보기', 
              onPress: () => console.log('Supabase에서 버킷을 확인하세요: https://supabase.com/dashboard') 
            },
            { text: t('common.cancel') }
          ]
        );
      }
    } catch (error) {
      console.error('물고기 공유 오류:', error);
      setIsSharing(false);
      Alert.alert(
        t('common.shareFailed'),
        t('common.shareFailedMessage') + '\n\n오류: ' + (error instanceof Error ? error.message : String(error)),
        [{ text: t('common.cancel') }]
      );
    }
  };

  // 갤러리 아이템 렌더 함수 추가
  const renderGalleryItem = useCallback((item: any, isGalleryView = false) => {
    // 물고기 ID 추출 및 공유 여부 확인
    const fishId = item.id;
    const isShared = sharedFishIds[fishId];
    
    return (
      <Pressable 
        style={styles.photoCard}
        onPress={() => {
          if (galleryMode === 'personal') {
            handleFishPress(item);
          } else {
            // 공유 갤러리 아이템 클릭 시 이미지만 크게 보기
            const sharedFishPhoto: FishPhoto = {
              id: item.uri,
              url: item.uri,
              species: extractSpeciesFromFileName(item.name) || t('fish.unknown'),
              captured_at: item.createdAt,
              environmental_data: {
                season: t('marineData.noInfo'),
                weather: t('marineData.noInfo'),
                time_of_day: t('marineData.noInfo'),
                habitat_type: t('marineData.noInfo')
              }
            };
            setSelectedFish(sharedFishPhoto);
            setShowFishDetail(true);
          }
        }}
      >
        {isLoading ? (
          <View style={styles.photoCardLoading}>
            <ActivityIndicator size="small" color="#007AFF" />
          </View>
        ) : (
          <View style={[styles.galleryImageContainer, styles.photoCardImageContainer]}>
            <Image
              source={{ 
                uri: galleryMode === 'personal' ? getSafeImageUrl(item) : item.uri,
                headers: {
                  'apikey': SUPABASE_ANON_KEY,
                  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                  'Cache-Control': 'no-cache'
                },
                cache: 'reload'
              }}
              style={styles.photoCardImage}
              defaultSource={require('../../assets/icon.png')}
              progressiveRenderingEnabled={true}
              onError={() => galleryMode === 'personal' && handleImageError(item.id)}
            />
            <View style={styles.galleryItemOverlay}>
              <Text style={styles.galleryItemText}>
                {galleryMode === 'personal' 
                  ? (item.species || t('fish.unknown'))
                  : extractSpeciesFromFileName(item.name) || t('fish.unknown')}
              </Text>
            </View>
            
            {galleryMode === 'shared' && item.deviceId && (
              <View style={styles.deviceBadge}>
                <Ionicons name="people-outline" size={12} color="#FFFFFF" />
                <Text style={styles.deviceBadgeText}>
                  {t('common.sharedGallery')}
                </Text>
              </View>
            )}
            
            {/* 이미 공유된 물고기에 표시 */}
            {isShared && galleryMode === 'personal' && (
              <View style={[styles.deviceBadge, { backgroundColor: '#28a745', top: 10, left: 10, right: 'auto' }]}>
                <Text style={styles.deviceBadgeText}>{t('common.shareSuccess')}</Text>
              </View>
            )}
            
            {/* 공유 버튼 추가 */}
            {galleryMode === 'personal' && !isGalleryView && (
              <TouchableOpacity 
                style={[styles.quickShareButton, isShared && { backgroundColor: '#28a745' }]}
                onPress={(e) => {
                  e.stopPropagation();
                  handleShareFish(item);
                }}
                disabled={isSharing || isShared}
              >
                {isSharing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons 
                    name={isShared ? "checkmark" : "share-social"} 
                    size={16} 
                    color="#FFFFFF" 
                  />
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </Pressable>
    );
  }, [galleryMode, isLoading, getSafeImageUrl, handleImageError, handleShareFish, t, sharedFishIds, isSharing]);

  // 파일 이름에서 어종 정보 추출하는 함수
  const extractSpeciesFromFileName = useCallback((fileName: string): string => {
    if (!fileName) return t('fish.unknown');
    
    try {
      // shared_yellowtop_butterflyfish_1234567890.jpg 형식에서 어종 추출
      const parts = fileName.split('_');
      if (parts.length >= 3) {
        // 어종 이름 매핑 테이블 (영문 -> 다국어)
        const speciesMap: Record<string, {ko: string, en: string, zh: string}> = {
          'clownfish': {
            ko: '클라운피시',
            en: 'Clownfish',
            zh: '小丑鱼'
          },
          'butterflyfish': {
            ko: '나비고기',
            en: 'Butterflyfish',
            zh: '蝴蝶鱼'
          },
          'yellowtop_butterflyfish': {
            ko: '윗노랑다섯줄나비고기',
            en: 'Yellowtop Butterflyfish',
            zh: '黄顶蝴蝶鱼'
          },
          'blue_stripe_snapper': {
            ko: '청줄돔',
            en: 'Blue Stripe Snapper',
            zh: '蓝条鲷鱼'
          },
          'sea_bream': {
            ko: '돔',
            en: 'Sea Bream',
            zh: '鲷鱼'
          },
          'bass': {
            ko: '농어',
            en: 'Bass',
            zh: '鲈鱼'
          },
          'carp': {
            ko: '잉어',
            en: 'Carp',
            zh: '鲤鱼'
          },
          'mackerel': {
            ko: '고등어',
            en: 'Mackerel',
            zh: '鲭鱼'
          },
          'tuna': {
            ko: '참치',
            en: 'Tuna',
            zh: '金枪鱼'
          },
          'swordfish': {
            ko: '황새치',
            en: 'Swordfish',
            zh: '剑鱼'
          },
          'anchovy': {
            ko: '멸치',
            en: 'Anchovy',
            zh: '凤尾鱼'
          },
          'yellowtail': {
            ko: '방어',
            en: 'Yellowtail',
            zh: '黄尾鱼'
          },
          'salmon': {
            ko: '연어',
            en: 'Salmon',
            zh: '三文鱼'
          },
          'rockfish': {
            ko: '우럭',
            en: 'Rockfish',
            zh: '石斑鱼'
          },
          'flatfish': {
            ko: '광어',
            en: 'Flatfish',
            zh: '比目鱼'
          },
          'horse_mackerel': {
            ko: '전갱이',
            en: 'Horse Mackerel',
            zh: '竹荚鱼'
          },
          'flounder': {
            ko: '가자미',
            en: 'Flounder',
            zh: '比目鱼'
          },
          'fry_fish': {
            ko: '치어',
            en: 'Fry Fish',
            zh: '鱼苗'
          },
          'unknown_fish': {
            ko: '알 수 없는 물고기',
            en: 'Unknown Fish',
            zh: '未知鱼类'
          }
        };
        
        // 타임스탬프 앞 부분까지를 어종 이름으로 추출
        let speciesKey = '';
        for (let i = 1; i < parts.length - 1; i++) {
          speciesKey += (i > 1 ? '_' : '') + parts[i];
        }
        
        // 현재 언어에 맞는 어종 이름 반환
        const currentLanguage = t('common.appName') === 'MarineTag' ? 'en' : 
                               t('common.appName') === '海洋标签' ? 'zh' : 'ko';
        
        // 해당 어종이 매핑 테이블에 있으면 번역된 이름 반환, 없으면 영문 이름 반환
        if (speciesMap[speciesKey]) {
          return speciesMap[speciesKey][currentLanguage as keyof typeof speciesMap[typeof speciesKey]];
        }
        
        // 언더스코어를 공백으로 변환하여 반환
        return speciesKey.replace(/_/g, ' ');
      }
      
      // 파일 확장자 제거
      return fileName.replace('.jpg', '').replace('shared_', '').replace(/_/g, ' ');
    } catch (error) {
      return t('fish.unknown');
    }
  }, [t]);

  if (showSettings) {
    return <SettingsScreen onBack={handleSettingsBack} />;
  }

  // 메인 홈화면
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* 헤더 */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{t('common.appName')}</Text>
        </View>
        
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => setShowSettings(true)}
        >
          <Ionicons name="settings-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>
      
      {/* 메인 콘텐츠 - 스크롤 가능하게 변경 */}
      <ScrollView 
        style={styles.mainContentScroll}
        contentContainerStyle={styles.mainContentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* 갤러리 섹션 */}
        <View style={styles.gallerySection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('common.recentGallery')}</Text>
            <TouchableOpacity
              onPress={() => setShowAllPhotos(true)}
              style={styles.viewAllButton}
              accessible={true}
              accessibilityLabel={t('common.allPhotos')}
              accessibilityRole="button"
            >
              <Text style={styles.viewAllText}>{t('common.allPhotos')}</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView
            style={styles.galleryScrollView}
            horizontal={true}
            showsHorizontalScrollIndicator={false}
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={handleRefresh}
                tintColor="#007AFF" 
              />
            }
          >
            {galleryPhotos.length === 0 ? (
              <View style={styles.emptyGalleryItem}>
                <Ionicons name="images-outline" size={32} color="#8E8E93" />
                <Text style={styles.emptyGalleryText}>{t('common.noPhotos')}</Text>
                <TouchableOpacity 
                  style={styles.reloadButton}
                  onPress={loadFishPhotos}
                >
                  <Text style={styles.reloadButtonText}>{t('common.reload')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              galleryPhotos.map((photo) => (
                <Pressable 
                  key={photo.id} 
                  style={styles.galleryItem}
                  onPress={() => handleFishPress(photo)}
                >
                  {/* 갤러리 이미지 표시 */}
                  <View style={[styles.galleryImageContainer, styles.photoCardImageContainer]}>
                    <Image 
                      source={{ 
                        uri: getSafeImageUrl(photo),
                        headers: {
                          'apikey': SUPABASE_ANON_KEY,
                          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                          'Cache-Control': 'no-cache, no-store, must-revalidate',
                          'Pragma': 'no-cache',
                          'Expires': '0'
                        },
                        cache: 'reload'
                      }}
                      style={styles.photoCardImage}
                      defaultSource={require('../../assets/icon.png')}
                      progressiveRenderingEnabled={true}
                      onError={() => handleImageError(photo.id)}
                    />
                    <View style={styles.galleryItemOverlay}>
                      <Text style={styles.galleryItemText}>
                        {photo.species || t('fish.unknown')}
                      </Text>
                    </View>
                    
                    {/* 빠른 공유 버튼 추가 */}
                    <TouchableOpacity 
                      style={styles.quickShareButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleShareFish(photo);
                      }}
                    >
                      <Ionicons name="share-social" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>
        
        {/* 분석 중 상태 표시 */}
        {isAnalyzing ? (
          <View style={styles.analysingContainer}>
            <View style={styles.analysingAnimation}>
              <Animated.View 
                style={[
                  styles.analysingInner, 
                  { 
                    transform: [
                      { rotate: spin },
                      { scale: pulseValue }
                    ] 
                  }
                ]} 
              />
            </View>
            <Text style={styles.analysingTitle}>
              {t('fish.analyzing')}
            </Text>
            <Text style={styles.analysingDescription}>
              {t('fish.analyzingDescription')}
            </Text>
            <View style={styles.analysingSteps}>
              <View style={[styles.analysingStep, styles.activeStep]}>
                <Ionicons name="checkmark-circle" size={20} color="#007AFF" />
                <Text style={styles.analysingStepText}>{t('fish.processingImage')}</Text>
              </View>
              <View style={[styles.analysingStep, styles.activeStep]}>
                <Ionicons name="reload-circle" size={20} color="#007AFF" />
                <Text style={styles.analysingStepText}>{t('fish.analyzingSpecies')}</Text>
              </View>
              <View style={styles.analysingStep}>
                <Animated.View style={{transform: [{scale: pulseValue}]}}>
                  <Ionicons name="time-outline" size={20} color="#8E8E93" />
                </Animated.View>
                <Text style={styles.analysingStepText}>{t('fish.generatingDetails')}</Text>
              </View>
            </View>
            <Animated.Text 
              style={[
                styles.analysingTip,
                {opacity: pulseValue.interpolate({
                  inputRange: [1, 1.2],
                  outputRange: [0.7, 1]
                })}
              ]}
            >
              {t('fish.analyzingTip')}
            </Animated.Text>
          </View>
        ) : lastAnalysis && lastPhoto ? (
          <View style={styles.analysisContainer}>
            <View style={styles.analysisHeaderRow}>
              <View style={styles.analysisIndicator} />
              <Text style={styles.analysisTitle}>
                {lastAnalysis.isFish ? lastAnalysis.species : t('fish.notFish')}
              </Text>
            </View>
            
            {lastAnalysis.isFish ? (
              <>
                <View style={styles.analysisImageRow}>
                  <Image source={{ uri: lastPhoto }} style={styles.thumbnailImage} />
                  <View style={styles.analysisStats}>
                    <View style={styles.statRow}>
                      <Text style={styles.statLabel}>{t('fish.confidence')}</Text>
                      <Text style={styles.statValue}>{Math.round(lastAnalysis.confidence * 100)}%</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.statRow}>
                      <Text style={styles.statLabel}>{t('fish.species')}</Text>
                      <Text style={styles.statValue}>{lastAnalysis.species}</Text>
                    </View>
                  </View>
                </View>
                
                <View style={styles.descriptionBox}>
                  <Text style={styles.descriptionText}>
                    {lastAnalysis.description || t('fish.noDescription')}
                  </Text>
                </View>
                
                {/* 추가 데이터 표시 - 해양생물학적 정보 */}
                <View style={styles.additionalDataContainer}>
                  <Text style={styles.additionalDataTitle}>{t('marineData.information')}</Text>
                  
                  <View style={styles.dataSection}>
                    <View style={styles.dataSectionHeader}>
                      <Ionicons name="location-outline" size={18} color="#007AFF" />
                      <Text style={styles.dataSectionTitle}>{t('marineData.location')}</Text>
                    </View>
                    <View style={styles.dataGrid}>
                      <View style={styles.dataGridItem}>
                        <Text style={styles.dataLabel}>{t('marineData.captureLocation')}</Text>
                        <Text style={styles.dataValue}>
                          {photos[0]?.environmental_data?.habitat_type || t('marineData.noInfo')}
                        </Text>
                      </View>
                      <View style={styles.dataGridItem}>
                        <Text style={styles.dataLabel}>{t('marineData.speciesCount')}</Text>
                        <Text style={styles.dataValue}>
                          {photos[0]?.count || '1'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  
                  <View style={styles.dataSection}>
                    <View style={styles.dataSectionHeader}>
                      <Ionicons name="time-outline" size={18} color="#007AFF" />
                      <Text style={styles.dataSectionTitle}>{t('marineData.timeInfo')}</Text>
                    </View>
                    <View style={styles.dataGrid}>
                      <View style={styles.dataGridItem}>
                        <Text style={styles.dataLabel}>{t('marineData.captureDate')}</Text>
                        <Text style={styles.dataValue}>
                          {photos[0]?.captured_at ? new Date(photos[0].captured_at).toLocaleDateString() : t('marineData.noInfo')}
                        </Text>
                      </View>
                      <View style={styles.dataGridItem}>
                        <Text style={styles.dataLabel}>{t('marineData.timeOfDay')}</Text>
                        <Text style={styles.dataValue}>
                          {photos[0]?.environmental_data?.time_of_day || t('marineData.noInfo')}
                        </Text>
                      </View>
                      <View style={styles.dataGridItem}>
                        <Text style={styles.dataLabel}>{t('marineData.season')}</Text>
                        <Text style={styles.dataValue}>
                          {photos[0]?.environmental_data?.season || t('marineData.noInfo')}
                        </Text>
                      </View>
                    </View>
                  </View>
                  
                  <View style={styles.dataSection}>
                    <View style={styles.dataSectionHeader}>
                      <Ionicons name="fish-outline" size={18} color="#007AFF" />
                      <Text style={styles.dataSectionTitle}>{t('marineData.morphological')}</Text>
                    </View>
                    <View style={styles.dataGrid}>
                      <View style={styles.dataGridItem}>
                        <Text style={styles.dataLabel}>{t('marineData.estimatedSize')}</Text>
                        <Text style={styles.dataValue}>
                          {photos[0]?.morphological_data?.length_estimate || t('marineData.noInfo')}
                        </Text>
                      </View>
                      <View style={styles.dataGridItem}>
                        <Text style={styles.dataLabel}>{t('marineData.colorPattern')}</Text>
                        <Text style={styles.dataValue}>
                          {photos[0]?.morphological_data?.color_pattern || t('marineData.noInfo')}
                        </Text>
                      </View>
                    </View>
                    {photos[0]?.morphological_data?.distinctive_features && 
                      photos[0].morphological_data.distinctive_features.length > 0 ? (
                      <View style={styles.featuresList}>
                        <Text style={styles.featuresListTitle}>{t('marineData.distinctiveFeatures')}:</Text>
                        {photos[0].morphological_data.distinctive_features?.map((feature, index) => (
                          <Text key={index} style={styles.featureItem}>• {feature}</Text>
                        ))}
                      </View>
                    ) : (
                      <View style={styles.featuresList}>
                        <Text style={styles.featuresListTitle}>{t('marineData.distinctiveFeatures')}:</Text>
                        <Text style={styles.featureItem}>• {t('marineData.noInfo')}</Text>
                      </View>
                    )}
                  </View>
                  
                  <View style={styles.dataSection}>
                    <View style={styles.dataSectionHeader}>
                      <Ionicons name="camera-outline" size={18} color="#007AFF" />
                      <Text style={styles.dataSectionTitle}>{t('marineData.imageInfo')}</Text>
                    </View>
                    <View style={styles.dataGrid}>
                      <View style={styles.dataGridItem}>
                        <Text style={styles.dataLabel}>{t('marineData.resolution')}</Text>
                        <Text style={styles.dataValue}>
                          {photos[0]?.resolution && photos[0].resolution.width && photos[0].resolution.height ? 
                            `${photos[0].resolution.width}x${photos[0].resolution.height}` : 
                            t('marineData.noInfo')}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
                
                <View style={styles.tipBox}>
                  <Ionicons name="information-circle-outline" size={20} color="#007AFF" style={styles.tipIcon} />
                  <Text style={styles.tipText}>
                    {t('marineData.tip')}
                  </Text>
                </View>
              </>
            ) : (
              <View style={styles.notFishContainer}>
                <Ionicons name="alert-circle-outline" size={48} color="#FF9500" style={styles.alertIcon} />
                <Text style={styles.notFishText}>
                  {t('alert.notFish')}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.instructionContainer}>
            <Text style={styles.instructionTitle}>
              {t('instruction.checkFishSpecies')}
            </Text>
            <Text style={styles.instructionText}>
              {t('instruction.instructionText')}
            </Text>
            <View style={styles.instructionSteps}>
              <View style={styles.stepItem}>
                <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
                <Text style={styles.stepText}>{t('instruction.step1')}</Text>
              </View>
              <View style={styles.stepItem}>
                <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
                <Text style={styles.stepText}>{t('instruction.step2')}</Text>
              </View>
              <View style={styles.stepItem}>
                <View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View>
                <Text style={styles.stepText}>{t('instruction.step3')}</Text>
              </View>
            </View>
          </View>
        )}
        
        {/* 하단 여백 추가 */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
      
      {/* 하단 버튼 */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.captureButton,
            (isAnalyzing || isUploading) && styles.disabledButton
          ]}
          onPress={handleCapture}
          disabled={isAnalyzing || isUploading}
        >
          {isAnalyzing || isUploading ? (
            <View style={styles.loadingButton}>
              <Animated.View 
                style={[
                  styles.loadingInner, 
                  { 
                    transform: [
                      { rotate: spin },
                      { scale: pulseValue }
                    ] 
                  }
                ]} 
              />
            </View>
          ) : (
            <View style={styles.innerButton} />
          )}
          
          {isUploading && (
            <Animated.Text 
              style={[
                styles.uploadingText,
                {opacity: pulseValue}
              ]}
            >
              {t('common.uploading')}...
            </Animated.Text>
          )}
        </TouchableOpacity>
      </View>
      
      {/* 모든 사진 모달 */}
      <Modal
        visible={showAllPhotos}
        animationType="slide"
        onRequestClose={() => setShowAllPhotos(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.allPhotosContent}>
            {/* 개선된 모달 헤더 */}
            <View style={styles.allPhotosHeader}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowAllPhotos(false)}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
              >
                <Ionicons name="chevron-down" size={28} color="#007AFF" />
              </TouchableOpacity>
              <Text style={styles.allPhotosTitle}>{t('common.allPhotos')}</Text>
              <TouchableOpacity 
                style={styles.sortButton}
                onPress={toggleSortOrder}
              >
                <Ionicons 
                  name={sortOrder === 'date' ? "calendar-outline" : "text-outline"} 
                  size={22} 
                  color="#007AFF" 
                />
              </TouchableOpacity>
            </View>
            
            {/* 개인/공유 갤러리 탭 */}
            <View style={styles.galleryTabsContainer}>
              <TouchableOpacity 
                style={[
                  styles.galleryTab, 
                  galleryMode === 'personal' && styles.galleryTabActive
                ]}
                onPress={() => setGalleryMode('personal')}
              >
                <Ionicons 
                  name="person" 
                  size={18} 
                  color={galleryMode === 'personal' ? "#007AFF" : "#8E8E93"} 
                />
                <Text 
                  style={[
                    styles.galleryTabText, 
                    galleryMode === 'personal' && styles.galleryTabTextActive
                  ]}
                >
                  {t('common.myFish')}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.galleryTab, 
                  galleryMode === 'shared' && styles.galleryTabActive
                ]}
                onPress={() => setGalleryMode('shared')}
              >
                <Ionicons 
                  name="people" 
                  size={18} 
                  color={galleryMode === 'shared' ? "#007AFF" : "#8E8E93"} 
                />
                <Text 
                  style={[
                    styles.galleryTabText, 
                    galleryMode === 'shared' && styles.galleryTabTextActive
                  ]}
                >
                  {t('common.sharedGallery')}
                </Text>
              </TouchableOpacity>
            </View>
            
            {/* 검색창 추가 */}
            <View style={styles.searchContainer}>
              {showSearch ? (
                <View style={styles.searchInputContainer}>
                  <Ionicons name="search" size={18} color="#8E8E93" style={styles.searchIcon} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder={t('common.searchFish')}
                    placeholderTextColor="#8E8E93"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery("")}>
                      <Ionicons name="close-circle" size={18} color="#8E8E93" />
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <TouchableOpacity 
                  style={styles.searchBar}
                  onPress={() => setShowSearch(true)}
                >
                  <Ionicons name="search" size={18} color="#8E8E93" style={styles.searchIcon} />
                  <Text style={styles.searchPlaceholder}>{t('common.searchFish')}</Text>
                </TouchableOpacity>
              )}
            </View>
            
            {/* 정렬 상태 표시 */}
            {sortOrder && (
              <View style={styles.sortInfoContainer}>
                <Text style={styles.sortInfoText}>
                  {sortOrder === 'date' ? t('common.sortByDate') : t('common.sortByName')}
                </Text>
              </View>
            )}
            
            {/* 개선된 그리드 레이아웃 */}
            {isLoading && galleryPhotos.length === 0 ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Animated.Text 
                  style={[
                    styles.loadingText,
                    {opacity: pulseValue}
                  ]}
                >
                  {t('common.loadingPhotos')}
                </Animated.Text>
              </View>
            ) : (
              <FlatList
                data={getGalleryData()}
                numColumns={2}
                keyExtractor={(item) => item.id || item.uri}
                renderItem={({ item }) => renderGalleryItem(item)}
                contentContainerStyle={[
                  styles.photosGrid,
                  getGalleryData().length === 0 && styles.emptyListContainer
                ]}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View style={styles.emptyPhotosContainer}>
                    {searchQuery ? (
                      <>
                        <Ionicons name="search" size={64} color="#C7C7CC" />
                        <Text style={styles.emptyPhotosTitle}>{t('common.noSearchResults')}</Text>
                        <Text style={styles.emptyPhotosText}>
                          {t('common.tryAnotherSearch')}
                        </Text>
                        <TouchableOpacity 
                          style={styles.clearSearchButton} 
                          onPress={() => setSearchQuery("")}
                        >
                          <Text style={styles.clearSearchButtonText}>{t('common.resetSearch')}</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <Animated.View style={{transform: [{scale: pulseValue}]}}>
                          <Ionicons name="images-outline" size={64} color="#C7C7CC" />
                        </Animated.View>
                        <Text style={styles.emptyPhotosTitle}>{t('common.noPhotosTaken')}</Text>
                        <Text style={styles.emptyPhotosText}>
                          {t('common.photoWillAppearHere')}
                        </Text>
                        <TouchableOpacity 
                          style={styles.takePictureButton} 
                          onPress={() => {
                            setShowAllPhotos(false);
                            setTimeout(() => handleCapture(), 500);
                          }}
                        >
                          <Text style={styles.takePictureButtonText}>{t('common.takePicture')}</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                }
                refreshControl={
                  <RefreshControl 
                    refreshing={refreshing} 
                    onRefresh={handleRefresh}
                    tintColor="#007AFF" 
                  />
                }
              />
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {/* 물고기 상세 정보 모달 */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showFishDetail}
        onRequestClose={() => setShowFishDetail(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {/* 모달 헤더 */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('common.fishDetails')}</Text>
              <TouchableOpacity 
                style={styles.closeButton} 
                onPress={() => setShowFishDetail(false)}
                hitSlop={{top: 20, bottom: 20, left: 20, right: 20}}
              >
                <Ionicons name="close" size={28} color="#007AFF" />
              </TouchableOpacity>
            </View>
            
            {/* 물고기 이미지와 상세 정보 - 스크롤 가능하도록 변경 */}
            {selectedFish && (
              <ScrollView 
                style={styles.detailScrollView}
                showsVerticalScrollIndicator={true}
                contentContainerStyle={styles.detailScrollContent}
              >
                <Image 
                  source={{ 
                    uri: getSafeImageUrl(selectedFish),
                    headers: {
                      'apikey': SUPABASE_ANON_KEY,
                      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                      'Cache-Control': 'no-cache'
                    },
                    cache: 'reload'
                  }} 
                  style={styles.detailImage}
                  resizeMode="cover"
                />
                
                {/* 공유 버튼 추가 */}
                <TouchableOpacity 
                  style={styles.shareButton}
                  onPress={() => handleShareFish(selectedFish)}
                  disabled={isSharing}
                >
                  {isSharing ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="share-outline" size={20} color="#FFFFFF" />
                      <Text style={styles.shareButtonText}>{t('common.shareToGallery')}</Text>
                    </>
                  )}
                </TouchableOpacity>
                
                {/* 물고기 기본 정보 */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailTitle}>{selectedFish.species || t('fish.unknown')}</Text>
                  <Text style={styles.detailDate}>
                    {t('fish.capturedAt')}: {selectedFish.captured_at ? new Date(selectedFish.captured_at).toLocaleString('ko-KR') : t('marineData.noInfo')}
                  </Text>
                  
                  {/* 분석 정보 */}
                  {selectedFish.analysis && (
                    <View style={styles.analysisSection}>
                      <Text style={styles.sectionSubtitle}>{t('fish.analysis')}</Text>
                      <View style={styles.confidenceBar}>
                        <View 
                          style={[
                            styles.confidenceFill, 
                            { width: `${selectedFish.analysis.confidence * 100}%` }
                          ]} 
                        />
                        <Text style={styles.confidenceText}>
                          {t('fish.accuracy')}: {Math.round(selectedFish.analysis.confidence * 100)}%
                        </Text>
                      </View>
                      <Text style={styles.description}>
                        {selectedFish.analysis.description || t('fish.noDescription')}
                      </Text>
                    </View>
                  )}
                  
                  {/* 환경 정보 */}
                  {selectedFish.environmental_data && (
                    <View style={styles.environmentSection}>
                      <Text style={styles.sectionSubtitle}>{t('marineData.information')}</Text>
                      <View style={styles.dataGrid}>
                        <View style={styles.dataItem}>
                          <Text style={styles.dataLabel}>{t('marineData.season')}</Text>
                          <Text style={styles.dataValue}>{selectedFish.environmental_data.season || t('marineData.noInfo')}</Text>
                        </View>
                        <View style={styles.dataItem}>
                          <Text style={styles.dataLabel}>{t('marineData.timeOfDay')}</Text>
                          <Text style={styles.dataValue}>{selectedFish.environmental_data.time_of_day || t('marineData.noInfo')}</Text>
                        </View>
                        <View style={styles.dataItem}>
                          <Text style={styles.dataLabel}>{t('marineData.weather')}</Text>
                          <Text style={styles.dataValue}>{selectedFish.environmental_data.weather || t('marineData.noInfo')}</Text>
                        </View>
                        <View style={styles.dataItem}>
                          <Text style={styles.dataLabel}>{t('marineData.habitat')}</Text>
                          <Text style={styles.dataValue}>{selectedFish.environmental_data.habitat_type || t('marineData.noInfo')}</Text>
                        </View>
                      </View>
                    </View>
                  )}
                  
                  {/* 형태학적 데이터 */}
                  {selectedFish.morphological_data && (
                    <View style={styles.morphologySection}>
                      <Text style={styles.sectionSubtitle}>{t('marineData.morphological')}</Text>
                      <View style={styles.morphologyList}>
                        <View style={styles.morphologyItem}>
                          <Text style={styles.morphologyLabel}>{t('marineData.colorPattern')}:</Text>
                          <Text style={styles.morphologyValue}>{selectedFish.morphological_data.color_pattern || t('marineData.noInfo')}</Text>
                        </View>
                        <View style={styles.morphologyItem}>
                          <Text style={styles.morphologyLabel}>{t('marineData.estimatedSize')}:</Text>
                          <Text style={styles.morphologyValue}>{selectedFish.morphological_data.length_estimate || t('marineData.noInfo')}</Text>
                        </View>
                        {selectedFish.morphological_data.distinctive_features && 
                         selectedFish.morphological_data.distinctive_features.length > 0 && (
                          <View style={styles.morphologyItem}>
                            <Text style={styles.morphologyLabel}>{t('marineData.distinctiveFeatures')}:</Text>
                            {selectedFish.morphological_data.distinctive_features.map((feature, index) => (
                              <Text key={index} style={styles.featureText}>- {feature}</Text>
                            ))}
                          </View>
                        )}
                      </View>
                    </View>
                  )}
                  
                  {/* 위치 정보 */}
                  {selectedFish.location && (
                    <View style={styles.locationSection}>
                      <Text style={styles.sectionSubtitle}>{t('marineData.location')}</Text>
                      <Text style={styles.locationText}>
                        {t('marineData.latitude')}: {selectedFish.location.latitude}, {t('marineData.longitude')}: {selectedFish.location.longitude}
                      </Text>
                    </View>
                  )}
                  
                  {/* 닫기 버튼 추가 - 모바일에서 쉽게 닫을 수 있도록 */}
                  <TouchableOpacity 
                    style={styles.backToHomeButton} 
                    onPress={() => setShowFishDetail(false)}
                  >
                    <Text style={styles.backToHomeButtonText}>{t('common.goBack')}</Text>
                  </TouchableOpacity>
                  
                  {/* 하단 여백 */}
                  <View style={styles.detailBottomSpacing} />
                </View>
              </ScrollView>
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#000',
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-Bold' : 'Pretendard-Bold',
  },
  settingsButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainContent: {
    flex: 1,
    paddingTop: 20,
  },
  mainContentScroll: {
    flex: 1,
  },
  mainContentContainer: {
    paddingTop: 20,
    paddingBottom: 20,
  },
  gallerySection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-Bold' : 'Pretendard-Bold',
  },
  viewAllButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  viewAllText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-Medium' : 'Pretendard-Medium',
  },
  galleryScrollView: {
    paddingLeft: 16,
  },
  galleryItem: {
    width: 160,
    height: 200,
    borderRadius: 12,
    marginRight: 12,
    overflow: 'hidden',
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  galleryImageContainer: {
    position: 'relative',
  },
  galleryImage: {
    width: '100%',
    height: 180,
    resizeMode: 'cover',
  },
  galleryItemOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  galleryItemText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-Bold' : 'Pretendard-Bold',
  },
  emptyGalleryItem: {
    width: 160,
    height: 200,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyGalleryText: {
    color: '#8E8E93',
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
    paddingHorizontal: 10,
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-Medium' : 'Pretendard-Medium',
  },
  instructionContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 12,
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  instructionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-Bold' : 'Pretendard-Bold',
  },
  instructionText: {
    fontSize: 17,
    color: '#3A3A3C',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-Regular' : 'Pretendard-Regular',
  },
  instructionSteps: {
    width: '100%',
    alignItems: 'flex-start',
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-Bold' : 'Pretendard-Bold',
  },
  stepText: {
    fontSize: 16,
    color: '#3A3A3C',
    flex: 1,
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-Medium' : 'Pretendard-Medium',
  },
  analysisContainer: {
    margin: 16,
    borderRadius: 16,
    backgroundColor: 'white',
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 20,
  },
  analysisHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  analysisIndicator: {
    width: 4,
    height: 24,
    backgroundColor: '#007AFF',
    borderRadius: 2,
    marginRight: 8,
  },
  analysisTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-Bold' : 'Pretendard-Bold',
  },
  analysisImageRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  thumbnailImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginRight: 16,
  },
  analysisStats: {
    flex: 1,
    justifyContent: 'center',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 16,
    color: '#8E8E93',
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-Medium' : 'Pretendard-Medium',
  },
  statValue: {
    fontSize: 16,
    color: '#000',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-SemiBold' : 'Pretendard-SemiBold',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E5EA',
    marginVertical: 8,
  },
  descriptionBox: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  descriptionText: {
    fontSize: 16,
    color: '#3A3A3C',
    lineHeight: 24,
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-Regular' : 'Pretendard-Regular',
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 12,
    padding: 12,
  },
  tipIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#007AFF',
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-Regular' : 'Pretendard-Regular',
  },
  notFishContainer: {
    alignItems: 'center',
    padding: 20,
  },
  alertIcon: {
    marginBottom: 16,
  },
  notFishText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#3A3A3C',
    lineHeight: 24,
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-Medium' : 'Pretendard-Medium',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 40,
    paddingTop: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  captureButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  innerButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  disabledButton: {
    backgroundColor: 'rgba(0, 122, 255, 0.5)',
  },
  loadingButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  loadingInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderTopColor: '#ffffff',
    borderRightColor: 'rgba(255, 255, 255, 0.5)',
    borderBottomColor: 'rgba(255, 255, 255, 0.3)',
    borderLeftColor: 'rgba(255, 255, 255, 0.7)',
  },
  uploadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#8E8E93',
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-Medium' : 'Pretendard-Medium',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  allPhotosContent: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  allPhotosHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  allPhotosTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-Bold' : 'Pretendard-Bold',
  },
  closeButton: {
    padding: 5,
  },
  sortButton: {
    padding: 5,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    color: '#8E8E93',
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-Regular' : 'Pretendard-Regular',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchPlaceholder: {
    color: '#8E8E93',
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-Regular' : 'Pretendard-Regular',
  },
  sortInfoContainer: {
    padding: 12,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 10,
    marginBottom: 16,
  },
  sortInfoText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-SemiBold' : 'Pretendard-SemiBold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-Medium' : 'Pretendard-Medium',
  },
  photosGrid: {
    padding: 12,
  },
  photoCard: {
    flex: 1,
    margin: 6,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  photoCardLoading: {
    flex: 1,
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  photoCardImage: {
    width: '100%',
    height: 180,
    resizeMode: 'cover',
  },
  photoCardDetails: {
    padding: 10,
  },
  photoCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-SemiBold' : 'Pretendard-SemiBold',
  },
  photoCardDate: {
    fontSize: 12,
    color: '#8E8E93',
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-Regular' : 'Pretendard-Regular',
  },
  emptyPhotosContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 100,
  },
  emptyPhotosTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-SemiBold' : 'Pretendard-SemiBold',
  },
  emptyPhotosText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 24,
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-Regular' : 'Pretendard-Regular',
  },
  takePictureButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  takePictureButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-SemiBold' : 'Pretendard-SemiBold',
  },
  modalContent: {
    flex: 1,
    backgroundColor: 'white',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  detailScrollView: {
    flex: 1,
  },
  detailScrollContent: {
    padding: 20,
  },
  detailImage: {
    width: '100%',
    height: 250,
    borderRadius: 12,
    marginBottom: 20,
  },
  detailSection: {
    marginBottom: 20,
  },
  detailTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-Bold' : 'Pretendard-Bold',
  },
  detailDate: {
    fontSize: 16,
    color: '#3A3A3C',
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-Regular' : 'Pretendard-Regular',
  },
  analysisSection: {
    marginBottom: 20,
  },
  confidenceBar: {
    height: 20,
    backgroundColor: '#E5E5EA',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 8,
  },
  confidenceFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 10,
  },
  confidenceText: {
    fontSize: 14,
    color: '#000',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-SemiBold' : 'Pretendard-SemiBold',
  },
  description: {
    fontSize: 16,
    color: '#3A3A3C',
    lineHeight: 22,
    marginTop: 10,
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-Regular' : 'Pretendard-Regular',
  },
  environmentSection: {
    marginBottom: 20,
  },
  dataItem: {
    width: '50%',
    marginBottom: 8,
  },
  morphologySection: {
    marginBottom: 20,
  },
  morphologyList: {
    marginTop: 8,
    marginLeft: 4,
  },
  morphologyItem: {
    marginBottom: 10,
  },
  morphologyLabel: {
    fontSize: 14,
    color: '#8E8E93',
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-Medium' : 'Pretendard-Medium',
  },
  morphologyValue: {
    fontSize: 16,
    color: '#1C1C1E',
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-Regular' : 'Pretendard-Regular',
  },
  locationSection: {
    marginBottom: 20,
  },
  locationText: {
    fontSize: 16,
    color: '#3A3A3C',
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-Regular' : 'Pretendard-Regular',
  },
  sectionSubtitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-Bold' : 'Pretendard-Bold',
  },
  featureText: {
    fontSize: 14,
    color: '#1C1C1E',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-Regular' : 'Pretendard-Regular',
  },
  backToHomeButton: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 15,
    backgroundColor: '#007AFF',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backToHomeButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  detailBottomSpacing: {
    height: 100, // 하단 버튼 공간을 위한 여백
  },
  bottomSpacing: {
    height: 100, // 하단 버튼 공간을 위한 여백
  },
  analysingContainer: {
    margin: 16,
    borderRadius: 16,
    backgroundColor: 'white',
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 20,
  },
  analysingAnimation: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    overflow: 'hidden',
  },
  analysingInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 4,
    borderTopColor: '#007AFF',
    borderRightColor: 'rgba(0, 122, 255, 0.5)',
    borderBottomColor: 'rgba(0, 122, 255, 0.3)',
    borderLeftColor: 'rgba(0, 122, 255, 0.7)',
  },
  analysingTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-Bold' : 'Pretendard-Bold',
  },
  analysingDescription: {
    fontSize: 16,
    color: '#3A3A3C',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-Regular' : 'Pretendard-Regular',
  },
  analysingSteps: {
    width: '100%',
    marginBottom: 20,
  },
  analysingStep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0, 122, 255, 0.05)',
    borderRadius: 10,
  },
  activeStep: {
    backgroundColor: 'rgba(0, 122, 255, 0.15)',
  },
  analysingStepText: {
    fontSize: 15,
    marginLeft: 10,
    color: '#3A3A3C',
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-Medium' : 'Pretendard-Medium',
  },
  analysingTip: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-Regular' : 'Pretendard-Regular',
  },
  reloadButton: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 15,
    backgroundColor: '#007AFF',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reloadButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  additionalDataContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginBottom: 16,
  },
  additionalDataTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 16,
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-Bold' : 'Pretendard-Bold',
  },
  dataSection: {
    marginBottom: 20,
  },
  dataSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  dataSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginLeft: 6,
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-SemiBold' : 'Pretendard-SemiBold',
  },
  dataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  dataGridItem: {
    width: '50%',
    marginBottom: 8,
  },
  dataLabel: {
    fontSize: 14,
    color: '#8E8E93',
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-Medium' : 'Pretendard-Medium',
  },
  dataValue: {
    fontSize: 16,
    color: '#1C1C1E',
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-Regular' : 'Pretendard-Regular',
  },
  featuresList: {
    marginTop: 8,
    marginLeft: 4,
  },
  featuresListTitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 6,
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-Medium' : 'Pretendard-Medium',
  },
  featureItem: {
    fontSize: 14,
    color: '#1C1C1E',
    marginBottom: 4,
    marginLeft: 8,
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-Regular' : 'Pretendard-Regular',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-Bold' : 'Pretendard-Bold',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  emptyListContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 500,
  },
  clearSearchButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 16,
  },
  clearSearchButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-SemiBold' : 'Pretendard-SemiBold',
  },
  photoCardImageContainer: {
    position: 'relative',
  },
  galleryTabsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
    marginBottom: 8,
  },
  galleryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    paddingHorizontal: 20,
    marginHorizontal: 4,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
  },
  galleryTabActive: {
    backgroundColor: '#007AFF20',
  },
  galleryTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    marginLeft: 4,
  },
  galleryTabTextActive: {
    color: '#007AFF',
  },
  deviceBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  deviceBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '500',
    marginLeft: 2,
  },
  shareButton: {
    position: 'absolute',
    bottom: 30,
    right: 10,
    backgroundColor: '#007bff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  sharedButton: {
    backgroundColor: '#28a745',
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  quickShareButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 122, 255, 0.8)',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
}); 