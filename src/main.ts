import "./style.css";
import { UI } from "@peasy-lib/peasy-ui";
import { Telemetry, TelConfigObject } from "./components/telemetry";
import { log } from "console";

const model = {
  die: () => {
    myTel.toggleHeartbeatAck();
  },
  clear: () => {
    myTel.clearLog();
  },
  download: () => {
    myTel.getLog();
  },
  update: () => {
    myTel.writeLog();
  },
};
const template = `<div> Telemetry demo 
    <div style="display: flex; flex-direction: column; justify-content: space-evenly; align-items: flex-start;height: 125px;">
        
        <button \${click@=>die}>toggle heartbeat</button>
        <button \${click@=>download}>download logfiles</button>
        <button \${click@=>update}>update DB logfile</button>
        <button \${click@=>clear}>clear logfiles</button>
    </div>
</div>`;

/*
setups up telemetry module
*/
const myTelConfig: TelConfigObject = {
  workerPath: "./src/components/",
  databaseName: "telemetry",
  hbInterval: 1500,
  hbTimeoutlimit: 200,
  verbose: false,
  useHeartbeat: true,
};
const myTel = Telemetry.create(myTelConfig);
console.log("initializing tel class");

const initresult = await myTel.initialize();

if (!initresult) {
  throw new Error("Telemetry class failed to initialize");
} else {
  console.log("Tel Class Initialized!");
  myTel.appLog("telemetry initialized");
}

UI.create(document.body, template, model);
myTel.appLog("UI initialized");

myTel.appLog("creating pointer events");
document.addEventListener("pointerdown", (e: PointerEvent) => {
  let x = e.clientX;
  let y = e.clientY;
  myTel.logEvent("pointerdown", { x: x, y: y });
});

myTel.appLog("setup complete");
