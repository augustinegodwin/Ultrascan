/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = {
  // Use Medium as your "standard" sans for a more modern, bold look
  sans: 'pally-Medium', 
  medium:'pally-Medium',
  regular:'pally-Regular',
  bold: 'pally-Bold',
  
  // Update the defaults so your app uses these everywhere
  default: {
    sans: 'pally-Medium',
    serif: 'serif', // Or a custom serif if you have one
    rounded: 'pally-Medium', 
    mono: 'monospace',
  },

  // If you want to keep the platform-specific logic but use your fonts:
  custom: Platform.select({
    ios: 'pally-Medium',
    android: 'pally-Medium',
    default: 'pally-Medium',
  }),
};
