import { Image, StyleSheet, View } from 'react-native';

type Props = {
  size?: number;
};

const coatOfArms = require('../../assets/bashkortostan-coat-of-arms.png');

export function BashkortostanEmblem({ size = 128 }: Props) {
  return (
    <View style={[styles.wrap, { height: size, width: size }]}>
      <Image
        accessibilityLabel="Герб Республики Башкортостан"
        resizeMode="contain"
        source={coatOfArms}
        style={styles.image}
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
