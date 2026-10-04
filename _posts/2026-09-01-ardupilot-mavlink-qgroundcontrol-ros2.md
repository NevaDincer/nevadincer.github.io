---
layout: post
title: "Understanding how ArduPilot, MAVLink, QGroundControl, and ROS 2 work together"
---

An autonomous vehicle looks like one thing from the outside. Under the hood it's four separate pieces of software running on different hardware, at different speeds, talking to each other over a link that can drop packets at any moment.

I built a marine vehicle simulation project with radar, lidar, and AIS sensing, a geofence, and a MAVLink-to-ROS 2 bridge feeding a live telemetry dashboard. Getting there meant learning four systems and more than enough I lost time just figuring out which layer a problem actually belonged to. I'm writing this partly as something for anyone doing a similar project who wants to skip some of that confusion, and partly for myself to come back to.

## Vocabulary

**Armed and disarmed.** A disarmed vehicle ignores control input on purpose, a designed safety state. Arming routes power to the motors. Most flight controllers refuse to arm until pre-arm checks pass like a valid GPS lock, a calibrated compass, healthy sensors. ArduPilot reports which specific check is blocking you, find more here: ([ArduPilot docs](https://ardupilot.org/copter/docs/common-prearm-safety-checks.html)).

**Flight modes.** (Most real systems switch between several of these in one run)
In manual mode, input goes straight to the motors. 
In stabilize mode, the controller still takes raw input but auto-levels the vehicle. 
In guided mode, software sends target positions and the controller figures out how to get there. 
In auto mode, it follows a pre-loaded set of waypoints with no live input. 

**Sensors.** (none of these are trustworthy alone, which is why state estimation exists as its own problem) 
An IMU measures acceleration and rotation. 
A barometer estimates altitude from air pressure, which drifts with weather. 
A GPS module gives absolute position but updates slowly and can be off by ten meters near tall buildings. 


**EKF** (Extended Kalman Filter). Combines IMU, GPS, barometer, and sometimes compass readings, weighing each by how reliable it currently seems, into one best estimate of position, velocity, and orientation.

**Waypoint.** Coordinates plus an action, like loiter here for 5 seconds. A mission is an ordered list of these.

**Failsafe.** A rule that fires automatically on a specific condition, like a lost radio link or low battery, usually triggering a conservative response like holding position or returning to launch.

On the ROS 2 side:

**Node.** A single process responsible for one job, like reading a camera or running an obstacle-detection algorithm. Many small nodes rather than one big program, so one crash doesn't take everything down.

**Topic.** A named stream of data, published by one or more nodes and subscribed to by any number of others, with no direct connection between them ([ROS 2 concepts](https://docs.ros.org/en/rolling/Concepts/Basic/About-Nodes.html)).

**Service.** A single request and a single response between two nodes, good for something quick like "what's your battery level."

**Action.** For anything that takes real time and needs progress updates, like "navigate to this point." It can report back mid-run and be cancelled ([topics vs. services vs. actions](https://automaticaddison.com/topics-vs-services-vs-actions-in-ros2-based-projects/)).

## Why so many systems

At the bottom sits the flight controller, on a microcontroller like an STM32 chip on a Pixhawk board, running a real-time OS. ArduPilot's builds run on ChibiOS for this reason ([ArduPilot porting guide](https://ardupilot.org/dev/docs/porting.html)). Its control loop runs at a few hundred hertz: read the gyroscope, compute the error, run the PID controller, output to the motors, repeat. Missing that cycle by even a few milliseconds can flip the vehicle over, so this layer does one job, fast, with nothing else running on it.

Above that sits the ground station, on ordinary consumer hardware and a general-purpose OS. This is where a human operator lives, drawing maps, plotting telemetry, editing missions. A general-purpose OS has no timing guarantees, which is why it can't run motor control but is exactly what you need for a responsive interface.

When a vehicle needs heavy computation, like a vision model or path planning, a companion computer gets added (something like a Raspberry Pi or Jetson), wired to the flight controller over serial. This is where ROS 2 usually is, it keeps expensive non-real-time work away from the flight controller's loop.

**The bottleneck.** A vehicle's telemetry radio might run at a few tens of kilobytes per second, shared between everything it needs to report and everything the ground station needs to command, and it drops packets outright over distance. JSON or XML doesn't work here. Plain-text keys and brackets eat too much bandwidth, and parsing text costs more memory and CPU than a flight controller has to spare.

This is the problem MAVLink exists to solve.

## The common language: MAVLink

MAVLink is a binary serialization protocol: both sides agree ahead of time on what each byte means, instead of sending readable text.

A MAVLink 2 packet has a start byte (`0xFD`), a length byte, a sequence number so drops can be detected, a system ID and component ID identifying the sender, a message ID, the payload, and a checksum ([packet serialization](https://mavlink.io/en/guide/serialization.html)). A vehicle is typically system ID 1, a ground station 255 ([MAVLink FAQ](https://mavlink.io/kr/about/faq.html)); running two ground stations or a real and simulated vehicle at once is the first thing to check when messages go missing.

The checksum includes an extra byte, CRC_EXTRA, generated from the exact structure of the message definition. If sender and receiver were built from slightly different definitions, that byte won't match and the packet gets dropped ([MAVLink FAQ](https://mavlink.io/kr/about/faq.html)).

Telemetry is broadcast with no specific destination. Commands and parameter changes are targeted at a specific system and component. None of this cares what physical link it runs over (serial radio, USB, UDP, TCP), which is why the same code can talk to a real vehicle over radio or a simulated one over localhost with no changes beyond the connection string.

### Where the definitions come from

Message types are defined in an XML file, `common.xml`, and a generator called `mavgen` produces matching libraries in C, C++, Python, or Rust. A Python script and a C++ flight controller end up agreeing exactly on every message without their authors ever coordinating directly. A custom ground station extending this XML with new messages only has to agree with a vehicle on which definitions both were generated from, not who wrote either piece of software.

## The core protocols

Four transaction patterns come up constantly.

**Heartbeat.** Every system broadcasts one about once a second, carrying vehicle type, firmware, mode, and armed state ([heartbeat protocol](https://mavlink.io/en/services/heartbeat.html)). A system is typically considered disconnected after four or five missed heartbeats. If the vehicle stops hearing from the ground station mid-flight, it can trigger its own failsafe, like return-to-launch, without waiting for a human to notice. My own watchdog script reinvented a smaller version of this: it watches for a different kind of silence, no physical movement, but the shape is the same, define what "still working" looks like, watch for its absence, have a conservative response ready.

**Command and acknowledge.** Direct actions like arming or changing mode go through `COMMAND_LONG`, and the receiver replies with `COMMAND_ACK`: accepted, in progress, temporarily rejected, or denied ([command protocol](https://mavlink.io/en/services/command.html)). Without this step, a command lost over a bad link would just vanish with no way to know it failed.

**Parameters.** A flight controller stores thousands of configuration values by string key. `PARAM_REQUEST_LIST` streams them all back as indexed `PARAM_VALUE` messages so a dropped one can be re-requested individually ([parameter protocol](https://mavlink.io/en/services/parameter.html)). `PARAM_SET` changes one value, confirmed by the vehicle broadcasting it back.

**Missions.** A waypoint list is never sent as one block. The sender announces the count with `MISSION_COUNT`, the vehicle requests each one by index with `MISSION_REQUEST_INT`, and once all have arrived it confirms with `MISSION_ACK` ([mission protocol](https://mavlink.io/en/services/mission.html)). A lost waypoint just gets re-requested by index.

### Where ROS 2 fits

ROS 2 sits one layer further out, on the companion computer, and usually talks to the flight controller through `pymavlink` or a bridge node. A ROS 2 topic and a MAVLink telemetry stream are both one-to-many broadcasts, and a bridge often just republishes a message like `GLOBAL_POSITION_INT` as a topic. A ROS 2 service maps to a MAVLink command/ack exchange. They genuinely diverge on longer-running work: MAVLink's mission protocol is a fixed transaction for one task, while a ROS 2 action is a general pattern with live progress feedback for anything from navigation to a multi-second vision pipeline.

In my own project, the watchdog and movement control still talked to ArduPilot directly through `pymavlink`, with no ROS 2 layer yet. Adding one later would mean turning those scripts into nodes publishing topics, so an obstacle-detection node could subscribe without knowing MAVLink exists.

## Tracing a real command: arming from a keyboard

A Python script, reads keyboard input to arm and drive a simulated vehicle, talking to ArduPilot directly over MAVLink via `pymavlink`, no ground station involved.

**Arming.** A key press builds a `COMMAND_LONG` for arming, targeted at the vehicle's system ID, sent over UDP to SITL.

**ArduPilot's checks.** Pre-arm checks run immediately: is the EKF producing a usable estimate, are sensors healthy. In simulation these are far more forgiving than on real hardware.

**The acknowledgment.** If checks pass, ArduPilot replies `COMMAND_ACK` accepted and the vehicle actually arms. Before I handled this correctly, my script assumed success the moment it sent the command, so a silently rejected arm request produced no error at all.

**Motion.** Key presses map to RC channel override values, sent continuously while a key is held, and ArduPilot runs them through its own control loop.

**Where it broke.** The vehicle drifted at a constant speed regardless of which keys I pressed. The bug was in the bridge between ArduPilot's motor output and Webots: under certain conditions SITL sends a sentinel value of -1 on the motor-speed channel meaning "no data yet," and the bridge script fed that straight into its speed calculation, producing a fixed, nonsensical output that Webots applied to the boat forever.

The fix was reading `SERVO_OUTPUT_RAW` directly instead, the actual PWM values ArduPilot sends each motor. I confirmed those values first with MAVProxy's `status` command before touching any code, then wired them into the bridge and the movement worked correctly.

**What this shows.** The command-and-acknowledge pattern is what made the silent-arm-failure bug fixable once I started checking the ACK. MAVLink having many specific message types rather than one generic "motor state" blob is why `SERVO_OUTPUT_RAW` existed as a way around the broken channel. And the fact that ArduPilot's control loop was never touched, the bug lived entirely in a separate bridge script, is the layered architecture working as intended.

## Try it yourself

Everything above runs on a laptop with no hardware, using SITL paired with QGroundControl or Webots.

Start a copter simulation:

```
sim_vehicle.py -v ArduCopter --console
```

This sends heartbeat and telemetry over UDP, and QGroundControl listens on port 14550 by default ([QGroundControl UDP link](https://squid.nt.tuwien.ac.at/gitlab/platzgummer/qgroundcontrol/blame/0ad046641c31d328ce2490f36855fb5fe991d6fe/src/comm/UDPLink.h)). It should detect the vehicle within seconds and download the full parameter list automatically. The MAVLink Inspector under Analyze Tools shows every message type live, which makes the earlier sections visible on screen instead of just read about.

Pairing SITL with Webots adds an actual 3D world with gravity and collisions, useful when testing something that depends on physical behavior rather than just message flow. Webots runs the vehicle model, SITL runs alongside it, and a bridge script keeps sensor and motor data flowing between the two while QGroundControl connects to the same SITL instance for a live map.

Worth checking directly: watch a `COMMAND_ACK` come back after arming, try arming before the EKF has a lock and see the rejection reason, change a parameter and watch the confirmation come back, and build a small mission to watch `MISSION_COUNT` and `MISSION_REQUEST_INT` go one waypoint at a time instead of all at once.

---

**Sources referenced above:** [MAVLink packet serialization](https://mavlink.io/en/guide/serialization.html) · [MAVLink FAQ](https://mavlink.io/kr/about/faq.html) · [Heartbeat/connection protocol](https://mavlink.io/en/services/heartbeat.html) · [Command protocol](https://mavlink.io/en/services/command.html) · [Parameter protocol](https://mavlink.io/en/services/parameter.html) · [Mission protocol](https://mavlink.io/en/services/mission.html) · [ArduPilot pre-arm safety checks](https://ardupilot.org/copter/docs/common-prearm-safety-checks.html) · [ArduPilot ChibiOS/STM32 porting guide](https://ardupilot.org/dev/docs/porting.html) · [ROS 2 concepts](https://docs.ros.org/en/rolling/Concepts/Basic/About-Nodes.html) · [Topics vs. services vs. actions in ROS 2](https://automaticaddison.com/topics-vs-services-vs-actions-in-ros2-based-projects/)
