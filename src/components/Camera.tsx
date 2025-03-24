import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, Platform, Image, ActivityIndicator, Animated } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { MaterialIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { analyzeFishImage, FishAnalysis } from '../services/vision';
import { uploadFishPhoto } from '../services/storage';
import { useTranslation } from '../i18n';
import { LinearGradient } from 'expo-linear-gradient';

interface CameraProps {
  onCapture: (uri: string, analysis: FishAnalysis | null, location: { latitude: number; longitude: number } | null) => void;
}

const Camera: React.FC<CameraProps> = ({ onCapture }) => {
  const { t } = useTranslation();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [latestImage, setLatestImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<FishAnalysis | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        const [cameraStatus, locationStatus] = await Promise.all([
          ImagePicker.requestCameraPermissionsAsync(),
          Location.requestForegroundPermissionsAsync()
        ]);
        setHasPermission(cameraStatus.status === 'granted' && locationStatus.status === 'granted');
      } else {
        setHasPermission(true);
      }
    })();
  }, []);

  // 펄스 애니메이션 효과
  useEffect(() => {
    if (isAnalyzing) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isAnalyzing, pulseAnim]);

  const getCurrentLocation = async () => {
    if (Platform.OS === 'web') {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });
        return {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
      } catch (error) {
        console.error(t('location.permission'), error);
        return null;
      }
    } else {
      try {
        const location = await Location.getCurrentPositionAsync({});
        return {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        };
      } catch (error) {
        console.error(t('location.permission'), error);
        return null;
      }
    }
  };

  const handleCapture = async () => {
    if (Platform.OS === 'web') {
      // 웹에서는 파일 선택 다이얼로그 사용
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e: Event) => {
        const target = e.target as HTMLInputElement;
        if (target.files && target.files[0]) {
          const file = target.files[0];
          const reader = new FileReader();
          reader.onload = async (e) => {
            const imageUri = e.target?.result as string;
            setLatestImage(imageUri);
            setIsAnalyzing(true);
            processImageInBackground(imageUri);
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
      return;
    }
    
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const capturedImage = result.assets[0].uri;
        setLatestImage(capturedImage);
        setIsAnalyzing(true);
        processImageInBackground(capturedImage);
      }
    } catch (error) {
      console.error(t('camera.permission'), error);
      setIsAnalyzing(false);
    }
  };
  
  const processImageInBackground = async (imageUri: string) => {
    try {
      // 위치 정보 가져오기 (병렬 실행)
      const locationPromise = getCurrentLocation();
      
      // 이미지 분석 시작
      const analysis = await analyzeFishImage(imageUri);
      setAnalysisResult(analysis);
      setIsAnalyzing(false);
      
      // 위치 정보 가져오기 완료 대기
      const location = await locationPromise;
      
      // 이미지 업로드 진행 (사용자에게 결과는 보여주되, 업로드는 백그라운드로)
      if (analysis.isFish) {
        setIsUploading(true);
        await uploadFishPhoto(
          imageUri,
          analysis.species,
          location || undefined,
          {
            confidence: analysis.confidence,
            description: analysis.description
          }
        );
        setIsUploading(false);
      }
      
      // 갤러리 새로고침을 위한 콜백 호출
      onCapture(imageUri, analysis, location);
    } catch (error) {
      console.error('이미지 처리 오류:', error);
      setIsAnalyzing(false);
      setIsUploading(false);
    }
  };

  const goToGallery = () => {
    // 분석 완료된 상태에서 사용자가 버튼을 눌러 갤러리로 이동
    if (latestImage && analysisResult) {
      onCapture(latestImage, analysisResult, null);
    }
  };

  if (hasPermission === null) {
    return <View style={styles.container} />;
  }
  
  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{t('camera.permission')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.previewContainer}>
        {latestImage ? (
          <>
            <Image source={{ uri: latestImage }} style={styles.preview} />
            {isAnalyzing && (
              <View style={styles.analysisOverlay}>
                <Animated.View style={[styles.loadingIconContainer, { transform: [{ scale: pulseAnim }] }]}>
                  <FontAwesome5 name="fish" size={50} color="#4CAF50" />
                  <ActivityIndicator size="large" color="#ffffff" style={styles.loadingIndicator} />
                </Animated.View>
                <Text style={styles.analysisText}>{t('common.loading')}</Text>
              </View>
            )}
            {analysisResult && !isAnalyzing && analysisResult.isFish && (
              <LinearGradient
                colors={['transparent', 'rgba(0, 0, 0, 0.8)']}
                style={styles.resultOverlay}
              >
                <View style={styles.resultContent}>
                  <FontAwesome5 name="fish" size={32} color="#4CAF50" style={styles.fishIcon} />
                  <Text style={styles.fishSpeciesText}>
                    {analysisResult.species || t('fish.unknown')}
                  </Text>
                  {analysisResult.description && (
                    <Text style={styles.fishDescriptionText}>
                      {analysisResult.description}
                    </Text>
                  )}
                  
                  <View style={styles.actionButtonsContainer}>
                    <TouchableOpacity
                      style={styles.galleryButton}
                      onPress={goToGallery}
                    >
                      <MaterialIcons name="photo-library" size={24} color="white" />
                      <Text style={styles.buttonText}>{t('common.gallery')}</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.captureButton}
                      onPress={() => {
                        setLatestImage(null);
                        setAnalysisResult(null);
                      }}
                    >
                      <MaterialIcons name="camera-alt" size={24} color="white" />
                      <Text style={styles.buttonText}>{t('common.takePicture')}</Text>
                    </TouchableOpacity>
                  </View>
                  
                  {isUploading && (
                    <View style={styles.uploadingContainer}>
                      <ActivityIndicator size="small" color="#4CAF50" />
                      <Text style={styles.uploadingText}>
                        {t('common.uploading')}...
                      </Text>
                    </View>
                  )}
                </View>
              </LinearGradient>
            )}
            {analysisResult && !isAnalyzing && !analysisResult.isFish && (
              <LinearGradient
                colors={['transparent', 'rgba(0, 0, 0, 0.8)']}
                style={styles.resultOverlay}
              >
                <View style={styles.resultContent}>
                  <Ionicons name="close-circle" size={36} color="#FF5252" style={styles.notFishIcon} />
                  <Text style={styles.fishSpeciesText}>{t('fish.notFish')}</Text>
                  <TouchableOpacity
                    style={styles.captureButton}
                    onPress={() => {
                      setLatestImage(null);
                      setAnalysisResult(null);
                    }}
                  >
                    <MaterialIcons name="camera-alt" size={24} color="white" />
                    <Text style={styles.buttonText}>{t('common.takePicture')}</Text>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            )}
          </>
        ) : (
          <View style={styles.placeholderPreview}>
            <FontAwesome5 name="fish" size={60} color="#4CAF50" style={styles.placeholderIcon} />
            <Text style={styles.placeholderText}>{t('camera.takePhoto')}</Text>
            <Text style={styles.placeholderText}>🐠 {t('common.appName')} 🐠</Text>
          </View>
        )}
      </View>
      
      {!latestImage && (
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.mainCaptureButton} 
            onPress={handleCapture}
            disabled={isAnalyzing}
          >
            <View style={styles.innerCaptureButton}>
              <MaterialIcons name="camera-alt" size={30} color="white" />
            </View>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  previewContainer: {
    flex: 1,
    margin: 0,
  },
  preview: {
    flex: 1,
    resizeMode: 'cover',
  },
  placeholderPreview: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  placeholderIcon: {
    marginBottom: 20,
    opacity: 0.8,
  },
  placeholderText: {
    color: 'white',
    fontSize: 16,
    marginBottom: 10,
    textAlign: 'center',
  },
  errorText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 50,
  },
  buttonContainer: {
    height: 120,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  mainCaptureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(76, 175, 80, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  innerCaptureButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    minWidth: 120,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  galleryButton: {
    minWidth: 120,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginHorizontal: 5,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  captureButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  analysisOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingIconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  loadingIndicator: {
    position: 'absolute',
    top: -5,
  },
  resultOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 30,
  },
  resultContent: {
    width: '100%',
    padding: 24,
    alignItems: 'center',
  },
  fishIcon: {
    marginBottom: 16,
  },
  notFishIcon: {
    marginBottom: 16,
  },
  fishSpeciesText: {
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-Bold, System' : 'Pretendard-Bold, Roboto',
  },
  fishDescriptionText: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: '90%',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0.5, height: 0.5 },
    textShadowRadius: 1,
    fontFamily: Platform.OS === 'ios' ? 'Pretendard-Regular, System' : 'Pretendard-Regular, Roboto',
    marginBottom: 30,
  },
  analysisText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0.5, height: 0.5 },
    textShadowRadius: 1,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
    width: '100%',
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  uploadingText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 8,
  },
});

export default Camera; 