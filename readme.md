[![Twitter URL](https://img.shields.io/twitter/url/https/twitter.com/bukotsunikki.svg?style=social&label=Follow%20%40jyoung424242)](https://twitter.com/jyoung424242)
[![Itch.io URL](https://img.shields.io/badge/Itch-%23FF0B34.svg?style=for-the-badge&logo=Itch.io&logoColor=white)](https://mookie4242.itch.io/)
[![Reddit](https://img.shields.io/badge/Reddit-FF4500?style=for-the-badge&logo=reddit&logoColor=white)](https://www.reddit.com/user/Healthy_Ad5013)

<h4 align="center">Small and simplistic Telemetry Module for JS/TS projects</h4>

![Screenshot](/screenshot.png?raw=true "Screenshot")

# 👋 Introducing `Tel-light`

`Tel-light` is an simple class that works with web worker technology to monitor your primary application and captures logs and events as you specify in your project!

<!---
# Demo on Youtube (TODO)

- https://youtu.be/m1zYOhrmdKk Javascript example
- https://youtu.be/IRboPZac_Q8 Typescript example
-->

## Getting Started!!!!

1. download package or CDN package

```bash
npm i tel-light
```

2. create the telemetry config object

```ts
const myTelConfig: TelConfigObject = {
  workerPath: "./src/components/",
  databaseName: "telemetry",
  hbInterval: 1500,
  hbTimeoutlimit: 200,
  verbose: false,
  useHeartbeat: true,
};
```

3. Create new instance of your tel module

```ts
const myTel = Telemetry.create(myTelConfig);
```

4. initialize the module

```ts
await myTel.initialize();
```

5. Now you can use the two logging methods: logs and events

6. logs -> example here is using the appLog method to

```ts
myTel.appLog("creating pointer events");
myTel.appLog("application setup complete");
```

7. events -> example here is tying a pointerdown JS event to a log so i can record all the pointerdowns that occur in my app

```ts
document.addEventListener("pointerdown", (e: PointerEvent) => {
  let x = e.clientX;
  let y = e.clientY;
  myTel.logEvent("pointerdown", { x: x, y: y });
});
```

# 🔥 Features

`Tel-light` is very straight forward. You can do the followings with it:

## 🔢 Log desired events to a report

- Choose custom events, or not custom events, to log as they occur so you can create a timeline of what is occurring and when

![Telemetry Report](/report.png?raw=true "Telemetry Report")

## 🏗️ Create Logs of what is going on in the application

- Tell the story of how your application is executing and its program flow by sprinkling logging calls throughout your code.
  These show up as a timestamped sequence of events in the logfile

## 💘 Watchdog heartbeat

- if configured so, the tel-light creates a watchdog handshake between the Telemetry class and the webworker, for whatever reason, if you main client stops responding to the web worker as its monitoring, it will essentially log a crash report.

- that crash report will be available on startup of the next application cycle

## ✨ Utilizes IndexedDB technology

- Web Workers have access to the IndexedDB API's so this makes for a convenient way for the web worker to store the data between application runs

# 🏭 API

## TelConfigObject

### Let's start with the options required

```ts
const myTelConfig: TelConfigObject = {
  workerPath: "./src/components/",
  databaseName: "telemetry",
  hbInterval: 1500,
  hbTimeoutlimit: 200,
  verbose: false,
  useHeartbeat: true,
};
```

- workerPath:string (required) - this is relative string path to tel_worker.js in your project
- databaseName:string (default: 'telemetry') - name of database stored in IndexedDB
- hbInterval: number (must be >= 500) - milliseconds that the heartbeat is sent to your primary thread
- hbTimeoutlimit: number (must be >= 50 and less than hbInterval) - this is how long your primary thread has to respond before crash report logged
- verbose? OPTIONAL: boolean (default: false) - boolean flag to enable console logging of module
- useHeartbeat: boolean (default: true) - boolean flag to enable/diable the watchdog heartbeat

## Telemetry.create( config object: TelConfigObject) => returns class instance

```ts
const myTel = Telemetry.create(myTelConfig);
```

- This static method is used as a factory method and performs the incoming data validation prior to instancing the class and executing the constructor of the class. If all goes well, returns the class instance

## Telemetry.initialize() => returns Promise<boolean>

```ts
const myTel = Telemetry.create(myTelConfig);
const initResult = await myTel.initialize();
```

- `***ASYNCRONOUS***`
- This asycnronous method is used to initialize the web worker (tel_worker.js) where it resides @ workerPath parameter provided. It returns a true/false boolean upon resolution, true if it resolves, false if it rejects.

## Telemetry.logEvent(event: string, data: any) => void

```ts
const myTel = Telemetry.create(myTelConfig);
const initResult = await myTel.initialize();
myTel.logEvent("ExampleEvent", { x: 50, y: 53, rndmString: "Hellow World!" });
```

- This method is used to format and send the specified event and the event data to the webworker
- this will be inserted into the cached database and timestamped

## Telemetry.appLog(logData: string) => void

```ts
const myTel = Telemetry.create(myTelConfig);
const initResult = await myTel.initialize();
myTel.appLog("This happened");
```

- This method is used to format and send the specified log string to the webworker
- this will be inserted into the cached database and timestamped

## Telemetry.clearLog() => void

```ts
const myTel = Telemetry.create(myTelConfig);
const initResult = await myTel.initialize();
myTel.clearLog();
```

- This method is used to reset the cached database, and will clear all the logged datastructures from memory

## Telemetry.writeLog() => internal class Promise

```ts
const myTel = Telemetry.create(myTelConfig);
const initResult = await myTel.initialize();
myTel.writeLog();
```

- sends message to web worker to update the database in the browsers cache, and then it responds in message parser when update is complete, then resolves the promise retured here
- distinction from getLog, is that this doesn not clear the db prior to writing, so this syncs internal data to database cache
- this will trigger a download of the debug report

## Telemetry.getLog() => internal class Promise

```ts
const myTel = Telemetry.create(myTelConfig);
const initResult = await myTel.initialize();
myTel.getLog();
```

- sends message to web worker to update the database in the browsers cache, and then it responds in message parser when update is complete, then resolves the promise retured here
- distinction from writeLog, is that this clears db cache prior to overwriting
- this will trigger a download of the debug report
