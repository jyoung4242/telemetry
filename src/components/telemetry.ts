import { saveAs } from "file-saver";

export type TelConfigObject = {
  workerPath: string;
  hbInterval: number;
  hbTimeoutlimit: number;
  verbose?: boolean;
  databaseName: string;
  useHeartbeat: boolean;
};

export class Telemetry {
  initialized: boolean = false;
  verbose: boolean = false;
  myWorker: any;
  heartbeat = true;
  resolvedFetch: any;
  dbEnable: boolean;
  workerPath: string;
  dbName: string;
  dbOpen: boolean = false;
  request: IDBOpenDBRequest | undefined;
  transEvents: IDBTransaction | undefined;
  transLogs: IDBTransaction | undefined;
  db: IDBDatabase | undefined;
  indexedDB: IDBFactory | undefined;
  eventStore: IDBObjectStore | undefined;
  logStore: IDBObjectStore | undefined;
  interval: number;
  timeout: number;
  diagnosticHBoverride: boolean;

  constructor(config: TelConfigObject) {
    this.workerPath = config.workerPath;
    this.dbName = config.databaseName || "telemetry";
    this.dbEnable = false;
    this.verbose = config.verbose ? config.verbose : false;
    this.interval = config.hbInterval;
    this.timeout = config.hbTimeoutlimit;
    this.heartbeat = config.useHeartbeat || false;
    this.diagnosticHBoverride = false;

    //test for browser compliance to IndexedDB
    const indexedDB =
      //@ts-ignore
      window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB || window.shimIndexedDB;
    if (!indexedDB) {
      this.dbEnable = false;
      this.initialized = false;
      throw new Error("this browser does not support indexedDB API");
    } else this.checkForCrashReport();
  }

  /**
   * initialize()
   * @returns boolean if initialization was successful
   */
  async initialize(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.myWorker = new Worker(this.workerPath + "tel_worker.js", { type: "module" });
      this.myWorker.addEventListener("error", () => {
        throw new Error("Worker not initialized", {
          cause: "possible bad path (tel_worker.js) provided to Telemetry class",
        });
      });
      if (this.myWorker) {
        this.initialized = true;
        this.myWorker.onmessage = (e: any) => {
          this.messageParser(e.data);
        };
        this.myWorker.postMessage([
          "init",
          { hbInterval: this.interval, hbTimeoutlimit: this.timeout, verbose: this.verbose, watchdog: this.heartbeat },
        ]);
        resolve(true);
      } else reject(false);
    });
  }

  /**
   * create
   * @param config TelConfigObject
   * @returns instance of class
   */
  static create(config: TelConfigObject) {
    if (config.hbInterval < 500) throw new Error("Interval value is too low, needs to be >= 500");
    if (config.hbTimeoutlimit <= 50 && config.hbTimeoutlimit >= config.hbInterval)
      throw new Error("Timeout value invalid, needs to be >= 50 and < heartbeat interval");
    return new Telemetry(config);
  }

  /**
   * logEvent
   * @param event - stored key title for the logs
   * @param data - data object related to above event that you want saved
   */
  logEvent(event: string, data: any) {
    if (this.myWorker)
      this.myWorker.postMessage([
        "event",
        {
          eventID: event,
          data: data,
          time: performance.now(),
        },
      ]);
  }

  /**
   * appLog
   * @param logData
   * sends log event data to webworker that contains
   * string data that gets stored against timestamp
   */
  appLog(logData: string) {
    if (this.myWorker)
      this.myWorker.postMessage([
        "log",
        {
          data: logData,
          time: performance.now(),
        },
      ]);
  }

  /**
   * clearLog
   * sends web worker command ==>
   * flushes log and event data, clears stored indexedDB instance
   */
  clearLog() {
    this.myWorker.postMessage(["reset", {}]);
  }

  /**
   * writeLog - sends message to web worker to update the
   * database in the browsers cache, and then it responds
   * in message parser when update is complete, then resolves
   * the promise retured here
   * distinction from getLog, is that this doesn not clear the db prior to
   * writing, so this syncs internal data to database cache
   * @returns
   */
  writeLog() {
    this.myWorker.postMessage(["writeLog", {}]);
    return new Promise(resolve => {
      this.resolvedFetch = resolve;
    });
  }

  /**
   * getLog - sends message to web worker to update the
   * database in the browsers cache, and then it responds
   * in message parser when update is complete, then resolves
   * the promise retured here
   * distinction from writeLog is that this clears db cache
   * prior to overwriting
   * @returns
   */
  getLog(): Promise<void> {
    this.myWorker.postMessage(["getLog", {}]);
    return new Promise(resolve => {
      this.resolvedFetch = resolve;
    });
  }

  /**
   * messageParser
   * receives message data from web worker message event
   * parses based on message type
   * @param data
   */
  messageParser = (data: any) => {
    if (this.verbose) console.log("TelClass => message received from worker");
    switch (data.type) {
      case "HB":
        if (this.diagnosticHBoverride) break;
        this.myWorker.postMessage(["HB_ack", {}]);
        break;
      case "event":
        this.resolvedFetch();
        break;
      case "appLog":
        this.resolvedFetch();
        break;
      case "all":
        this.resolvedFetch();
        break;
      case "dbWriteComplete":
        this.downloadCrashReport();
        break;
    }
  };

  /**
   * checkForCrashReport
   * on startup, checks for lingering crash report from
   * previous instance of game
   * if detected, downloads automatically
   * and resets the database
   */
  private async checkForCrashReport() {
    //setup db
    this.indexedDB = window.indexedDB;
    this.request = this.indexedDB.open(this.dbName, 1);

    do {
      await this.wait(25);
      if (this.verbose) console.log("TelClass => Waiting on opening db");
    } while (this.request.readyState == "pending");

    if (this.request) this.db = this.request.result;
    if (this.db) {
      this.transEvents = this.db.transaction("events", "readonly");
      this.transLogs = this.db.transaction("logs", "readonly");
      this.eventStore = this.transEvents.objectStore("events");
      this.logStore = this.transLogs.objectStore("logs");
      let eventSize = this.eventStore.count();
      let logSize = this.logStore.count();
      do {
        await this.wait(25);
        if (this.verbose) console.log("TelClass =>  Waiting on retrieving db size");
      } while (eventSize.readyState == "pending" || logSize.readyState == "pending");
      if (eventSize.result > 0 || logSize.result > 0) {
        this.downloadCrashReport();
        throw new Error("Crash Report Detected, downloading file");
      }
    }
  }

  /**
   * downloadCrashReport - utility function
   * when db update signal from webworker received
   * calls this utility to export to log file
   */
  async downloadCrashReport() {
    //get db data
    let eventQuery: IDBRequest;
    let logQuery: IDBRequest;

    if (this.db) {
      this.transEvents = this.db.transaction("events", "readonly");
      this.transLogs = this.db.transaction("logs", "readonly");
      this.eventStore = this.transEvents.objectStore("events");
      this.logStore = this.transLogs.objectStore("logs");
      eventQuery = this.eventStore.getAll();
      logQuery = this.logStore.getAll();
      do {
        await this.wait(25);
        if (this.verbose) console.log("TelClass => Waiting on data");
      } while (eventQuery.readyState == "pending" || logQuery.readyState == "pending");

      const eventData = eventQuery.result;
      const logData = logQuery.result;
      const myBlob = new Blob(["EVENT LOG: \n", JSON.stringify(eventData), "\n APP LOG: \n", JSON.stringify(logData)], {
        type: "text/plain;charset=utf-8",
      });
      saveAs(myBlob, "tel-light.log");
    }
  }

  /**
   * toggleHeartbeatAck
   * flips diagnostice flag from true/false
   * if active(true), client class does not
   * responde to worker heartbeat, simulating crash
   */
  toggleHeartbeatAck() {
    this.diagnosticHBoverride = !this.diagnosticHBoverride;
  }

  /**
   * wait - async await routine to perform inline waiting
   * @param ms - milliseconds to delay
   * @returns Promise
   */
  async wait(ms: number): Promise<void> {
    return new Promise((resolve: any) =>
      setTimeout(() => {
        resolve();
      }, ms)
    );
  }
}
