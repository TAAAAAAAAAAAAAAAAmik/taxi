import { Image, Platform, StyleSheet, View } from 'react-native';

type Props = {
  size?: number;
  // muted — приглушённый герб в тон тёмной сцены (для угла hero), чтобы
  // яркий цветной герб не читался как случайный стикер.
  tone?: 'full' | 'muted';
};

const coatOfArms = require('../../assets/bashkortostan-coat-of-arms.png');

export function BashkortostanEmblem({ size = 128, tone = 'full' }: Props) {
  const mutedStyle =
    tone === 'muted' && Platform.OS === 'web'
      ? ({ filter: 'grayscale(0.6) brightness(1.12) contrast(0.95)', opacity: 0.82 } as const)
      : tone === 'muted'
      ? { opacity: 0.82 }
      : null;

  return (
    <View style={[styles.wrap, { height: size, width: size }]}>
      <Image
        accessibilityLabel="Герб Республики Башкортостан"
        resizeMode="contain"
        source={coatOfArms}
        style={[styles.image, mutedStyle]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    height: '100%',
    width: '100%',
  },
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
