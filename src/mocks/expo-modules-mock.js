/**
 * Expo 모듈의 모의(mock) 구현
 * 웹 환경에서 네이티브 모듈 오류를 방지하기 위한 파일입니다.
 */

// EventEmitter 모의 구현
class EventEmitter {
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

// NativeModulesProxy 모의 구현
const NativeModulesProxy = new Proxy({}, {
  get: function(target, prop) {
    // 모든 모듈이 있는 것처럼 동작하고 기본 구현 제공
    return {
      __expo_module_name__: prop,
      addListener: () => ({ remove: () => {} }),
      removeListeners: () => {},
      // 모듈별 추가 메서드를 여기에 구현할 수 있습니다
    };
  }
});

// 다른 필요한 모의 객체들
const SharedObject = {
  create: () => ({}),
  retain: () => {},
  release: () => {},
};

const getViewManagerConfig = () => ({});
const requireNativeViewManager = () => () => null;

// 공통 오류 메시지 함수
const createUnsupportedError = (methodName) => 
  new Error(`${methodName}는 웹 환경에서 지원되지 않습니다.`);

// UUID 모의 구현
const uuid = {
  v1: () => 'web-mock-uuid-v1-' + Math.random().toString(36).substring(2),
  v4: () => 'web-mock-uuid-v4-' + Math.random().toString(36).substring(2)
};

// 웹에서 Expo 모듈 등록을 위한 빈 함수
const registerWebModule = () => {};
const useReleasingSharedObject = () => null;

// 오류를 던지지 않는 빈 함수들
const noopFn = () => {};

// 기본 내보내기
module.exports = {
  // 클래스
  EventEmitter,
  
  // 주요 객체
  NativeModulesProxy,
  
  // 유틸리티 함수
  getViewManagerConfig,
  requireNativeViewManager,
  createUnsupportedError,
  
  // 네이티브 브리지 유틸리티
  SharedObject,
  uuid,
  
  // 웹 관련
  registerWebModule,
  useReleasingSharedObject,
  
  // 기본 빈 구현
  default: {
    NativeModulesProxy,
    EventEmitter
  }
}; 