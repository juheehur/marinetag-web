/**
 * Expo 모듈의 모의(mock) 구현
 * 웹 환경에서 네이티브 모듈 오류를 방지하기 위한 파일입니다.
 */

// EventEmitter 모의 구현
export class EventEmitter {
  constructor() {
    this.listeners = {};
  }

  addListener(eventName, listener) {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }
    this.listeners[eventName].push(listener);
    return { remove: () => this.removeListener(eventName, listener) };
  }

  removeListener(eventName, listener) {
    if (!this.listeners[eventName]) return;
    const index = this.listeners[eventName].indexOf(listener);
    if (index !== -1) {
      this.listeners[eventName].splice(index, 1);
    }
  }

  emit(eventName, ...args) {
    if (!this.listeners[eventName]) return;
    this.listeners[eventName].forEach(listener => {
      listener(...args);
    });
  }
}

// NativeModule 클래스 구현
export class NativeModule {
  constructor(moduleName) {
    this.__expo_module_name__ = moduleName;
  }
}

// NativeModulesProxy 모의 구현
export const NativeModulesProxy = new Proxy({}, {
  get: function(target, prop) {
    // 모든 모듈이 있는 것처럼 동작하고 기본 구현 제공
    if (!target[prop]) {
      target[prop] = new NativeModule(prop);
    }
    return target[prop];
  }
});

// 가장 자주 사용되는 Expo 모듈들을 미리 정의
export const ExpoModulesCore = {
  NativeModulesProxy,
  EventEmitter,
  NativeModule
};

// SharedObject 모의 구현
export const SharedObject = {
  create: () => ({}),
  retain: () => {},
  release: () => {},
};

// SharedRef 모의 구현
export class SharedRef {
  constructor(value) {
    this.value = value;
  }
  
  get current() {
    return this.value;
  }
  
  release() {}
}

// 뷰 관련 유틸리티
export const getViewManagerConfig = (name) => ({
  name,
  // 기본 속성들
  propTypes: {},
  directEventTypes: {},
});

export const requireNativeViewManager = () => () => null;

// 오류 생성 헬퍼
export const createUnsupportedError = (methodName) => 
  new Error(`${methodName}는 웹 환경에서 지원되지 않습니다.`);

// UUID 모의 구현
export const uuid = {
  v1: () => 'web-mock-uuid-v1-' + Math.random().toString(36).substring(2),
  v4: () => 'web-mock-uuid-v4-' + Math.random().toString(36).substring(2)
};

// Expo 환경 관련 함수
export const isRunningInExpoGo = false;
export const registerWebModule = () => {};
export const useReleasingSharedObject = () => null;

// 추가 네이티브 모듈들의 모의 구현
export const Image = {
  getSize: (uri, success, failure) => {
    const img = new window.Image();
    img.onload = () => { success(img.width, img.height); };
    img.onerror = failure;
    img.src = uri;
  },
  prefetch: () => Promise.resolve()
};

export const Camera = {
  Constants: {
    Type: { front: 'front', back: 'back' },
    FlashMode: { on: 'on', off: 'off', auto: 'auto', torch: 'torch' }
  }
};

// default export는 동시에 모든 named exports를 포함
export default {
  NativeModulesProxy,
  EventEmitter,
  SharedObject,
  SharedRef,
  getViewManagerConfig,
  requireNativeViewManager,
  createUnsupportedError,
  uuid,
  isRunningInExpoGo,
  registerWebModule,
  useReleasingSharedObject,
  Image,
  Camera
}; 