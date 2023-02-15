export interface ILemurXNativeModule {
  connect(dispenserSerial?: string): Promise<string>;
  sendString(sendString: string): Promise<void>;
  receiveData(): Promise<string>;
  disconnect(): Promise<boolean>;
}

type Usage = 'CHILD_WRISTBAND' | 'ADULT_WRISTBAND';

export interface DispenserUsage {
  dispenserType: string;
  serial: string;
  description: string;
  usage: Usage;
}

export type BlobFormat = {
  blockZero: string;
  blockOne: string;
  blockTwo: string;
  blockThree: string;
};

export const LemurNoErrorResponse = 'A';

export type LemurXErrors =
  | '10'
  | '18'
  | '1D'
  | '54'
  | '53'
  | '5A'
  | '52'
  | '57';

export const LemurXErrors = {
  '10': 'Out of Paper',
  '18': 'Paper jam',
  '1D': 'Cutter jam',
  '54': 'Card Timeout',
  '53': 'Tag Failed',
  '5A': 'Card error on encoder',
  '52': 'Tag Failed',
  '57': 'Read Tag / Write Tag Fail',
};
