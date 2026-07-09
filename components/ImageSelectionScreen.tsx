import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  NativeModules,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TurboModuleRegistry,
  View,
} from 'react-native';
import {
  Asset,
  CameraOptions,
  launchCamera,
} from 'react-native-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppColors } from '../theme/useAppColors';
import {
  isIosDevSampleImageVisible,
  pickImageFromGallery,
} from '../utils/pickImage';
import { loadSampleImage } from '../utils/sampleImage';
import {
  extractTextFromImage,
  isMlkitOcrLinked,
  OCR_NATIVE_MODULE_ERROR,
} from '../utils/ocr';

type ImageSelectionScreenProps = {
  onTextExtracted: (imageUri: string, text: string) => void;
};

const cameraOptions: CameraOptions = {
  mediaType: 'photo',
  quality: 0.8,
  presentationStyle: 'fullScreen',
};

const NATIVE_MODULE_ERROR =
  'Image picker is not linked. Stop the app, then rebuild with: npm run ios';

function isImagePickerLinked(): boolean {
  if (Platform.OS === 'web') {
    return true;
  }

  const isTurboModuleEnabled =
    (global as typeof global & { __turboModuleProxy?: unknown })
      .__turboModuleProxy != null;

  if (isTurboModuleEnabled) {
    return TurboModuleRegistry.get('ImagePicker') != null;
  }

  return NativeModules.ImagePicker != null;
}

async function requestCameraPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  const hasPermission = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.CAMERA,
  );

  if (hasPermission) {
    return true;
  }

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.CAMERA,
    {
      title: 'Camera Permission',
      message: 'Image to Text needs camera access to take photos.',
      buttonNeutral: 'Ask Me Later',
      buttonNegative: 'Cancel',
      buttonPositive: 'OK',
    },
  );

  return result === PermissionsAndroid.RESULTS.GRANTED;
}

function getErrorMessage(errorCode?: string, errorMessage?: string): string {
  if (errorCode === 'permission') {
    return 'Permission denied. Enable camera or photo access in settings.';
  }

  if (errorCode === 'camera_unavailable') {
    return 'Camera is not available on this device.';
  }

  return errorMessage ?? 'Something went wrong while selecting an image.';
}

export default function ImageSelectionScreen({
  onTextExtracted,
}: ImageSelectionScreenProps) {
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const [selectedImage, setSelectedImage] = useState<Asset | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPickerLinked, setIsPickerLinked] = useState(true);

  useEffect(() => {
    const linked = isImagePickerLinked();
    setIsPickerLinked(linked);

    if (!linked) {
      setError(NATIVE_MODULE_ERROR);
    }
  }, []);

  const handlePickerResult = useCallback((asset?: Asset) => {
    if (!asset?.uri) {
      setError('No image was returned. Please try again.');
      return;
    }

    setSelectedImage(asset);
    setError(null);
  }, []);

  const showExtractError = useCallback((message: string) => {
    setError(message);
    Alert.alert('Text extraction failed', message);
  }, []);

  const openCamera = useCallback(async () => {
    if (!isPickerLinked) {
      setError(NATIVE_MODULE_ERROR);
      return;
    }

    setError(null);

    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      setError('Camera permission is required to take a photo.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await launchCamera(cameraOptions);

      if (response.didCancel) {
        return;
      }

      if (response.errorCode) {
        setError(getErrorMessage(response.errorCode, response.errorMessage));
        return;
      }

      handlePickerResult(response.assets?.[0]);
    } finally {
      setIsLoading(false);
    }
  }, [handlePickerResult, isPickerLinked]);

  const openSampleImage = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      const asset = await loadSampleImage();
      handlePickerResult(asset);
    } catch (sampleError) {
      const message =
        sampleError instanceof Error
          ? sampleError.message
          : 'Failed to load the sample image.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [handlePickerResult]);

  const openGallery = useCallback(async () => {
    if (!isPickerLinked) {
      setError(NATIVE_MODULE_ERROR);
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const asset = await pickImageFromGallery();

      if (!asset) {
        return;
      }

      handlePickerResult(asset);
    } catch (galleryError) {
      const message =
        galleryError instanceof Error
          ? galleryError.message
          : 'Failed to open the photo library.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [handlePickerResult, isPickerLinked]);

  const clearImage = useCallback(() => {
    setSelectedImage(null);
    setError(null);
  }, []);

  const confirmClearImage = useCallback(() => {
    Alert.alert('Remove image?', 'This will clear the selected photo.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: clearImage },
    ]);
  }, [clearImage]);

  const extractText = useCallback(async () => {
    if (!selectedImage?.uri) {
      showExtractError('Select an image before extracting text.');
      return;
    }

    if (!isMlkitOcrLinked()) {
      showExtractError(OCR_NATIVE_MODULE_ERROR);
      return;
    }

    setError(null);
    setIsExtracting(true);

    try {
      const text = await extractTextFromImage(selectedImage.uri);
      onTextExtracted(selectedImage.uri, text);
    } catch (extractError) {
      const message =
        extractError instanceof Error
          ? extractError.message
          : 'Failed to extract text from the image.';
      showExtractError(message);
    } finally {
      setIsExtracting(false);
    }
  }, [onTextExtracted, selectedImage, showExtractError]);

  const isBusy = isLoading || isExtracting;
  const showDevSampleImage = isIosDevSampleImageVisible();

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 16,
        },
      ]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>
          Image to Text
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Take a photo or choose one from your library to extract text.
        </Text>
      </View>

      <View
        style={[
          styles.previewCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}>
        {selectedImage?.uri ? (
          <Image
            source={{ uri: selectedImage.uri }}
            style={styles.previewImage}
            resizeMode="contain"
            accessibilityLabel="Selected image preview"
          />
        ) : (
          <View style={styles.placeholder}>
            <Text style={[styles.placeholderTitle, { color: colors.text }]}>
              No image selected
            </Text>
            <Text
              style={[styles.placeholderText, { color: colors.textSecondary }]}>
              Your selected photo will appear here.
            </Text>
          </View>
        )}

        {isBusy ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
            {isExtracting ? (
              <Text style={[styles.loadingText, { color: colors.primaryText }]}>
                Reading text...
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      {selectedImage ? (
        <Text style={[styles.metaText, { color: colors.textSecondary }]}>
          {selectedImage.fileName ?? 'Selected image'}
          {selectedImage.width && selectedImage.height
            ? ` · ${selectedImage.width} x ${selectedImage.height}`
            : ''}
        </Text>
      ) : null}

      {error ? (
        <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
      ) : null}

      <View style={styles.actions}>
        {selectedImage ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Extract text from image"
            disabled={isBusy}
            onPress={extractText}
            style={({ pressed }) => [
              styles.primaryButton,
              {
                backgroundColor: colors.primary,
                opacity: pressed || isBusy ? 0.85 : 1,
              },
              isBusy ? styles.disabledButton : null,
            ]}>
            <Text style={[styles.primaryButtonText, { color: colors.primaryText }]}>
              {isExtracting ? 'Reading text...' : 'Extract Text'}
            </Text>
          </Pressable>
        ) : null}

        {!selectedImage ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose from gallery"
            disabled={isBusy || !isPickerLinked}
            onPress={openGallery}
            style={({ pressed }) => [
              styles.primaryButton,
              {
                backgroundColor: colors.primary,
                opacity: pressed || isBusy ? 0.85 : 1,
              },
            ]}>
            <Text style={[styles.primaryButtonText, { color: colors.primaryText }]}>
              Choose from Gallery
            </Text>
          </Pressable>
        ) : null}

        {showDevSampleImage && !selectedImage ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Use sample image"
            disabled={isBusy}
            onPress={openSampleImage}
            style={({ pressed }) => [
              styles.secondaryButton,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: pressed || isBusy ? 0.85 : 1,
              },
            ]}>
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
              Use Sample Image
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Take photo"
          disabled={isBusy || !isPickerLinked}
          onPress={openCamera}
          style={({ pressed }) => [
            styles.secondaryButton,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: pressed || isBusy ? 0.85 : 1,
            },
          ]}>
          <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
            Take Photo
          </Text>
        </Pressable>

        {selectedImage ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear selected image"
            disabled={isBusy}
            onPress={confirmClearImage}
            style={({ pressed }) => [
              styles.secondaryButton,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: pressed || isBusy ? 0.85 : 1,
              },
            ]}>
            <Text style={[styles.secondaryButtonText, { color: colors.danger }]}>
              Clear Image
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 20,
    gap: 16,
  },
  header: {
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  previewCard: {
    flex: 1,
    minHeight: 280,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 8,
  },
  placeholderTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  placeholderText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 21,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '600',
  },
  metaText: {
    fontSize: 13,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  actions: {
    gap: 12,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.7,
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
