import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

const DEVICE_ID_KEY = '@marinetag:device_id';

export const getDeviceId = async (): Promise<string> => {
  try {
    // 저장된 디바이스 ID 확인
    const storedId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (storedId) {
      return storedId;
    }

    // 새로운 디바이스 ID 생성
    const deviceInfo = {
      brand: Device.brand,
      modelName: Device.modelName,
      osName: Platform.OS,
      timestamp: Date.now()
    };
    
    const deviceId = `${deviceInfo.brand}_${deviceInfo.modelName}_${deviceInfo.timestamp}`;
    await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
    
    return deviceId;
  } catch (error) {
    console.error('디바이스 ID 생성 중 오류:', error);
    return 'unknown_device';
  }
};

export const clearDeviceId = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(DEVICE_ID_KEY);
  } catch (error) {
    console.error('디바이스 ID 삭제 중 오류:', error);
  }
}; 