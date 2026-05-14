import { ComponentType, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LucideProps } from 'lucide-react-native';

type InfoPanelProps = {
  title: string;
  children: ReactNode;
  Icon: ComponentType<LucideProps>;
  tone?: 'default' | 'warning' | 'success';
};

const toneColors = {
  default: {
    background: '#EEF5F3',
    border: '#C5DDD7',
    icon: '#146C5D',
  },
  warning: {
    background: '#FFF3E5',
    border: '#F3C38A',
    icon: '#C75319',
  },
  success: {
    background: '#EAF6EA',
    border: '#B9DDBB',
    icon: '#26733E',
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
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  title: {
    color: '#20242A',
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
  },
});
