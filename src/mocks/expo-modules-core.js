/**
 * expo-modules-core의 모의 구현
 * 웹 환경에서 expo-modules-core 모듈을 더 정확하게 모방합니다.
 */

import { EventEmitter, NativeModulesProxy, SharedObject, uuid } from './expo-modules-mock';

export { EventEmitter, NativeModulesProxy, SharedObject, uuid };

// 특별히 요청되는 모듈들에 대한 구현
export const NativeModule = {
  __expo_module_name__: 'NativeModule'
};

export class Subscription {
  constructor(subscriber, listener) {
    this.subscriber = subscriber;
    this.listener = listener;
  }

  remove() {
    if (this.subscriber && this.listener) {
      this.subscriber.removeSubscription(this);
    }
    this.subscriber = null;
    this.listener = null;
  }
}

export const SharedRef = {
  create: (value) => ({
    current: value,
    retain: () => {},
    release: () => {}
  })
};

// 웹 애플리케이션에서 사용하는 등록 함수
export const registerWebModule = () => {};
export const useReleasingSharedObject = () => {};

// 필요한 상수들
export const isRunningInExpoGo = false;

export default {
  EventEmitter,
  NativeModulesProxy,
  NativeModule,
  Subscription,
  SharedObject,
  SharedRef,
  registerWebModule,
  useReleasingSharedObject,
  isRunningInExpoGo,
  uuid
}; 