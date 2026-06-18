import { NativeModules, Platform } from 'react-native';

type IsSimulatorModule = {
  isSimulator?: boolean;
};

export function isIosSimulator(): boolean {
  if (Platform.OS !== 'ios') {
    return false;
  }

  const module = NativeModules.IsSimulator as IsSimulatorModule | undefined;
  return module?.isSimulator === true;
}
