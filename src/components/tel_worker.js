import { saveAs } from "file-saver";

let hbWatchdogHandler = 0;
let hbIntervalHandler;
let hbInterval;
let hbTimeoutlimit;
let hbIntervalPause = false;
let verbose = false;
let events = new Map();
let logs = new Map();
let dbOpened = false;
let db;
let request;
let eventStore;
let logStore;
let watchdog;

onmessage = function (e) {
  //e.data[0] is message type
  //e.data[1] is message content object
  if (verbose) console.log("worker: message received: ", e.data[0]);

  switch (e.data[0]) {
    case "init":
      console.log("initializting in worker");
      hbInterval = e.data[1].hbInterval | 1000;
      hbTimeoutlimit = e.data[1].hbTimeoutLimit | 500;
      watchdog = e.data[1].watchdog;
      verbose = e.data[1].verbose | false;

      //enable/disable heartbeat monitor
      if (watchdog) {
        hbIntervalHandler = setInterval(() => {
          if (!hbIntervalPause) postMessage({ type: "HB", data: null });
          hbWatchdogHandler = setTimeout(() => {
            if (dbOpened) crashReport();
            this.clearInterval(hbIntervalHandler);
            throw new Error("HB FAULT: UNRESPONSIVE CLIENT");
          }, hbTimeoutlimit);
        }, hbInterval);
      }

      //setup db
      request = indexedDB.open("telemetry", 1);
      request.onupgradeneeded = function () {
        db = request.result;
        if (verbose) console.log("setting up db");
        eventStore = db.createObjectStore("events", { keyPath: "id" }); //
        logStore = db.createObjectStore("logs", { keyPath: "id" }); //
      };
      request.onerror = function (event) {
        if (verbose) console.error("An error occurred with IndexedDB");
        if (verbose) console.error(event);
        throw new Error("An error occurred with IndexedDB");
      };
      request.onsuccess = function (event) {
        if (verbose) console.log("db successfully opened");
        dbOpened = true;
        db = request.result;
        resetDB();
      };

      break;
    case "HB_ack":
      if (verbose) console.log("heartbeat");
      if (hbWatchdogHandler != 0) clearTimeout(hbWatchdogHandler);
      break;
    case "log":
      logs.set(e.data[1].time, e.data[1].data);
      break;
    case "event":
      let eventID = e.data[1].eventID;
      let data = e.data[1].data;
      let timestamp = e.data[1].time;
      if (!events.has(eventID)) events.set(eventID, { log: [] });
      events.get(eventID).log.push({ data: data, time: timestamp });
      break;
    case "reset":
      logs = new Map();
      events = new Map();
      resetDB();
      break;
    case "getLog":
      resetDB();
      setTimeout(() => {
        updateDB();
        setTimeout(() => {
          hbIntervalPause = true;
          console.log("sending write complete back to main thread");
          postMessage({ type: "dbWriteComplete", data: null });
          hbIntervalPause = false;
        }, 500);
      }, 500);
      break;
    case "writeLog":
      updateDB();
      setTimeout(() => {
        hbIntervalPause = true;
        postMessage({ type: "dbWriteComplete", data: null });
        hbIntervalPause = false;
      }, 500);
      break;
  }
};

function crashReport() {
  if (db) {
    const eventtransaction = db.transaction("events", "readwrite");
    const logtransaction = db.transaction("logs", "readwrite");
    const eventstore = eventtransaction.objectStore("events");
    const logstore = logtransaction.objectStore("logs");

    let loopIndex = 0;
    for (let [key, value] of events.entries()) {
      value.log.forEach(element => {
        eventstore.put({ id: loopIndex, event: key, time: element.time, data: element.data });
        loopIndex++;
      });
    }

    loopIndex = 0;
    for (let [key, value] of logs.entries()) {
      logstore.put({ id: loopIndex, time: key, data: value });
      loopIndex++;
    }
  }
}

function resetDB() {
  if (verbose) console.trace("Cleaning DB", db);
  if (db) {
    const eventtransaction = db.transaction("events", "readwrite");
    const logtransaction = db.transaction("logs", "readwrite");
    const eventStore = eventtransaction.objectStore("events");
    const logStore = logtransaction.objectStore("logs");
    eventStore.clear();
    logStore.clear();
  }
}

function updateDB() {
  if (verbose) console.log("updating IndexDB log");
  const eventtransaction = db.transaction("events", "readwrite");
  const logtransaction = db.transaction("logs", "readwrite");
  const eventstore = eventtransaction.objectStore("events");
  const logstore = logtransaction.objectStore("logs");

  let loopIndex = 0;
  for (let [key, value] of events.entries()) {
    value.log.forEach(element => {
      eventstore.put({ id: loopIndex, event: key, time: element.time, data: element.data });
      loopIndex++;
    });
  }

  loopIndex = 0;
  for (let [key, value] of logs.entries()) {
    logstore.put({ id: loopIndex, time: key, data: value });
    loopIndex++;
  }
}
