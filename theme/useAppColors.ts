import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

export type AppColors = {
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  primary: string;
  primaryText: string;
  border: string;
  danger: string;
  success: string;
};

export function useAppColors(): AppColors {
  const isDarkMode = useColorScheme() === 'dark';

  return useMemo(
    () =>
      isDarkMode
        ? {
            background: '#101014',
            surface: '#1c1c22',
            text: '#f5f5f7',
            textSecondary: '#a1a1aa',
            primary: '#5b8cff',
            primaryText: '#ffffff',
            border: '#2f2f37',
            danger: '#ff6b6b',
            success: '#34d399',
          }
        : {
            background: '#f2f2f7',
            surface: '#ffffff',
            text: '#111827',
            textSecondary: '#6b7280',
            primary: '#2563eb',
            primaryText: '#ffffff',
            border: '#e5e7eb',
            danger: '#dc2626',
            success: '#059669',
          },
    [isDarkMode],
  );
}
