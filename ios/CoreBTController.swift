//
//  CoreBTController.swift
//  boca_tester
//
//  Created by Raphael Freitas da Silva on 24/01/23.
//

import Foundation
import CoreBluetooth
import Combine

@available(iOS 13.0, *)
public class CoreBTController: NSObject, CBCentralManagerDelegate, CBPeripheralDelegate {
  public static var myCBController: CoreBTController? = nil
  private var myCBManager: CBCentralManager?
  private var selectedBLEDevice: CBPeripheral?
  private var mySerialNumber: String?
  private var myWriteCharacterstic: CBCharacteristic?
  private var myReadCharacteristic: CBCharacteristic?
  private var isDisconnectPlanned: Bool = false
  private var writeDataBuffer: NSMutableData?
  private var readLock: NSLock = NSLock();
  
  public var action = PassthroughSubject<String, Never>()
  public var StatusReport = ""
  
  static public func GetAction() -> PassthroughSubject<String, Never> {
    let controller: CoreBTController = self.getController()
    
    return controller.action
  }
  
  static public func OpenBTLE(_ serialNumber: String) -> Bool {
    let controller: CoreBTController = self.getController()

    controller.mySerialNumber = serialNumber
    controller.writeDataBuffer = NSMutableData()
    
    if controller.myCBManager == nil {
      controller.myCBManager = CBCentralManager.init(delegate: controller, queue: nil, options: nil)
    } else if (controller.myCBManager != nil && !controller.myCBManager!.isScanning) {
      controller.beginScan()
    }
    
    // return BOOL - this value doesn't do anything in BLE mode because a connection occurs
    // asynchronously, therefore, there is no way to know if a connection succeeded at this
    // point.
    return true
  }

  static public func DisconnectBLE() {
    let controller: CoreBTController = self.getController()
    controller.isDisconnectPlanned = true
    
    guard let manager = controller.myCBManager else {
      return
    }
    
    if manager.isScanning {
      manager.stopScan()
      
      print("LEMUR X: Stopped scanning for peripherals.")
    }
    
    guard let connectedPeripheral = controller.selectedBLEDevice else {
      controller.isDisconnectPlanned = false
      return
    }
    
    if connectedPeripheral.state == CBPeripheralState.connected {
      manager.cancelPeripheralConnection(connectedPeripheral)
    } else {
      controller.isDisconnectPlanned = false
    }
    
  }

  static public func WriteBTLE(_ command: String) {
    let data: Data = command.data(using: String.Encoding.utf8)!
    let controller: CoreBTController = self.getController()
    
    controller.writeData(data)
  }
  
  static public func GetStatus() -> String {
    let controller: CoreBTController = self.getController()
    
    let status = controller.StatusReport
    controller.StatusReport = ""
    
    return status
  }
  
  static public func getController() -> CoreBTController {
    if self.myCBController == nil {
      self.myCBController = CoreBTController()
    }
    
    return self.myCBController!
  }
  
  private func beginScan() {
    guard let state = myCBManager?.state else {
      print("LEMUR X: NO CB MANAGER SET UP")
      return
    }
    
    switch state {
      case CBManagerState.unsupported:
        print("LEMUR X: This platform does not support BLE.")
        break;
      case CBManagerState.unauthorized:
        print("LEMUR X: This app is not authorized to use BLE.")
        break;
      case CBManagerState.poweredOff:
        print("LEMUR X: Bluetooth is currently powered off.")
        break;
      case CBManagerState.poweredOn:
        print("LEMUR X: Bluetooth is powered on.")
        myCBManager?.scanForPeripherals(withServices: nil, options: nil)
        print("LEMUR X: Started scanning for peripherals.")
        break;
      default:
        print("LEMUR X: Something went wrong with Bluetooth Core Manager")
        break;
    }
  }
  
  public func writeData(_ data: Data) {
    self.writeDataBuffer?.append(data)
    
    self.writeDataFromBuffer()
  }
  
  public func writeDataFromBuffer() {
    guard let BLEDevice = selectedBLEDevice else {
      return
    }
    
    guard let writeCharacterstic = self.myWriteCharacterstic else {
      return
    }
    
    if let dataBuffer = self.writeDataBuffer {
      while BLEDevice.canSendWriteWithoutResponse && dataBuffer.length > 0 {
        var dataPacket: Data;
        
        if dataBuffer.length > BLEDevice.maximumWriteValueLength(for: .withoutResponse) {
          dataPacket = dataBuffer.subdata(with: NSMakeRange(0, BLEDevice.maximumWriteValueLength(for: .withoutResponse)))
          
          BLEDevice.writeValue(dataPacket, for: writeCharacterstic, type: .withoutResponse)
          
          let range = NSMakeRange(0, min(BLEDevice.maximumWriteValueLength(for: .withoutResponse), self.writeDataBuffer?.length ?? 0))
          self.writeDataBuffer?.replaceBytes(in: range, withBytes: nil, length: 0)
        } else {
          BLEDevice.writeValue(dataBuffer as Data, for: writeCharacterstic, type: .withoutResponse)
          self.writeDataBuffer?.length = 0
        }
      }
    }
  }
}
  
}

@available(iOS 13.0, *)
extension CoreBTController {
  public func centralManagerDidUpdateState(_ central: CBCentralManager) {
    self.beginScan()
  }
  
  public func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
    print("LEMUR X: Peripheral device \(String(describing: peripheral.name)) successfully connected to SDK")
    
    peripheral.delegate = self
    peripheral.discoverServices(nil)
    central.stopScan()
    
    print("LEMUR X: Stopped scanning for peripherals")
    self.action.send("CONNECTION_SUCCESSFUL")
  }
  
  public func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
    print("LEMUR X: Could not connect to peripheral device...")
    
    central.stopScan()
    
    print("LEMUR X: Stopped scanning for peripherals")
  }
  
  public func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
    print("LEMUR X: Peripheral device \(String(describing: peripheral.name)) disconnected")
    
    self.selectedBLEDevice = nil
    
    if self.isDisconnectPlanned {
      mySerialNumber = nil
    } else {
      self.beginScan()
    }
    
    self.isDisconnectPlanned = false
    self.action.send("DISCONNECTED")
  }
  
  public func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String : Any], rssi RSSI: NSNumber) {
    guard let peripheralName = peripheral.name else {
      return
    }
    
    if let serialNumber = mySerialNumber {
      if peripheralName.contains(serialNumber) {
        self.selectedBLEDevice = peripheral
        
        central.connect(peripheral, options: nil)
      }
    }
  }
  
  public func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
    guard let services = peripheral.services else {
      return
    }

    for serivce in services {
      peripheral.discoverCharacteristics(nil, for: serivce)
    }
  }
  
  public func peripheral(_ peripheral: CBPeripheral, didWriteValueFor characteristic: CBCharacteristic, error: Error?) {
    if error != nil {
      print("LEMUR X: \(error as Any)")
    }
  }
  
  public func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
    guard let characteristics = service.characteristics else {
      return
    }

    for characteristic in characteristics {
      if characteristic.uuid.uuidString.contains("8841") {
        myWriteCharacterstic = characteristic
      }
      
      if characteristic.uuid.uuidString.contains("1E4D") {
        myReadCharacteristic = characteristic
        peripheral.setNotifyValue(true, for: characteristic)
      }
    }
  }
  
  public func peripheral(_ peripheral: CBPeripheral, didUpdateNotificationStateFor characteristic: CBCharacteristic, error: Error?) {
    if error != nil {
      print("LEMUR X: \(error as Any)")
    }
  }
  
  public func peripheralIsReady(toSendWriteWithoutResponse peripheral: CBPeripheral) {
    self.writeDataFromBuffer()
  }
  
  public func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
    guard let myCharacteristic = self.myReadCharacteristic else {
      return
    }
    
    if characteristic == myCharacteristic {
      let readBuffer: [UInt8] = characteristic.value!.bytes
      let bufLen: Int = characteristic.value!.count
      
      var bytesAppended = 0
      var bytesProcessed = 0
      var Status = ""
      
      while bytesProcessed < bufLen {
        if readBuffer[bytesAppended] < 32 {
          switch readBuffer[bytesAppended] {
            case 0x6:
                Status = "Ticket ACK";
                break;
            case 0x8:
                Status = "Invalid Checksum";
                break;
            case 0x9:
                Status = "Valid Checksum";
                break;
            case 0x10:
                Status = "Out of Tickets";
                break;
            case 0x11:
                Status = "X-On";
                break;
            case 0x12:
                Status = "Power On";
                break;
            case 0x13:
                Status = "X-Off";
                break;
            case 0x15:
                Status = "Ticket NAK";
                break;
            case 0x18:
                Status = "Ticket Jam";
                break;
            case 0x1D:
                Status = "Cutter Jam";
                break;
            case 0x0F:
                Status = "Low Paper";
                break;
            case 0x53:
                Status = "Tag Failed";
                break;
            default:
                Status = "";
                //Status = [NSString stringWithFormat:@"%@%d",@"Non Standard Status Value = ",buf[bytesAppended]];
                break;
          }
          bytesProcessed+=1
          bytesAppended+=1
        } else {
          Status = String(bytes: readBuffer, encoding: String.Encoding.utf8)!
          
          bytesProcessed += bufLen
          bytesAppended += bufLen
        }
        
        if Status.count != 0 {
          self.readLock.lock()
          
          if self.StatusReport.count != 0 {
            self.StatusReport = ""
          }
          
          self.StatusReport = Status
          Status = ""
          
          self.readLock.unlock()
        }
      }
    }
  }
}

extension Data {
    var bytes: [UInt8] {
        return [UInt8](self)
    }
}
