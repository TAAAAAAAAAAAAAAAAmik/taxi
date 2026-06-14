import { ComponentType, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LucideProps } from 'lucide-react-native';

import { kx } from '../theme/kinetixTheme';

type InfoPanelProps = {
  title: string;
  children: ReactNode;
  Icon: ComponentType<LucideProps>;
  tone?: 'default' | 'warning' | 'success';
};

const toneColors = {
  default: {
    background: kx.surface.card,
    border: kx.border.subtle,
    icon: kx.color.amber,
  },
  warning: {
    background: '#FFF9E8',
    border: kx.color.warning,
    icon: kx.color.warning,
  },
  success: {
    background: '#F1F8F3',
    border: kx.color.success,
    icon: kx.color.success,
  },
};

export function InfoPanel({ title, children, Icon, tone = 'default' }: InfoPanelProps) {
  const colors = toneColors[tone];

  return (
    <View
      style={[
        styles.panel,
        {
          backgroundColor: colors.background,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.header}>
        <Icon color={colors.icon} size={18} strokeWidth={2.4} />
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: 8,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  panel: {
    borderRadius: kx.radius.card,
    borderWidth: 1,
    elevation: 1,
    gap: 10,
    padding: 14,
    shadowColor: kx.color.shadow,
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
  },
  title: {
    color: kx.text.primary,
    flex: 1,
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 20,
  },
});
