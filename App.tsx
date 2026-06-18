import { useState } from 'react';
import {
  StatusBar,
  useColorScheme,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ImageSelectionScreen from './components/ImageSelectionScreen';
import TextResultScreen from './components/TextResultScreen';

type ExtractedResult = {
  imageUri: string;
  text: string;
};

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [result, setResult] = useState<ExtractedResult | null>(null);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      {result ? (
        <TextResultScreen
          imageUri={result.imageUri}
          initialText={result.text}
          onBack={() => setResult(null)}
        />
      ) : (
        <ImageSelectionScreen
          onTextExtracted={(imageUri: string, text: string) =>
            setResult({ imageUri, text })
          }
        />
      )}
    </SafeAreaProvider>
  );
}

export default App;
