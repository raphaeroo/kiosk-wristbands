//
//  LemurXBridge.swift
//  kiosk
//
//  Created by Raphael Freitas da Silva on 20/10/22.
//

import Foundation
import Combine

enum LemurXEvents: String, CaseIterable {
  case LEMUR_X_EVENT_NOTIFICATION
}

@available(iOS 13.0, *)
@objc(LemurXBridge)
public class LemurXBridge: RCTEventEmitter {
  private var stringData: String?
  private var observer: AnyCancellable?
  
  static public override func requiresMainQueueSetup() -> Bool {
    return true
  }
  
  @objc public override func supportedEvents() -> [String]! {
    return LemurXEvents.allCases.map { $0.rawValue }
  }
  
  override public init() {
    super.init()
  }
  
  @objc func sendNotification(_ message: String) -> Void {
    sendEvent(withName: LemurXEvents.LEMUR_X_EVENT_NOTIFICATION.rawValue, body: message)
  }
  
  @objc public func connect(
    _ dispenserSerial: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    print("LEMUR X: Dispenser Serial: \(String(describing: dispenserSerial))")
    observer = CoreBTController.GetAction().sink(receiveValue: { message in
      self.sendNotification(message)
    })
    
    let connected = CoreBTController.OpenBTLE(dispenserSerial)
    
    let isConnected = connected ? "Connected" : "Not Connected"
    
    resolve(isConnected)
  }
  
  @objc public func sendString(_ stringCommand: String) {
    print("LEMUR X: send command to dispenser \(stringCommand)")

    CoreBTController.WriteBTLE(stringCommand)
  }
  
  @objc public func receiveData(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let data = CoreBTController.GetStatus()
    
    print("LEMUR X: Dispenser Status: \(String(describing: data))")
    
    resolve(data)
  }
  
  @objc public func disconnect(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    print("LEMUR X: Disconnecting dispenser...")
    
    CoreBTController.DisconnectBLE()
    
    resolve(true)
  }
  
}
