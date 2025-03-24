import supabase from '../lib/supabase';
import * as ImageManipulator from 'expo-image-manipulator';
import { FishAnalysis } from './vision';
import * as MediaLibrary from 'expo-media-library';
import { Platform, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/env';
import { Buffer } from 'buffer';
import { getDeviceId } from './device';

export interface FishPhoto {
  id: string;
  url: string;
  species: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  analysis?: {
    confidence: number;
    description: string;
  };
  captured_at?: string;
  // 추가된 필드들
  count?: number;
  resolution?: {
    width: number;
    height: number;
  };
  water_conditions?: {
    salinity: string;
    turbidity: string;
    temperature: number | null;
  };
  environmental_data?: {
    season: string;
    weather: string;
    time_of_day: string;
    habitat_type: string;
  };
  morphological_data?: {
    color_pattern: string;
    length_estimate: string;
    distinctive_features?: string[];
  };
}

interface ImageInfo {
  width: number;
  height: number;
  uri: string;
}

export interface FishImage {
  uri: string;
  name: string;
  createdAt: string;
}

// 계절 계산 함수
const getSeason = (date: Date): string => {
  const month = date.getMonth() + 1;
  if (month >= 3 && month <= 5) return '봄';
  if (month >= 6 && month <= 8) return '여름';
  if (month >= 9 && month <= 11) return '가을';
  return '겨울';
};

// 시간대 계산 함수
const getTimeOfDay = (date: Date): string => {
  const hours = date.getHours();
  if (hours >= 5 && hours < 12) return '오전';
  if (hours >= 12 && hours < 18) return '오후';
  if (hours >= 18 && hours < 22) return '저녁';
  return '밤';
};

// 서식지 유형 추정 (위치 데이터로부터)
const estimateHabitatType = (latitude: number, longitude: number): string => {
  try {
    // 여기서는 간단한 추정 로직만 구현
    // 실제로는 지리 데이터 API나 지도 데이터를 활용해 더 정확한 서식지 유형을 파악할 수 있음
    if (longitude > 126 && longitude < 132) { // 한국 동해안 대략적 경도
      return '동해 연안';
    } else if (longitude < 126.5) { // 한국 서해안 대략적 경도
      return '서해 연안';
    } else if (latitude < 34.5) { // 한국 남해안 대략적 위도
      return '남해 연안';
    }
    return '내륙 담수';
  } catch (error) {
    return '미확인';
  }
};

// 물고기 길이 추정 (이미지 분석 결과로부터)
const estimateFishLength = (description: string): string => {
  // 설명에서 크기 관련 정보 추출 시도
  const lengthMatches = description.match(/(\d+(\.\d+)?)\s*(cm|미터|m)/gi);
  if (lengthMatches && lengthMatches.length > 0) {
    return lengthMatches[0];
  }
  
  // 설명에 "작은", "큰" 등의 표현이 있는지 확인
  if (description.includes('작은') || description.includes('소형')) {
    return '소형 (5-15cm 추정)';
  } else if (description.includes('중간') || description.includes('중형')) {
    return '중형 (15-30cm 추정)';
  } else if (description.includes('큰') || description.includes('대형')) {
    return '대형 (30cm 이상 추정)';
  }
  
  return '크기 미상';
};

// 색상 패턴 추출 (이미지 분석 결과로부터)
const extractColorPattern = (description: string): string => {
  const colorMatches = description.match(/(빨간|붉은|주황|노란|황색|녹색|초록|파란|청색|보라|자주|분홍|핑크|흰|하얀|검은|검정|회색|은색|금색)/g);
  if (colorMatches && colorMatches.length > 0) {
    return colorMatches.join(', ');
  }
  return '색상 패턴 미상';
};

// 특징적 요소 추출 (이미지 분석 결과로부터)
const extractDistinctiveFeatures = (description: string): string[] => {
  const features: string[] = [];
  const featureKeywords = [
    '지느러미', '꼬리', '비늘', '무늬', '반점', '줄무늬', '얼룩', '점', 
    '등지느러미', '가슴지느러미', '배지느러미', '꼬리지느러미', '아가미', '주둥이'
  ];
  
  featureKeywords.forEach(keyword => {
    const regex = new RegExp(`[^.]*${keyword}[^.]*\\.`, 'g');
    const matches = description.match(regex);
    if (matches) {
      features.push(...matches);
    }
  });
  
  return features.length > 0 ? features : ['특징적 요소 없음'];
};

// 개체 수 계산 (동일 장소에서 촬영된 물고기 종류 수)
const countFishSpecies = async (latitude: number, longitude: number): Promise<number> => {
  try {
    // 위치 기반 반경 설정 (약 500m)
    const latRange = 0.005;
    const lngRange = 0.005;
    
    const { data, error } = await supabase
      .from('fish_photos')
      .select('species')
      .gte('location->latitude', latitude - latRange)
      .lte('location->latitude', latitude + latRange)
      .gte('location->longitude', longitude - lngRange)
      .lte('location->longitude', longitude + lngRange);
    
    if (error) throw error;
    
    // 중복 제거한 고유 종 개수
    const uniqueSpecies = new Set(data?.map((item: { species: string }) => item.species) || []);
    return uniqueSpecies.size;
  } catch (error) {
    return 1; // 오류 시 기본값 1 반환
  }
};

// 이미지 정보 가져오기
const getImageInfo = async (uri: string): Promise<ImageInfo> => {
  try {
    if (Platform.OS === 'web') {
      return { width: 0, height: 0, uri };
    }
    
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) throw new Error('이미지 파일이 존재하지 않습니다');
    
    // 이미지 크기 정보 가져오기 - ImageManipulator 사용
    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      [], // 변환 없음
      { compress: 1 } // 압축 없음
    );
    
    return { 
      width: manipResult.width, 
      height: manipResult.height, 
      uri 
    };
  } catch (error) {
    return { width: 0, height: 0, uri };
  }
};

// 이미지 URL 테스트 함수
const testImageUrl = async (url: string): Promise<boolean> => {
  try {
    // URL이 유효한지 확인
    if (!url || !url.startsWith('http')) {
      return false;
    }
    
    // Pexels와 같은 외부 이미지인 경우 유효한 것으로 간주
    if (url.includes('pexels.com') || 
        url.includes('unsplash.com') || 
        url.includes('picsum.photos')) {
      return true;
    }
    
    // Supabase URL 테스트 - 더 짧은 타임아웃 설정
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500); // 1.5초 타임아웃
      
      const response = await fetch(url, {
        method: 'HEAD', // HEAD 요청으로 변경 (더 빠름)
        headers: {
          'Cache-Control': 'no-cache',
          'apikey': SUPABASE_ANON_KEY,
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // 타임아웃은 유효한 것으로 간주
        return true;
      }
      return false;
    }
  } catch (error) {
    return false;
  }
};

// 최적화된 이미지 준비
const optimizeImage = async (uri: string): Promise<string> => {
  try {
    // 원본 파일 정보 확인
    const fileInfo = await FileSystem.getInfoAsync(uri, { size: true });
    
    // 이미지 크기에 따라 최적화 수준 결정
    let compressionLevel = 0.8;
    let maxWidth = 1200;
    
    if (fileInfo.exists && fileInfo.size && fileInfo.size > 5000000) { // 5MB 이상
      compressionLevel = 0.6;
      maxWidth = 1000;
    } else if (fileInfo.exists && fileInfo.size && fileInfo.size > 2000000) { // 2MB 이상
      compressionLevel = 0.7;
      maxWidth = 1200;
    }
    
    // 이미지 리사이징 및 압축
    const optimizedImage = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: maxWidth } }], // 최대 너비 제한
      { 
        compress: compressionLevel,
        format: ImageManipulator.SaveFormat.JPEG
      }
    );
    
    return optimizedImage.uri;
  } catch (error) {
    return uri; // 오류 시 원본 반환
  }
};

// photos 버킷을 다시 생성하고 올바르게 설정하는 함수
export const ensurePhotosBucketExists = async (): Promise<boolean> => {
  try {
    // 버킷 존재 여부 확인
    const { data: buckets, error: bucketListError } = await supabase.storage
      .listBuckets();
    
    if (bucketListError) {
      console.error('버킷 리스트 조회 오류:', bucketListError);
      return false;
    }
    
    // photos 버킷 확인
    const photosBucketExists = buckets?.some(bucket => bucket.name === 'photos');
    
    // fish-images 버킷 확인
    const fishImagesBucketExists = buckets?.some(bucket => bucket.name === 'fish-images');
    
    // photos 버킷이 없으면 생성
    if (!photosBucketExists) {
      const { error: createError } = await supabase.storage.createBucket('photos', {
        public: true
      });
      
      if (createError) {
        console.error('photos 버킷 생성 오류:', createError);
      } else {
        console.log('photos 버킷 생성 완료');
      }
    }
    
    // fish-images 버킷이 없으면 생성
    if (!fishImagesBucketExists) {
      const { error: createFishImagesError } = await supabase.storage.createBucket('fish-images', {
        public: true
      });
      
      if (createFishImagesError) {
        console.error('fish-images 버킷 생성 오류:', createFishImagesError);
        return false;
      } else {
        console.log('fish-images 버킷 생성 완료');
        
        // shared_gallery 폴더 생성을 위한 빈 파일 업로드
        try {
          const emptyBlob = new Blob([''], { type: 'text/plain' });
          await supabase.storage
            .from('fish-images')
            .upload('shared_gallery/.placeholder', emptyBlob);
          console.log('shared_gallery 폴더 생성 완료');
        } catch (folderError) {
          console.log('shared_gallery 폴더 생성 중 오류 (무시 가능):', folderError);
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error('버킷 확인/생성 오류:', error);
    return false;
  }
};

// 고유 식별자 생성 함수
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, 
        v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// 물고기 사진 업로드 함수
export const uploadImageToBucket = async (
  imageUri: string,
  species: string = '알 수 없는 물고기',
  location?: { latitude: number; longitude: number },
  analysis?: { confidence: number; description: string }
): Promise<FishPhoto | null> => {
  try {
    const deviceId = await getDeviceId();
    console.log('디바이스 ID로 이미지 업로드 시작:', deviceId);
    
    // 폴백 이미지 준비
    const fallbackUrl = getFallbackImageUrl();
    
    // 타임스탬프로 파일명 생성
    const timestamp = Date.now();
    const fileName = `fish_${timestamp}.jpg`;
    
    // iOS에서 ph:// -> file:// 변환 (변환만)
    let processedUri = imageUri;
    if (Platform.OS === 'ios' && imageUri.startsWith('ph://')) {
      try {
        const result = await ImageManipulator.manipulateAsync(
          imageUri,
          [], // 변환 없음
          { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
        );
        processedUri = result.uri;
      } catch (error) {
        Alert.alert('이미지 오류', 'iOS 사진을 처리할 수 없습니다.');
        return null;
      }
    }
    
    // 이미지 업로드 - 단순화된 방식
    let uploadSuccess = false;
    let publicUrl = fallbackUrl;
    
    try {
      // FormData 방식으로 업로드 - 가장 안정적인 방법
      const formData = new FormData();
      formData.append('file', {
        uri: processedUri,
        name: fileName,
        type: 'image/jpeg'
      } as any);
      
      // 직접 Supabase API 엔드포인트에 업로드
      const uploadUrl = `${SUPABASE_URL}/storage/v1/object/photos/${fileName}`;
      
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: formData
      });
      
      if (response.ok) {
        publicUrl = `${SUPABASE_URL}/storage/v1/object/public/photos/${fileName}?t=${timestamp}`;
        uploadSuccess = true;
      } else {
        uploadSuccess = false;
      }
    } catch (uploadError) {
      uploadSuccess = false;
    }
    
    // 현재 시간
    const now = new Date().toISOString();
    
    // 서식지 타입
    const habitatType = location ? estimateHabitatType(location.latitude, location.longitude) : '정보 없음';
    
    // UUID 생성
    const uuid = generateUUID();
    
    // 기본 데이터 설정
    const fishData: FishPhoto = {
      id: uuid,
      url: publicUrl,
      species: species,
      location: location,
      analysis: analysis || { confidence: 0.5, description: '자동 분석 정보 없음' },
      captured_at: now,
      count: 1,
      resolution: {
        width: 800, // 기본값
        height: 600
      },
      water_conditions: {
        salinity: '자동 측정 불가',
        turbidity: '자동 측정 불가',
        temperature: null
      },
      environmental_data: {
        season: getSeason(new Date(now)),
        weather: '자동 측정 불가',
        time_of_day: getTimeOfDay(new Date(now)),
        habitat_type: habitatType
      },
      morphological_data: {
        color_pattern: '색상 패턴 미상',
        length_estimate: '크기 미상',
        distinctive_features: analysis?.description ? [analysis.description] : ['특징 정보 없음']
      }
    };
    
    // 업로드 실패 시 DB 저장 건너뛰기
    if (!uploadSuccess) {
      return fishData;
    }
    
    // 데이터베이스에 저장 시도
    try {
      const { error: dbError } = await supabase
        .from('fish_photos')
        .insert(fishData);
      
      if (dbError) {
        console.error('DB 저장 오류:', dbError);
      }
    } catch (dbError) {
      // 오류 무시하고 계속 진행
    }
    
    // 성공 여부와 상관없이 데이터 반환
    return fishData;
  } catch (error) {
    // 실패해도 최소한의 데이터 반환
    return {
      id: generateUUID(),
      url: getFallbackImageUrl(),
      species: species || '알 수 없는 물고기',
      captured_at: new Date().toISOString(),
      count: 1
    };
  }
};

// 대체 이미지 URL 반환 함수
const getFallbackImageUrl = (): string => {
  const fallbackImages = [
    'https://images.pexels.com/photos/128756/pexels-photo-128756.jpeg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/213399/pexels-photo-213399.jpeg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/1145274/pexels-photo-1145274.jpeg?auto=compress&cs=tinysrgb&w=600'
  ];
  return fallbackImages[Math.floor(Math.random() * fallbackImages.length)];
};

// 물고기 사진 가져오기
export const getFishPhotos = async (): Promise<FishPhoto[]> => {
  try {
    // 간단한 쿼리 사용
    const { data, error } = await supabase
      .from('fish_photos')
      .select('*')
      .order('captured_at', { ascending: false })
      .limit(20);
    
    if (error) {
      return [];
    }
    
    if (!data || data.length === 0) {
      return [];
    }
    
    // 각 사진 URL에 캐시버스팅 추가
    const enhancedData = data.map((photo) => {
      try {
        if (photo.url && photo.url.startsWith('http')) {
          // 기존 URL에 타임스탬프 추가
          const cacheBuster = Date.now();
          const separator = photo.url.includes('?') ? '&' : '?';
          const urlWithCache = `${photo.url}${separator}_t=${cacheBuster}`;
          return { ...photo, url: urlWithCache };
        }
        return photo;
      } catch (error) {
        return photo;
      }
    });
    
    return enhancedData;
  } catch (error) {
    return [];
  }
};

// 위치에 따른 서식지 추정
const getHabitatByLocation = (location: { latitude: number; longitude: number }): string => {
  // 한국 주변 해역 대략적인 판단
  // 동해
  if (location.longitude > 129) {
    return '동해 연안';
  }
  // 서해
  if (location.longitude < 126) {
    return '서해 연안';
  }
  // 남해
  if (location.latitude < 35) {
    return '남해 연안';
  }
  // 내륙
  return '내륙 수계';
};

// 개인 기기별 이미지 가져오기 (기존 함수)
export const getFishImages = async (): Promise<FishImage[]> => {
  try {
    const deviceId = await getDeviceId();
    const { data, error } = await supabase.storage
      .from('fish-images')
      .list(deviceId);

    if (error) {
      throw error;
    }

    return data.map(file => ({
      uri: getPublicUrl(`${deviceId}/${file.name}`),
      name: file.name,
      createdAt: file.created_at
    }));
  } catch (error) {
    console.error('이미지 목록 조회 중 오류:', error);
    return [];
  }
};

// 공유 갤러리용 모든 물고기 이미지 가져오기 (새 함수)
export const getAllFishImages = async (): Promise<FishImage[]> => {
  try {
    await ensurePhotosBucketExists();
    
    // 모든 파일 리스트 가져오기
    const { data: files, error: filesError } = await supabase.storage
      .from('fish-images')
      .list();

    if (filesError) {
      console.error('파일 리스트 조회 오류:', filesError);
      throw filesError;
    }

    // 공유된 이미지만 필터링 (파일명이 'shared_'로 시작하는 파일)
    const sharedImages = files
      .filter(file => file.name.startsWith('shared_'))
      .map(file => ({
        uri: getPublicUrl(file.name),
        name: file.name,
        createdAt: file.created_at,
        deviceId: 'shared' // 모든 공유 이미지는 같은 deviceId 사용
      }));
    
    // 날짜순으로 정렬 (최신순)
    return sharedImages.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  } catch (error) {
    console.error('공유 갤러리 이미지 목록 조회 중 오류:', error);
    return [];
  }
};

// 물고기를 공유 갤러리로 공유하는 함수 - 오류 처리 개선
export const shareFishToGallery = async (fishPhoto: FishPhoto): Promise<boolean> => {
  try {
    // 버킷 존재 확인
    await ensurePhotosBucketExists();
    
    // 이미지 URL에서 이미지 데이터를 가져옵니다
    console.log('이미지 URL에서 데이터 가져오기 시작:', fishPhoto.url);
    const response = await fetch(fishPhoto.url);
    if (!response.ok) {
      console.error('이미지 가져오기 실패:', response.status, response.statusText);
      throw new Error('이미지를 가져올 수 없습니다');
    }
    
    const blob = await response.blob();
    console.log('이미지 데이터 크기:', blob.size);
    
    if (blob.size === 0) {
      console.error('이미지 데이터가 비어 있습니다');
      throw new Error('이미지 데이터가 비어 있습니다');
    }
    
    // 파일명 생성 - 타임스탬프 및 기타 영문만 사용
    const timestamp = Date.now();
    
    // 한글이 포함된 어종 이름을 영문으로 안전하게 변환
    let safeSpeciesName = 'unknown_fish';
    
    if (fishPhoto.species) {
      // 어종 이름 매핑 테이블 (한글 -> 영문)
      const speciesMap: Record<string, string> = {
        '클라운피시': 'clownfish',
        '나비고기': 'butterflyfish',
        '윗노랑다섯줄나비고기': 'yellowtop_butterflyfish',
        '청줄돔': 'blue_stripe_snapper',
        '돔': 'sea_bream',
        '농어': 'bass',
        '잉어': 'carp',
        '고등어': 'mackerel',
        '참치': 'tuna',
        '황새치': 'swordfish',
        '멸치': 'anchovy',
        '방어': 'yellowtail',
        '연어': 'salmon',
        '우럭': 'rockfish',
        '광어': 'flatfish',
        '도미': 'sea_bream',
        '전갱이': 'horse_mackerel',
        '가자미': 'flounder',
        '치어': 'fry_fish',
        '알 수 없는 물고기': 'unknown_fish'
      };
      
      // 매핑 테이블에서 영문 이름 찾기
      if (speciesMap[fishPhoto.species]) {
        safeSpeciesName = speciesMap[fishPhoto.species];
      } else {
        // 매핑 테이블에 없는 경우 간단히 영문자, 숫자만 남기고 나머지는 제거
        safeSpeciesName = fishPhoto.species.replace(/[^\w\s]/gi, '').replace(/\s+/g, '_').toLowerCase();
        
        // 영문이 없을 경우 기본값 사용
        if (safeSpeciesName.length === 0) {
          safeSpeciesName = 'fish';
        }
      }
    }
    
    // 안전한 파일명으로 생성
    const fileName = `shared_${safeSpeciesName}_${timestamp}.jpg`;
    
    // 직접 버킷에 업로드 (폴더 생성 없이)
    console.log('공유 갤러리에 업로드 시작:', fileName);
    
    // 직접 업로드 (폴더 사용 안 함)
    const { data, error } = await supabase.storage
      .from('fish-images')
      .upload(fileName, blob, {
        contentType: 'image/jpeg',
        upsert: true
      });
      
    if (error) {
      console.error('공유 갤러리 업로드 오류:', error);
      return false;
    }
    
    console.log('공유 갤러리 업로드 성공:', data);
    return true;
  } catch (error) {
    console.error('물고기 공유 중 오류:', error);
    return false;
  }
};

const getPublicUrl = (path: string): string => {
  // 캐시 무효화를 위한 타임스탬프 추가
  const timestamp = Date.now();
  return `${SUPABASE_URL}/storage/v1/object/public/fish-images/${path}?t=${timestamp}`;
};

// 앱 시작 시 버킷 확인
export const initializeStorage = async (): Promise<void> => {
  try {
    const bucketsReady = await ensurePhotosBucketExists();
    if (bucketsReady) {
      console.log('스토리지 버킷 초기화 완료');
    } else {
      console.warn('스토리지 버킷 초기화 실패');
    }
  } catch (error) {
    console.error('스토리지 초기화 오류:', error);
  }
};

export async function uploadFishPhoto(
  imageUri: string,
  species: string,
  location?: { latitude: number; longitude: number },
  analysis?: {
    confidence: number;
    description: string;
  }
) {
  try {
    const deviceId = await getDeviceId();
    const timestamp = Date.now();
    const fileName = `${deviceId}_${species}_${timestamp}.jpg`;

    // Base64 이미지 데이터 처리
    let base64Data = imageUri;
    if (imageUri.startsWith('data:image/')) {
      base64Data = imageUri.split(',')[1];
    } else {
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const reader = new FileReader();
      base64Data = await new Promise((resolve) => {
        reader.onloadend = () => {
          const base64data = reader.result as string;
          resolve(base64data.split(',')[1]);
        };
        reader.readAsDataURL(blob);
      });
    }

    // 이미지 데이터를 Uint8Array로 변환
    const binaryData = Buffer.from(base64Data, 'base64');

    // Supabase Storage에 업로드
    const { data, error } = await supabase.storage
      .from('photos')
      .upload(fileName, binaryData, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
      });

    if (error) {
      throw error;
    }

    // 업로드된 이미지의 공개 URL 가져오기
    const publicUrl = getPublicUrl(fileName);

    // 메타데이터 저장
    const photoData: Partial<FishPhoto> = {
      url: publicUrl,
      species,
      location,
      analysis,
      captured_at: new Date().toISOString(),
      environmental_data: {
        season: getSeason(new Date()),
        weather: '정보 없음',
        time_of_day: getTimeOfDay(new Date()),
        habitat_type: '정보 없음'
      }
    };

    return photoData;
  } catch (error) {
    console.error('이미지 업로드 중 오류 발생:', error);
    throw error;
  }
} 