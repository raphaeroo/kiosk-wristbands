import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useLayoutEffect,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  FlatList,
  Switch,
  TouchableOpacity,
  NativeEventEmitter,
  NativeModules,
} from 'react-native';
import RoomAccessLogo from '../assets/images/room-access.svg';
import AllowChargingLogo from '../assets/images/allow-charging.svg';
import Info from '../assets/images/info.svg';
import {Modal, ActivityIndicator} from 'react-native-paper';
import {
  LemurXClient,
  DispenserUsage,
  LemurNoErrorResponse,
  LemurXEvents,
  useLemurXContext,
} from './lemurX';
import dayjs, {Dayjs} from 'dayjs';
import { blob, sleep } from './utils';
import { Button } from 'react-native-paper';

const checkMark = require('../assets/images/greenCheck.png');
const disabledCheckMark = require('../assets/images/grayCheck.png');
const wristbandDispensingError = require('../assets/images/wristbandDispensingError.png');
const thumbsUp = require('../assets/images/thumbsUp.png');
const wristbandDispensingFinished = require('../assets/images/wristband-finish.png');

const LemurXListener = new NativeEventEmitter(NativeModules.LemurXBridge);

const dispenserErrors = {
  'Out of Tickets': 'Out of tickets',
  'Ticket Jam': 'Ticket Jam',
  'Cutter Jam': 'Cutter Jam',
  'Tag Failed': 'Tag Failed',
  'No response from dispenser': 'No response from dispenser',
};

const RFIDErrors = {
  S: 'Tag Failed',
  R: 'Read Failed',
  W: 'Write Failed',
  T: 'Card Timeout',
  Z: 'RFID Encoder Error',
  A: 'No error',
};

type RFIDResponses = keyof typeof RFIDErrors;

type ScreenGuest = {
  name: string;
  status: string;
  isChild: boolean;
};

type KioskInfo = {
  dispenserConfig: DispenserUsage[];
  dispenserType: 'LEMUR_X';
};

interface IGuestListItem {
  active: boolean;
  finished: boolean;
  name: string;
  status: string;
  guestOrder: number;
  guestBackgroundColor: string;
}

interface ScreenProps {
  navigation: any
}

let generalKioskId: String = '';

const accessGrant = {
  id: '5f9f1b0b-8c1c-4b1c-8c1c-5f9f1b0b8c1c',
}

export const WristbandDispensing = ({navigation}: ScreenProps) => {
  const [
    {isDispenserConnected, isDispenserConfigured},
    dispatch,
  ] = useLemurXContext();
  const [currentGuest, setCurrentGuest] = useState(0);
  const [guestsCompleted, setGuestCompleted] = useState<number[]>([]);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isAllWristbandsDispensed, setAllWristbandsDispensed] = useState(false);
  const [currentGuestWristbandOptions, setGuestWristbandOptions] = useState({
    roomAccess: false,
    allowCharging: false,
  });
  const [guests, setGuests] = useState<ScreenGuest[]>([]);

  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [errorModalIsVisible, setErrorModalIsVisible] = useState(false);
  const [
    dispenseConfirmationModalVisible,
    setDispenseConfirmationModalVisible,
  ] = useState(false);
  const [isDispensingWristband, setIsDispensingWristband] = useState(false);
  const [
    dispensingWristbandModalVisible,
    setDispensingWristbandModalVisible,
  ] = useState(false);

  const getGuestCount = useCallback(async () => {
    if (!accessGrant?.id) {
      setErrorModalIsVisible(true);

      return;
    }
    const guestCount = { adults: 2, children: 1, total: 3 };

    return guestCount;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    getGuestCount()
      .then((guestCount) => {
        console.log({guestCount}, 'Checking guest count');
        if (guestCount) {
          const adults = guestCount.adults;
          const children = guestCount.children;

          const adultList = Array.from({length: adults}, (_, i) => ({
            name: `Adult ${i + 1}`,
            status: i === 0 ? 'Primary Guest' : 'Secondary Guest',
            isChild: false,
          }));

          const childrenList = Array.from({length: children}, (_, i) => ({
            name: `Child ${i + 1}`,
            status: 'Secondary Guest',
            isChild: true,
          }));

          setGuests([...adultList, ...childrenList]);
        }
      })
      .catch(() => {
        setErrorModalIsVisible(true);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const LemurClient = useRef<LemurXClient>();

  const bootstrap = useCallback(async () => {
    const {kioskInfo, kioskId} = {
      kioskInfo: {
        dispenserConfig: [
          {
            dispenserType: 'LEMUR_X',
            serial: '12345', // CHANGE THIS VALUE TO THE SERIAL NUMBER OF THE LEMUR X DISPENSER
            description: '',
            usage: '',
          }
        ],
        dispenserType: 'LEMUR_X',
      },
      kioskId: '12345678910219281'
    };

    generalKioskId = kioskId;

    console.log({kioskInfo, kioskId}, 'Kiosk info');

    if (!kioskInfo) {
      setIsLoadingSettings(false);
      setErrorModalIsVisible(true);

      return;
    }

    LemurClient.current = new LemurXClient(kioskInfo.dispenserConfig as DispenserUsage[]);
    setIsLoadingSettings(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const styles = createStyles();

  const checkIfGuestFinished = useCallback(
    (guestIndex: number) => {
      const guest = guestsCompleted.find((guest) => guestIndex === guest);

      return guest !== undefined;
    },
    [guestsCompleted],
  );

  const onContinueButtonPress = () => {
    if (guestsCompleted.length === guests.length) {
      setAllWristbandsDispensed(true);
      setDispensingWristbandModalVisible(false);
    } else {
      setDispensingWristbandModalVisible(false);
    }
  };

  const finishCurrentGuestAndProceed = useCallback(() => {
    setDispenseConfirmationModalVisible(false);
    setIsDispensingWristband(false);
    setGuestCompleted([...guestsCompleted, currentGuest]);
    setGuestWristbandOptions({allowCharging: false, roomAccess: false});
    if (currentGuest + 1 < guests.length) {
      setCurrentGuest(currentGuest + 1);
    } else {
      setAllWristbandsDispensed(true);
    }
  }, [currentGuest, guests.length, guestsCompleted]);

  const getSerialNumber = async () => {
    if (LemurClient.current) {
      await LemurClient.current.writeData('<RFC>');
      await LemurClient.current.writeData('<RFSN2,1>');
      const serialNumber = await LemurClient.current.readData();

      console.log(
        {serialNumber, kioskId: generalKioskId},
        'Checking wristband serial number',
      );

      if (serialNumber === 'No response from dispenser') {
        return null;
      }

      return serialNumber;
    }
  };

  const sendLowPaperEmailIfNeeded = async (): Promise<void> => {
    console.log(
      {kioskId: generalKioskId},
      'Checking if we should send low paper status email to the client',
    );

    const now: Dayjs = dayjs();
    const key = 'LAST_LOW_PAPER_EMAIL_SENT_AT';

    const lastLowPaperEmailSentAt = now;

    console.log(
      {lastLowPaperEmailSentAt, kioskId: generalKioskId},
      'Last low paper sent Dayjs object fetched from the local storage',
    );

    const noEmailsSentBefore = lastLowPaperEmailSentAt === undefined;
    const lastEmailWasSentMoreThanTenMinutesAgo =
      lastLowPaperEmailSentAt?.diff(now, 'm') ?? 0 > 10;

    if (noEmailsSentBefore || lastEmailWasSentMoreThanTenMinutesAgo) {
      console.log(
        {kioskId: generalKioskId},
        'Sending low paper alert email',
      );

    } else {
      console.log(
        {kioskId: generalKioskId},
        'The last low paper email was sent less than 10 minutes ago. No need to send a new one for now.',
      );
    }
  };

  const prepareToDispense = async () => {
    if (LemurClient.current) {
      const guestHasRoomAccess = currentGuestWristbandOptions.roomAccess;
      const guestHasChargingAllowed =
        currentGuestWristbandOptions.allowCharging;
      const thisGuest = guests[currentGuest];

      console.log(
        {
          guestHasRoomAccess: currentGuest === 0 || guestHasRoomAccess,
          guestHasChargingAllowed,
          kioskId: generalKioskId,
        },
        'Checking guest options',
      );

      setDispenseConfirmationModalVisible(false);
      setIsDispensingWristband(true);
      setDispensingWristbandModalVisible(true);

      if (isDispenserConnected) {
        dispense();
      } else {
        if (thisGuest.isChild) {
          await LemurClient.current.connectToDispenser('CHILD_WRISTBAND');
        } else {
          await LemurClient.current.connectToDispenser('ADULT_WRISTBAND');
        }
      }
    }
  };

  const dispense = useCallback(async () => {
    await sleep(1000);

    try {
      if (LemurClient.current) {
        if (!isDispenserConfigured) {
          await LemurClient.current.configureDispenser();

          dispatch && dispatch({isDispenserConfigured: true});
        }
        const guestHasRoomAccess = currentGuestWristbandOptions.roomAccess;
        const guestHasChargingAllowed =
          currentGuestWristbandOptions.allowCharging;

        await LemurClient.current.writeData('<S92>');
        const dispenserStatus = await LemurClient.current.readData();

        console.log(
          {dispenserStatus, kioskId: generalKioskId},
          'Checking dispenser status',
        );

        const hasError = dispenserStatus in dispenserErrors;

        if (dispenserStatus === 'Low Paper') {
          sendLowPaperEmailIfNeeded();
        }

        if (hasError) {
          console.log(
            {
              kioskId: generalKioskId,
              error: dispenserStatus,
            },
            'Dispenser error was found on checking status',
          );

          setDispenseConfirmationModalVisible(false);
          setErrorModalIsVisible(true);

          return;
        }

        if (
          currentGuest !== 0 &&
          !guestHasRoomAccess &&
          !guestHasChargingAllowed
        ) {
          await LemurClient.current.dispenseWristband();
          finishCurrentGuestAndProceed();

          return;
        }

        const chipSerialNumber = await getSerialNumber();

        console.log({chipSerialNumber}, 'Chip Serial Number');

        if (!accessGrant?.id || !chipSerialNumber) {
          setIsDispensingWristband(false);
          setDispensingWristbandModalVisible(false);
          setErrorModalIsVisible(true);

          console.log(
            {kioskId: generalKioskId},
            'No serial number received from wristband',
          );
          return;
        }

        try {
          const blobData = blob;

          if (currentGuest === 0 || guestHasRoomAccess) {
            await LemurClient.current.writeData('<RFSN0>');
            const error: RFIDResponses = (await LemurClient.current.readData()) as RFIDResponses;

            console.log({error}, 'Read RFID Chip to check if have error');

            if (error !== LemurNoErrorResponse) {
              setIsDispensingWristband(false);
              setDispensingWristbandModalVisible(false);
              setErrorModalIsVisible(true);

              console.log(
                {
                  kioskId: generalKioskId,
                  status: RFIDErrors[error] ?? RFIDErrors,
                },
                'RFID chip is not working',
              );
              
              return;
            }

            const blobParsed = LemurClient.current.parseBlobDataToSectors(
              blobData,
            );
            const blobKeys = Object.getOwnPropertyNames(blobParsed);

            blobKeys.every(async (binary) => {
              await LemurClient?.current?.writeBlockData(
                `<RFW2,${binary},0,16>${blobParsed[binary].data}`,
              );

              return true;
            });
          }

          await sleep(1000);

          await LemurClient.current.writeData('<RFSN0>');
          const writingError: RFIDResponses = (await LemurClient.current.readData()) as RFIDResponses;

          console.log(
            {error: writingError, kioskId: generalKioskId},
            'Read RFID Chip to check if have error after writing',
          );

          if (writingError !== LemurNoErrorResponse) {
            setIsDispensingWristband(false);
            setDispensingWristbandModalVisible(false);
            setErrorModalIsVisible(true);

            console.log(
              {
                kioskId: generalKioskId,
                error: RFIDErrors[writingError] ?? RFIDErrors,
              },
              'Writing to RFID chip failed',
            );
            return;
          }

          await LemurClient.current.dispenseWristband();

          console.log(
            {kioskId: generalKioskId},
            'Dispensing wristband...',
          );

          await sleep(4500);

          await LemurClient.current.writeData('<S92>');
          const checkDispenserStatus = await LemurClient.current.readData();

          const containError = checkDispenserStatus in dispenserErrors;

          if (containError) {
            console.log(
              {
                kioskId: generalKioskId,
                error: checkDispenserStatus,
              },
              'Dispenser error was found on checking status',
            );

            setDispenseConfirmationModalVisible(false);
            setErrorModalIsVisible(true);

            return;
          }

          console.log(
            {kioskId: generalKioskId},
            'Dispensed wristband successfully',
          );

          console.log(
            {checkDispenserStatus, kioskId: generalKioskId},
            'Checking dispenser status after dispensing',
          );

          finishCurrentGuestAndProceed();
        } catch (error) {
          setIsDispensingWristband(false);
          setDispensingWristbandModalVisible(false);
          setErrorModalIsVisible(true);

          console.log(
            {error, kioskId: generalKioskId},
            'Error on get blob data from server, ending session',
          );
          return;
        }
      } else {
        console.log(
          {kioskId: generalKioskId},
          'Lemur SDK was not initialized correctly, ending session',
        );
        setErrorModalIsVisible(true);
      }
    } catch (e) {
      console.log(
        {kioskId: generalKioskId, error: e},
        'Internal error happened, ending session',
      );
      setErrorModalIsVisible(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentGuest,
    currentGuestWristbandOptions,
    finishCurrentGuestAndProceed,
  ]);

  const CommonModalContentError = () => (
    <View style={styles.wristbandDispensingErrorContainer}>
      <Image
        source={wristbandDispensingError}
        style={styles.wristbandDispensingErrorImage}
      />
      <Text style={styles.wristbandDispensingErrorTitle}>
        {'We can not dispense\nyour wristband\nat this time.'}
      </Text>
      <Text style={styles.wristbandDispensingErrorSubtitle}>
        {'End session and contact the front desk.'}
      </Text>
      <Button
        title={'End Session'}
        type="primary"
        onPress={() => {
          LemurClient.current?.disconnectIfNecessary();
          setErrorModalIsVisible(false);
        }}
        textStyle={styles.dispenseButtonLabel}
        containerStyle={styles.dispenseButton}
      />
    </View>
  );

  const GuestListItem = ({
    active = false,
    finished = false,
    guestOrder,
    name = '',
    status = '',
    guestBackgroundColor = '',
  }: IGuestListItem) => {
    return (
      <View
        style={[
          styles.guestListItemContainer,
          active && styles.guestItemActive,
        ]}>
        <View style={styles.guestInfoContainer}>
          <View
            style={[
              styles.guestAvatar,
              {backgroundColor: guestBackgroundColor},
            ]}>
            <Text style={styles.guestAvatarLabel}>{guestOrder + 1}</Text>
          </View>
          <View>
            <Text
              style={[styles.guestName, active && styles.selectedGuestTitle]}>
              {name}
            </Text>
            <Text style={styles.guestStatus}>
              {status}
            </Text>
          </View>
        </View>
        <View>
          {finished ? (
            <View style={styles.guestWristbandDispensed}>
              <Image source={checkMark} style={styles.checkIcon} />
              <Text style={styles.guestWristbandDispensedText}>
                {'Dispensed'}
              </Text>
            </View>
          ) : (
            <Button
              contentType="text"
              title={'Set Access'}
              type="outline"
              disabled
              containerStyle={styles.guestSetAccessButton}
              textStyle={styles.guestSetAccessButtonText}
            />
          )}
        </View>
      </View>
    );
  };

  useEffect(() => {
    LemurXListener.addListener(LemurXEvents.Name, (event) => {
      console.log({event}, 'LemurXListener event');

      if (event === LemurXEvents.Connected) {
        console.log('Dispenser Connected');

        dispense();

        dispatch && dispatch({isDispenserConnected: true});
      }

      if (event === LemurXEvents.Disconnected) {
        console.log('Dispenser Disconnected');

        dispatch && dispatch({isDispenserConnected: false});
      }
    });

    return () => {
      LemurXListener.removeAllListeners(LemurXEvents.Name);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentGuestWristbandOptions.allowCharging,
    currentGuestWristbandOptions.roomAccess,
  ]);

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (guests.length === 0) {
    return (
      <View style={[styles.container, {justifyContent: 'center'}]}>
        <ActivityIndicator
          color={'purple'}
          size={60}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
        <View style={styles.heroContainer}>
          <Text style={styles.hero}>
            {isAllWristbandsDispensed
              ? 'Wristbands dispensed!'
              : 'Wristbands'}
          </Text>
          <Text style={styles.heroSubtitle}>
            {isAllWristbandsDispensed ? (
              <Text>
                {
                  "We'll send your Room Information via email or text"}
              </Text>
            ) : (
              <Text>
                <Text>Please set permissions for your wristbands</Text>
                <Text style={styles.bold}> per guest </Text>
                <Text>and dispense</Text>
              </Text>
            )}
          </Text>
          <TouchableOpacity
            style={styles.infoContainer}
            onPress={() => setInfoModalVisible(true)}>
            <Info />
          </TouchableOpacity>
        </View>
        <View style={styles.dispensingOptionsContainer}>
          <View style={styles.guestListContainer}>
            <View style={styles.guestListHeader}>
              <Text style={styles.guestListTitle}>
                {'Guests'}
              </Text>
              <View style={styles.guestAvatar}>
                <Text style={styles.guestListCount}>{guests.length}</Text>
              </View>
            </View>
            <FlatList
              data={guests}
              keyExtractor={(item) => JSON.stringify(item)}
              showsVerticalScrollIndicator
              renderItem={({item, index}) => (
                <GuestListItem
                  finished={checkIfGuestFinished(index)}
                  active={index === currentGuest}
                  guestOrder={index}
                  name={item.name}
                  guestBackgroundColor={
                    'gray'
                  }
                  status={item.status}
                />
              )}
            />
          </View>

          <View style={styles.guestOptionsContainer}>
            {isAllWristbandsDispensed ? (
              <View style={styles.guestDispenseBox}>
                <Image
                  source={wristbandDispensingFinished}
                  style={styles.allWristbandDispensedImage}
                />
                <View>
                  <Text style={styles.allWristbandDispensedTitle}>
                    {'Enjoy your stay'}
                  </Text>
                </View>
              </View>
            ) : (
              <>
                <View style={styles.guestOptionsHeader}>
                  <Text style={styles.guestOptionTitle}>
                    {'Set access for'}
                  </Text>
                  <View style={[styles.guestAvatar]}>
                    <Text style={styles.guestListCount}>
                      {currentGuest + 1}
                    </Text>
                  </View>
                  <Text style={styles.guestOptionTitle}>
                    {guests[currentGuest].name}
                  </Text>
                </View>
                <View style={styles.guestOptions}>
                  <View style={styles.guestOptionContainer}>
                    <RoomAccessLogo />
                    <Text style={styles.guestOptionLabel}>
                      {'Room Access'}
                    </Text>
                    <Switch
                      disabled={currentGuest === 0}
                      trackColor={{
                        true: 'green',
                        false: 'gray',
                      }}
                      value={
                        currentGuest === 0
                          ? true
                          : currentGuestWristbandOptions.roomAccess
                      }
                      onValueChange={(value) => {
                        setGuestWristbandOptions({
                          ...currentGuestWristbandOptions,
                          roomAccess: value,
                        });
                      }}
                    />
                  </View>
                  <View style={styles.guestOptionContainer}>
                    <AllowChargingLogo />
                    <Text style={styles.guestOptionLabel}>
                      {'Allow charging'}
                    </Text>
                    <Switch
                      value={currentGuestWristbandOptions.allowCharging}
                      trackColor={{
                        true: 'green',
                        false: 'gray',
                      }}
                      onValueChange={(value) => {
                        setGuestWristbandOptions({
                          ...currentGuestWristbandOptions,
                          allowCharging: value,
                        });
                      }}
                    />
                  </View>
                </View>
                <View style={styles.guestDispenseBox}>
                  {currentGuest === 0 && (
                    <Text
                      style={[
                        styles.guestDispenseBoxLabel,
                        {marginBottom: 20},
                      ]}>
                      {'* Room access for main guest is enabled at all times.'}
                    </Text>
                  )}
                  <Text style={styles.guestDispenseBoxTitle}>
                    {'You can dispense one wristband per guest.'}
                  </Text>
                  <Text style={styles.guestDispenseBoxLabel}>
                    {guests[currentGuest].isChild ? 'Kid - ' : 'Adult - '}
                    {'Collect wristband from the dispenser.'}
                  </Text>
                  <View style={styles.dispenseButtonContainer}>
                    <Button
                      title={'Dispense wristband'}
                      type="primary"
                      onPress={() => setDispenseConfirmationModalVisible(true)}
                      textStyle={styles.dispenseButtonLabel}
                      containerStyle={styles.dispenseButton}
                    />
                  </View>
                </View>
              </>
            )}
          </View>
        </View>
      {/* MODALS */}
      <Modal visible={infoModalVisible}>
        <View style={styles.modalContainer}>
          <Info />
          <Text style={styles.infoModalTitle}>
            {'Information'}
          </Text>
          <View style={styles.infoModalLabel}>
            <RoomAccessLogo />
            <Text style={styles.infoModalLabelText}>
              {'Room Access'}
            </Text>
          </View>
          <Text style={styles.infoModalLabelDescription}>
            {'Wristbands can be used\nto access your room.'}
          </Text>
          <View style={styles.infoModalLabel}>
            <AllowChargingLogo />
            <Text style={styles.infoModalLabelText}>
              {'Allow Charging'}
            </Text>
          </View>
          <Text style={styles.infoModalLabelDescription}>
            {'Wristbands can be used to charge\nitems to your reservation.'}
          </Text>
          <Button
            title="Ok"
            type="primary"
            onPress={() => setInfoModalVisible(false)}
            textStyle={styles.infoModalButtonLabel}
            containerStyle={styles.infoModalOkButton}
          />
        </View>
      </Modal>

      <Modal visible={dispenseConfirmationModalVisible}>
        <View style={[styles.modalContainer, {alignItems: undefined}]}>
          <Text style={styles.dispenseConfirmationModalTitle}>
            {'Dispense wristband\nwith these settings'}
          </Text>
          <View style={styles.dispenseConfirmationModalOptionsContainer}>
            <View style={styles.dispenseConfirmationModalRow}>
              <RoomAccessLogo />
              <Text style={styles.dispenseConfirmationModalOptionLabel}>
                {'Room Access'}
              </Text>
            </View>
            <View>
              <Image
                source={
                  currentGuestWristbandOptions.roomAccess || currentGuest === 0
                    ? checkMark
                    : disabledCheckMark
                }
                style={styles.checkIconConfirmation}
              />
            </View>
          </View>
          <View style={styles.dispenseConfirmationModalOptionsContainer}>
            <View style={styles.dispenseConfirmationModalRow}>
              <AllowChargingLogo />
              <Text style={styles.dispenseConfirmationModalOptionLabel}>
                {'Allow Charging'}
              </Text>
            </View>
            <View>
              <Image
                source={
                  currentGuestWristbandOptions.allowCharging
                    ? checkMark
                    : disabledCheckMark
                }
                style={styles.checkIconConfirmation}
              />
            </View>
          </View>
          <View style={styles.dispenseConfirmationModalButtons}>
            <View>
              <Button
                title={'No, go back'}
                type="outline"
                onPress={() => setDispenseConfirmationModalVisible(false)}
                textStyle={styles.logoutModalCancelButtonLabel}
                containerStyle={styles.logoutModalCancelButton}
              />
            </View>
            <View style={styles.logoutModalButtonsSeparator} />
            <View>
              <Button
                title={'Yes, dispense'}
                type="primary"
                onPress={prepareToDispense}
                textStyle={styles.logoutModalConfirmButtonLabel}
                containerStyle={styles.logoutModalConfirmButton}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={logoutModalVisible}>
        <View style={styles.modalContainer}>
          <Text style={styles.logoutModalTitle}>
            {'Are you sure you would\nlike to log out?'}
          </Text>
          <View style={styles.logoutModalButtonsContainer}>
            <View>
              <Button
                title={'Not now'}
                type="outline"
                onPress={() => setLogoutModalVisible(false)}
                textStyle={styles.logoutModalCancelButtonLabel}
                containerStyle={styles.logoutModalCancelButton}
              />
            </View>
            <View style={styles.logoutModalButtonsSeparator} />
            <View>
              <Button
                title={'Yes'}
                type="primary"
                onPress={() => {
                  LemurClient.current?.disconnectIfNecessary();
                  setErrorModalIsVisible(false);
                }}
                textStyle={styles.logoutModalConfirmButtonLabel}
                containerStyle={styles.logoutModalConfirmButton}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={isLoadingSettings} dismissable={false}>
        <View style={styles.modalContainer}>
          <ActivityIndicator
            color={'purple'}
            size={60}
          />
        </View>
      </Modal>

      <Modal visible={dispensingWristbandModalVisible} dismissable={false}>
        <View style={styles.modalContainer}>
          {isDispensingWristband ? (
            <>
              <ActivityIndicator
                color={'purple'}
                size={130}
              />
              <Text style={styles.dispensingModalTitle}>
                {'Please wait while your\nwristband is dispensing'}
              </Text>
            </>
          ) : (
            <View style={styles.wristbandDispensedContainer}>
              <Image source={thumbsUp} style={styles.wristbandDispensedImage} />
              <Text style={styles.wristbandDispensedText}>
                {'Success!\nPick up your wristband'}
              </Text>
              <Button
                title="Continue"
                type="primary"
                onPress={onContinueButtonPress}
                textStyle={styles.dispenseButtonLabel}
                containerStyle={styles.dispenseButton}
              />
            </View>
          )}
        </View>
      </Modal>

      <Modal visible={errorModalIsVisible} dismissable={false}>
        <View style={styles.modalContainer}>
          <CommonModalContentError />
        </View>
      </Modal>
    </View>
  );
};

const createStyles = () =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    heroContainer: {
      marginTop: 56,
      alignItems: 'center',
    },
    hero: {
      color: 'black',
      fontWeight: 'bold',
      fontSize: 58,
      lineHeight: 65,
    },
    heroSubtitle: {
      color: 'black',
      fontSize: 28,
      marginTop: 10,
      lineHeight: 34,
    },
    bold: {
      fontWeight: 'bold',
    },
    selectedGuestTitle: {
      fontWeight: 'bold',
    },
    dispensingOptionsContainer: {
      backgroundColor: '#F5F5F7',
      paddingTop: 10,
      flexDirection: 'row',
      marginHorizontal: 60,
      marginVertical: 45,
      borderRadius: 15,
      height: 580,
    },
    guestListItemContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderRadius: 10,
    },
    guestItemActive: {
      backgroundColor: 'white',
    },
    guestInfoContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    guestAvatar: {
      width: 40,
      height: 40,
      borderRadius: 15,
      backgroundColor: 'gray',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 10,
    },
    guestAvatarLabel: {
      color: '#fff',
      fontSize: 14,
      fontWeight: 'bold',
    },
    guestName: {
      fontSize: 15,
      lineHeight: 20,
    },
    guestStatus: {
      fontSize: 12,
      lineHeight: 16,
      color: '#86868b',
    },
    guestListContainer: {
      flex: 1,
      paddingVertical: 20,
      paddingLeft: 20,
    },
    guestListHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 50,
    },
    guestListTitle: {
      color: 'black',
      fontSize: 30,
      fontWeight: '700',
      marginRight: 10,
      marginLeft: 16,
    },
    guestListCount: {
      color: 'white',
      fontSize: 18,
      fontWeight: 'bold',
    },
    guestOptionsContainer: {
      flex: 2,
      paddingTop: 16,
      paddingLeft: 30,
    },
    guestSetAccessButton: {
      borderColor: 'green',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 15,
      height: 30,
      borderRadius: 10,
    },
    guestSetAccessButtonText: {
      color: 'white',
      fontSize: 13,
      lineHeight: 18,
    },
    guestWristbandDispensed: {
      backgroundColor: 'white',
      flexDirection: 'row',
      paddingVertical: 5,
      paddingHorizontal: 8,
      borderRadius: 20,
      alignItems: 'center',
    },
    checkIcon: {
      width: 18,
      height: 18,
      marginRight: 3,
    },
    guestWristbandDispensedText: {
      fontSize: 13,
      color: '#7A7A7A',
      fontWeight: '700',
    },
    guestOptionsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 52,
    },
    guestOptionTitle: {
      fontSize: 30,
      fontWeight: '700',
      marginRight: 10,
    },
    guestOptions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingRight: 34,
    },
    guestOptionContainer: {
      backgroundColor: 'white',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '49%',
      borderRadius: 10,
      paddingHorizontal: 15,
      paddingVertical: 10,
    },
    guestOptionLabel: {
      color: 'black',
      fontSize: 20,
      fontWeight: '500',
      marginHorizontal: 15,
    },
    guestDispenseBox: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    guestDispenseBoxTitle: {
      color: 'black',
      fontSize: 25,
      fontWeight: 'bold',
      lineHeight: 33,
    },
    guestDispenseBoxLabel: {
      color: 'black',
      fontSize: 18,
      lineHeight: 26,
    },
    dispenseButtonContainer: {
      marginTop: 40,
    },
    dispenseButton: {
      backgroundColor: 'green',
      paddingHorizontal: 80,
      paddingVertical: 10,
    },
    dispenseButtonLabel: {
      color: 'white',
      fontSize: 18,
      fontWeight: 'bold',
    },
    logoutButtonContainer: {
      width: 170,
    },
    logoutButton: {
      borderColor: 'green',
    },
    logoutLabel: {
      color: 'white',
      fontSize: 18,
      fontWeight: 'bold',
    },
    infoContainer: {
      position: 'absolute',
      bottom: -25,
      right: 80,
    },
    modalContainer: {
      alignSelf: 'center',
      backgroundColor: 'white',
      paddingHorizontal: 30,
      paddingVertical: 25,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    infoModalTitle: {
      color: 'black',
      fontSize: 24,
      fontWeight: 'bold',
      marginTop: 24,
    },
    infoModalLabel: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      marginVertical: 20,
    },
    infoModalLabelText: {
      color: 'black',
      fontSize: 18,
      marginLeft: 20,
    },
    infoModalLabelDescription: {
      color: 'black',
      textAlign: 'center',
    },
    infoModalOkButton: {
      backgroundColor: 'green',
      paddingHorizontal: 60,
      paddingVertical: 10,
      marginTop: 24,
    },
    infoModalButtonLabel: {
      color: 'white',
      fontWeight: '400',
      fontSize: 16,
    },
    logoutModalTitle: {
      color: 'black',
      fontSize: 25,
      fontWeight: 'bold',
      textAlign: 'center',
    },
    logoutModalButtonsContainer: {
      justifyContent: 'space-between',
      alignItems: 'center',
      flexDirection: 'row',
      maxWidth: 300,
      marginTop: 24,
    },
    logoutModalConfirmButton: {
      backgroundColor: 'black',
      width: 140,
    },
    logoutModalCancelButton: {
      width: 140,
      borderColor: 'black',
    },
    logoutModalConfirmButtonLabel: {
      color: 'white',
      fontSize: 16,
    },
    logoutModalCancelButtonLabel: {
      color: 'black',
      fontSize: 16,
    },
    logoutModalButtonsSeparator: {
      marginHorizontal: 10,
    },
    wristbandDispensingErrorContainer: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    wristbandDispensingErrorTitle: {
      color: 'black',
      fontWeight: 'bold',
      lineHeight: 34,
      fontSize: 28,
      textAlign: 'center',
    },
    wristbandDispensingErrorSubtitle: {
      color: 'black',
      lineHeight: 20,
      fontSize: 15,
      textAlign: 'center',
      marginTop: 10,
      marginBottom: 20,
    },
    wristbandDispensingErrorImage: {
      width: 180,
      height: 190,
      resizeMode: 'contain',
      justifyContent: 'center',
    },
    dispensingModalTitle: {
      color: 'black',
      marginTop: 20,
      fontWeight: 'bold',
      lineHeight: 34,
      fontSize: 28,
      textAlign: 'center',
    },
    wristbandDispensedContainer: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    wristbandDispensedImage: {
      width: 170,
      height: 170,
      resizeMode: 'contain',
      justifyContent: 'center',
      marginBottom: 20,
    },
    wristbandDispensedText: {
      color: 'black',
      fontWeight: 'bold',
      lineHeight: 34,
      fontSize: 28,
      textAlign: 'center',
      marginBottom: 20,
    },
    dispenseConfirmationModalTitle: {
      color: 'black',
      fontSize: 28,
      fontWeight: 'bold',
      marginBottom: 20,
      textAlign: 'center',
    },
    dispenseConfirmationModalOptionsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    dispenseConfirmationModalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    checkIconConfirmation: {
      width: 25,
      height: 25,
      marginLeft: 20,
    },
    dispenseConfirmationModalOptionLabel: {
      color: 'black',
      fontSize: 18,
      fontWeight: '500',
      marginHorizontal: 15,
    },
    dispenseConfirmationModalButtons: {
      justifyContent: 'space-between',
      alignItems: 'center',
      flexDirection: 'row',
    },
    allWristbandDispensedTitle: {
      color: 'black',
      fontWeight: 'bold',
      fontSize: 28,
      lineHeight: 33,
      textAlign: 'center',
      marginBottom: 10,
      marginTop: 20,
    },
    allWristbandDispensedSubtitle: {
      color: 'black',
      fontSize: 22,
      lineHeight: 26,
    },
    allWristbandDispensedImage: {
      width: 400,
      height: 290,
      borderRadius: 10,
    },
  });
