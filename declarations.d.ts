declare module '*.svg' {
  import {SvgProps} from 'react-native-svg';
  const content: React.FC<SvgProps>;
  export default content;
}

declare module '*.png' {
  const value: any;
  export default value;
}

declare module 'react-native-square-reader-sdk';
declare module 'react-native-paper';
declare module 'react-native-scroll-indicator';
