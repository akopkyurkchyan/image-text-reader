import { Image } from 'react-native';
import RNFS from 'react-native-fs';
import { PickedImage } from './pickImage';

const sampleSource = require('../assets/sample-ocr.png');

export async function loadSampleImage(): Promise<PickedImage> {
  const resolved = Image.resolveAssetSource(sampleSource);
  const fileName = 'sample-ocr.png';
  const destPath = `${RNFS.CachesDirectoryPath}/${fileName}`;

  if (resolved.uri.startsWith('file://')) {
    const sourcePath = resolved.uri.replace('file://', '');

    if (sourcePath !== destPath) {
      await RNFS.copyFile(sourcePath, destPath);
    }

    return {
      uri: `file://${destPath}`,
      fileName,
      type: 'image/png',
    };
  }

  const exists = await RNFS.exists(destPath);
  if (!exists) {
    await RNFS.downloadFile({
      fromUrl: resolved.uri,
      toFile: destPath,
    }).promise;
  }

  return {
    uri: `file://${destPath}`,
    fileName,
    type: 'image/png',
  };
}
