module.exports = {
  preset: '@react-native/jest-preset',
  transform: {
    '^.+\\.mjs$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community|-firebase|-google-signin|-async-storage)?|@react-navigation|@invertase|lucide-react-native)/)',
  ],
};
