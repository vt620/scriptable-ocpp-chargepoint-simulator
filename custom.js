let cp, heartbeatTimer;
try {
  // WebSocket Connect (no OCPP)
  cp = await connect('ws://localhost:8100/xyz');
  // typical startup OCPP
  const bootResp = await cp.sendBootnotification({chargePointVendor: "vendor", chargePointModel: "1"});
  await cp.sendHeartbeat();
  heartbeatTimer = setInterval(() => cp.sendHeartbeat(), bootResp.interval * 1000);
  await cp.sendStatusNotification({connectorId: 0, errorCode: "NoError", status: "Available"});
  await cp.sendStatusNotification({connectorId: 1, errorCode: "NoError", status: "Available"});
  // register code for GetDiagnostics, UpdateFirmware, Reset
  cp.answerGetDiagnostics( async (request) => {
    const fileName = "foo." + new Date().toISOString() + ".txt";
    cp.sendResponse(request.uniqueId, {fileName});
    await cp.sendDiagnosticsStatusNotification({status: "Idle"});
    await cp.sleep(5000);
    await cp.sendDiagnosticsStatusNotification({status: "Uploading"});
    await cp.ftpUploadDummyFile(request.payload.location, fileName);
    await cp.sendDiagnosticsStatusNotification({status: "Uploaded"});
  });
  cp.answerUpdateFirmware( async (request) => {
    cp.sendResponse(request.uniqueId, {});
    await cp.sendFirmwareStatusNotification({status: "Idle"});
    await cp.sleep(5000);
    await cp.sendFirmwareStatusNotification({status: "Downloading"});
    const file = await cp.ftpDownload(request.payload.location);
    cp.log("file downloaded to: " + file);
    await cp.sendFirmwareStatusNotification({status: "Downloaded"});
    await cp.sleep(5000);
    await cp.sendFirmwareStatusNotification({status: "Installing"});
    await cp.sleep(5000);
    await cp.sendFirmwareStatusNotification({status: "Installed"});
  });
  cp.answerReset(async (request) => {
    cp.sendResponse(request.uniqueId, {status: "Accepted"});
    cp.log("RESET ***boing-boing-boing*** " + request.payload.type);
    await cp.sendBootnotification({chargePointVendor: "vendor", chargePointModel: "1"});
  });
  // Typical charging session
  let meterCount = 1377;
  for(let chargeCount = 0; chargeCount < 10; chargeCount++) {
    const authResp = await cp.sendAuthorize({idTag: "ccc"});
      if (authResp.idTagInfo.status == 'Accepted') {
      await cp.sendStatusNotification({connectorId: 1, errorCode: "NoError", status: "Preparing"});
      cp.transaction = await cp.startTransaction({connectorId: 1, idTag: "ccc", meterStart: meterCount, timestamp: new Date().toISOString()});
      meterCount += 10;
      await cp.sendStatusNotification({connectorId: 1, errorCode: "NoError", status: "Charging"});
      for(let chargeMeterCount = 0; chargeMeterCount < 10; chargeMeterCount++) {
        await cp.meterValues({connectorId: 1, transactionId: cp.transaction.transactionId, meterValue: [{ timestamp: new Date().toISOString(), sampledValue: [{value: meterCount}] }]});
        meterCount += 10;
        await cp.sleep(5000);
      }
      await cp.stopTransaction({transactionId: cp.transaction.transactionId, meterStop: meterCount, timestamp: new Date().toISOString()});
      meterCount += 10;
      await cp.sendStatusNotification({connectorId: 1, errorCode: "NoError", status: "Finishing"});
      await cp.sendStatusNotification({connectorId: 1, errorCode: "NoError", status: "Available"});
    }
  }
} catch (err) {
  console.log(err);
} finally {
  clearInterval(heartbeatTimer);
  cp.close();
}
