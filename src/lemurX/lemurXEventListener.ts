import {NativeModules, NativeEventEmitter} from 'react-native';

let eventListener: NativeEventEmitter;

export const lemurXNativeEventListener = (): NativeEventEmitter => {
  if (!eventListener) {
    eventListener = new NativeEventEmitter(
      NativeModules.ReactNativeEventEmitter,
    );
  }

  return eventListener;
};
