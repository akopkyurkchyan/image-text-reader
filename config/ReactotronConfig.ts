import Reactotron from 'reactotron-react-native';

const reactotron = Reactotron.configure({
  name: 'Image to Text',
})
  .useReactNative({
    asyncStorage: false,
    networking: {
      ignoreUrls: /symbolicate|localhost:8081|127\.0\.0\.1:8081/,
    },
  })
  .connect();

console.tron = reactotron;

export default reactotron;
