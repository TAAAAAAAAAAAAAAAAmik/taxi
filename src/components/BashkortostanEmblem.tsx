import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

type Props = {
  size?: number;
};

export function BashkortostanEmblem({ size = 128 }: Props) {
  return (
    <Svg fill="none" height={size} viewBox="0 0 128 128" width={size}>
      <Circle cx="64" cy="64" fill="#FFFFFF" r="58" />
      <Circle cx="64" cy="64" r="58" stroke="#008D49" strokeWidth="5" />
      <Circle cx="64" cy="64" r="48" stroke="#006BB6" strokeWidth="2" />

      <G opacity="0.95">
        <Path d="M64 18L68 44H60L64 18Z" fill="#E7B416" />
        <Path d="M64 110L60 84H68L64 110Z" fill="#E7B416" />
        <Path d="M18 64L44 60V68L18 64Z" fill="#E7B416" />
        <Path d="M110 64L84 68V60L110 64Z" fill="#E7B416" />
        <Path d="M31 31L52 46L46 52L31 31Z" fill="#E7B416" />
        <Path d="M97 31L82 52L76 46L97 31Z" fill="#E7B416" />
        <Path d="M31 97L46 76L52 82L31 97Z" fill="#E7B416" />
        <Path d="M97 97L76 82L82 76L97 97Z" fill="#E7B416" />
      </G>

      <Circle cx="64" cy="57" fill="#F4FAF6" r="31" />
      <Path
        d="M38 73C44 68 50 66 57 67C61 68 64 71 69 70C75 70 79 65 84 60C88 56 92 55 97 57C91 68 82 77 70 80C58 83 47 80 38 73Z"
        fill="#006BB6"
      />
      <Path
        d="M50 65C53 55 59 46 70 37C72 35 73 31 72 28C77 33 77 39 73 44C82 43 89 47 93 55C82 53 73 57 66 64C61 69 55 69 50 65Z"
        fill="#12382C"
      />
      <Path
        d="M61 36C56 39 52 43 49 49C47 45 48 39 52 35C56 32 59 32 61 36Z"
        fill="#008D49"
      />

      <G>
        <Circle cx="64" cy="88" fill="#E7B416" r="4" />
        <Circle cx="64" cy="78" fill="#E7B416" r="4" />
        <Circle cx="55" cy="82" fill="#E7B416" r="4" />
        <Circle cx="73" cy="82" fill="#E7B416" r="4" />
        <Circle cx="56" cy="92" fill="#E7B416" r="4" />
        <Circle cx="72" cy="92" fill="#E7B416" r="4" />
        <Circle cx="64" cy="96" fill="#E7B416" r="4" />
      </G>

      <G>
        <Rect fill="#006BB6" height="5" rx="2.5" width="48" x="40" y="103" />
        <Rect fill="#FFFFFF" height="5" rx="2.5" width="48" x="40" y="108" />
        <Rect fill="#008D49" height="5" rx="2.5" width="48" x="40" y="113" />
      </G>
    </Svg>
  );
}
