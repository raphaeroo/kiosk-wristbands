import {LOG, LoggableObject, Logger, LoggingFunction} from '../../Logger';
import {WRISTBAND_DISPENSING_TAG} from '../EnumsConstantsInterfaces';

const BasicLogger = (LOG as unknown) as Logger;

interface ExtendedLogger extends Logger {
  TAG: string;
  resolveItemsAndLog: (
    loggingFunction: LoggingFunction,
    objectOrString: LoggableObject,
    message?: string,
  ) => void;
}

export const LemurXLogger: ExtendedLogger = {
  TAG: WRISTBAND_DISPENSING_TAG,
  info(objectOrString: LoggableObject, message?: string): void {
    this.resolveItemsAndLog(
      BasicLogger.info.bind(LOG),
      objectOrString,
      message,
    );
  },
  error(objectOrString: LoggableObject, message?: string): void {
    this.resolveItemsAndLog(
      BasicLogger.error.bind(LOG),
      objectOrString,
      message,
    );
  },
  debug(objectOrString: LoggableObject, message?: string): void {
    this.resolveItemsAndLog(
      BasicLogger.debug.bind(LOG),
      objectOrString,
      message,
    );
  },
  resolveItemsAndLog(
    loggingFunction: LoggingFunction,
    objectOrString: LoggableObject,
    message?: string,
  ): void {
    if (typeof objectOrString === 'string') {
      loggingFunction(`${objectOrString} ${this.TAG}`);
    }

    if (typeof objectOrString === 'object') {
      const stringToLog = message ? `${message} ${this.TAG}` : this.TAG;
      loggingFunction(objectOrString, stringToLog);
    }
  },
};
