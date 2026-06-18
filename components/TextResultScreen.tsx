import { useCallback, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppColors } from '../theme/useAppColors';
import { copyTextToClipboard } from '../utils/clipboard';

type TextResultScreenProps = {
  imageUri: string;
  initialText: string;
  onBack: () => void;
};

export default function TextResultScreen({
  initialText,
  onBack,
}: TextResultScreenProps) {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const [text, setText] = useState(initialText);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const dismissKeyboard = useCallback(() => {
    inputRef.current?.blur();
    Keyboard.dismiss();
  }, []);

  const copyAllText = useCallback(async () => {
    dismissKeyboard();

    if (!text.trim()) {
      setCopyMessage('Nothing to copy.');
      return;
    }

    const result = await copyTextToClipboard(text);

    if (!result.ok) {
      setCopyMessage(result.message);
      return;
    }

    setCopyMessage(
      result.method === 'clipboard'
        ? 'Copied full text to clipboard.'
        : 'Opened share sheet with the text.',
    );
  }, [dismissKeyboard, text]);

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}>
      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 16,
          },
        ]}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => {
              dismissKeyboard();
              onBack();
            }}
            style={({ pressed }) => [
              styles.backButton,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}>
            <Text style={[styles.backButtonText, { color: colors.primary }]}>
              Back
            </Text>
          </Pressable>

          <Text style={[styles.title, { color: colors.text }]}>
            Extracted Text
          </Text>
        </View>

        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={setText}
          multiline
          editable
          scrollEnabled
          selectTextOnFocus={false}
          textAlignVertical="top"
          returnKeyType="done"
          blurOnSubmit
          onSubmitEditing={dismissKeyboard}
          onEndEditing={dismissKeyboard}
          placeholder="Recognized text will appear here..."
          placeholderTextColor={colors.textSecondary}
          style={[
            styles.textInput,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              color: colors.text,
            },
          ]}
        />

        {copyMessage ? (
          <Text
            style={[
              styles.copyMessage,
              {
                color: copyMessage.includes('Nothing')
                  ? colors.danger
                  : colors.success,
              },
            ]}>
            {copyMessage}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Copy all text"
          onPress={copyAllText}
          style={({ pressed }) => [
            styles.primaryButton,
            {
              backgroundColor: colors.primary,
              opacity: pressed ? 0.85 : 1,
            },
          ]}>
          <Text style={[styles.primaryButtonText, { color: colors.primaryText }]}>
            Copy All
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    gap: 12,
  },
  header: {
    gap: 12,
  },
  backButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    lineHeight: 24,
    flex: 1,
    height: '100%',
  },
  copyMessage: {
    fontSize: 13,
    textAlign: 'center',
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
});
