import {NativeModules} from 'react-native';
import type {ILemurXNativeModule} from './interfaces';

const {LemurXBridge} = NativeModules;
const typedLemurXBridge = LemurXBridge as ILemurXNativeModule;

class LemurXModule implements ILemurXNativeModule {
  connect(dispenserSerial?: string): Promise<string> {
    return typedLemurXBridge.connect(dispenserSerial);
  }

  sendString(data: string): Promise<void> {
    return typedLemurXBridge.sendString(data);
  }

  receiveData(): Promise<string> {
    return typedLemurXBridge.receiveData();
  }

  disconnect(): Promise<boolean> {
    return typedLemurXBridge.disconnect();
  }
}

const LemurXBridgeModule = new LemurXModule();
export default LemurXBridgeModule;
