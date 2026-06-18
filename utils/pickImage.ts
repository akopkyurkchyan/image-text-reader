import { Platform } from 'react-native';
import {
  Asset,
  ImageLibraryOptions,
  launchImageLibrary,
} from 'react-native-image-picker';
import { isIosSimulator } from './device';

export type PickedImage = Pick<
  Asset,
  'uri' | 'fileName' | 'type' | 'width' | 'height' | 'fileSize'
>;

const galleryOptions: ImageLibraryOptions = {
  mediaType: 'photo',
  quality: 0.8,
  selectionLimit: 1,
  presentationStyle: Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen',
};

export async function pickImageFromGallery(): Promise<PickedImage | null> {
  const response = await launchImageLibrary(galleryOptions);

  if (response.didCancel) {
    return null;
  }

  if (response.errorCode) {
    throw new Error(response.errorMessage ?? response.errorCode);
  }

  const asset = response.assets?.[0];

  if (!asset?.uri) {
    throw new Error('No image was returned. Please try again.');
  }

  return asset;
}

export function isIosDevSampleImageVisible(): boolean {
  return Platform.OS === 'ios' && __DEV__ && isIosSimulator();
}
