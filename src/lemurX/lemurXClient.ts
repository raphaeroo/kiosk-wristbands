import LemurXBridgeModule from './lemurXBridgeModule';
import type {DispenserUsage} from './interfaces';
import { sleep } from '../utils';

export interface BlockBinaryData {
  SectorID: string;
  BlockID: string;
  BinaryData: string;
}

type SectorList = {
  [key: string]: {
    data: string;
  };
};

export enum LemurXEvents {
  Name = 'LEMUR_X_EVENT_NOTIFICATION',
  Connected = 'CONNECTION_SUCCESSFUL',
  Disconnected = 'DISCONNECTED',
}

export class LemurXClient {
  private _dispenserList?: DispenserUsage[];
  private _dispenserConnected: string | null = null;
  private _readAttempts = 0;

  constructor(dispenserList: DispenserUsage[]) {
    console.log({dispenserList}, 'Dispenser List');

    this._dispenserList = dispenserList;
  }

  private replaceCurrentBlockInfoToCommandCode(
    sectorId: string,
    blockId: string,
  ): string {
    switch (sectorId) {
      case '0':
        return blockId;
      case '1':
        return (Number(blockId) + 4).toString();
      case '2':
        return (Number(blockId) + 8).toString();
      case '3':
        return (Number(blockId) + 12).toString();
      case '4':
        return (Number(blockId) + 16).toString();
      case '5':
        return (Number(blockId) + 20).toString();
      case '6':
        return (Number(blockId) + 24).toString();
      case '7':
        return (Number(blockId) + 28).toString();
      case '8':
        return (Number(blockId) + 32).toString();
      case '9':
        return (Number(blockId) + 36).toString();
      case '10':
        return (Number(blockId) + 40).toString();
      case '11':
        return (Number(blockId) + 44).toString();
      case '12':
        return (Number(blockId) + 48).toString();
      case '13':
        return (Number(blockId) + 52).toString();
      case '14':
        return (Number(blockId) + 56).toString();
      case '15':
        return (Number(blockId) + 60).toString();
      default:
        return '';
    }
  }

  private async waitForDispenserAndTryReadDataAgain(): Promise<string> {
    if (this._readAttempts > 19) {
      return 'No response from dispenser';
    }

    await sleep(100);
    console.log(
      {count: String(this._readAttempts + 1)},
      'Waiting for 100ms to dispenser be ready ',
    );

    this._readAttempts += 1;
    return this.readData();
  }

  public async configureDispenser(): Promise<void> {
    console.log({command: '<cs><s91>'}, 'Configuring dispenser.');

    await LemurXBridgeModule.sendString('<cs><s91>');
    await sleep(500);
  }

  public async dispenseWristband(): Promise<void> {
    console.log('Dispensing a single wristband');

    await LemurXBridgeModule.sendString('<p>');
    await sleep(100);
  }

  public async writeData(data: string): Promise<void> {
    console.log({command: data}, 'Sending command to dispenser');

    await LemurXBridgeModule.sendString(data);
    await sleep(100);
  }

  public async writeBlockData(data: string): Promise<void> {
    console.log({command: data}, 'Writing in the card');

    await LemurXBridgeModule.sendString(data);
    await sleep(100);
  }

  public async readData(): Promise<string> {
    console.log('Reading data from dispenser');

    const data = await LemurXBridgeModule.receiveData();

    if (data.length < 1) {
      return this.waitForDispenserAndTryReadDataAgain();
    }

    await sleep(100);
    return data;
  }

  public async connectToDispenser(dispenserUsage: DispenserUsage['usage']) {
    console.log('Connecting to dispenser');

    if (this._dispenserList && this._dispenserList.length < 2) {
      if (this._dispenserConnected !== null) {
        return;
      } else {
        const dispenser = this._dispenserList[0];

        const res = await LemurXBridgeModule.connect(dispenser.serial);

        this._dispenserConnected =
          res === 'Connected' ? dispenser.serial : null;

        return;
      }
    }

    if (this._dispenserList && this._dispenserList.length > 1) {
      const firstDispenser = this._dispenserList[0];
      const secondDispenser = this._dispenserList[1];

      if (firstDispenser.serial === secondDispenser.serial) {
        const res = await LemurXBridgeModule.connect(firstDispenser.serial);
        console.log('Connect status after connection: ' + res);

        this._dispenserConnected =
          res === 'Connected' ? firstDispenser.serial : null;

        return;
      } else {
        const dispenser = this._dispenserList?.find(
          (dispenser) => dispenser.usage === dispenserUsage,
        );

        if (
          this._dispenserConnected !== null &&
          this._dispenserConnected !== dispenser?.serial
        ) {
          console.log('Disconnecting from the other dispenser first');
          await LemurXBridgeModule.disconnect();
          await sleep(200);
        }

        if (!dispenser) {
          throw new Error('Dispenser not found');
        }

        if (dispenser.serial === this._dispenserConnected) {
          return;
        }

        const res = await LemurXBridgeModule.connect(dispenser.serial);
        console.log('Connect status after connection: ' + res);

        this._dispenserConnected =
          res === 'Connected' ? dispenser.serial : null;

        await sleep(5000);
      }
    }
  }

  public async disconnectIfNecessary() {
    if (this._dispenserList && this._dispenserList.length < 2) {
      return;
    }

    if (this._dispenserList && this._dispenserList.length > 1) {
      const firstDispenser = this._dispenserList[0];
      const secondDispenser = this._dispenserList[1];

      if (firstDispenser.serial === secondDispenser.serial) {
        return;
      }
    }

    console.log('Disconnecting from dispenser');

    const dispenser = this._dispenserList?.find(
      (dispenser) => dispenser.usage === 'CHILD_WRISTBAND',
    );

    if (this._dispenserConnected !== dispenser?.serial) {
      await LemurXBridgeModule.connect(dispenser?.serial);

      await sleep(1000);

      await LemurXBridgeModule.disconnect();
    } else {
      await LemurXBridgeModule.disconnect();
    }
  }

  public parseBlobDataToSectors(blobData: BlockBinaryData[]): SectorList {
    let sectors: SectorList = {};

    blobData.forEach((blockInstruction) => {
      sectors = {
        ...sectors,
        [this.replaceCurrentBlockInfoToCommandCode(
          blockInstruction.SectorID,
          blockInstruction.BlockID,
        )]: {
          data: blockInstruction.BinaryData,
        },
      };
    });

    return sectors;
  }
}
