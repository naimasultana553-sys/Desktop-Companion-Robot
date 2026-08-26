# Desktop Companion Robot — Complete Project Documentation

---

## 1. Introduction

The **Desktop Companion Robot** is an embedded systems project that creates a small, expressive robot designed to sit on a desk and interact with its user through animated facial expressions and physical head movement. It is built around a compact, WiFi-capable microcontroller and combines electronics, mechanical actuation, and a browser-based 3D visualization tool into a single, cohesive project.

The project was developed to demonstrate practical embedded systems concepts — microcontroller programming, I2C communication, PWM-based servo control, and power management — while also being approachable and understandable to a non-technical audience through its companion web interface.

---

## 2. Objective

- Design and build a functional desktop robot capable of expressive movement and facial animation.
- Apply core embedded systems concepts: GPIO control, I2C communication, PWM signal generation, and power domain separation.
- Document the hardware and wiring clearly enough for others to replicate the build.
- Provide an interactive, visual way (a 3D web preview) to understand the robot's construction, without requiring the physical hardware in hand.
- Produce a project that is presentable for academic evaluation, a GitHub portfolio, and technical demonstration.

---

## 3. System Overview

At a high level, the robot consists of three functional domains:

1. **Compute** — a microcontroller that runs the firmware, coordinates the display and servos, and (optionally) connects to WiFi.
2. **Output — Visual** — an OLED display used to render animated eyes/facial expressions.
3. **Output — Mechanical** — two servos (pan and tilt) that physically move the robot's head, controlled indirectly through a dedicated PWM driver chip.

These three domains are tied together by a shared **I2C communication bus** (for the display and the servo driver) and a **carefully separated power system** (logic power vs. servo power).

```
                ┌─────────────────────────┐
                │   XIAO ESP32-S3 (MCU)   │
                │  - Runs firmware logic  │
                │  - I2C master           │
                └────────────┬────────────┘
                             │ I2C (SDA/SCL)
              ┌──────────────┴───────────────┐
              │                               │
     ┌────────▼────────┐           ┌─────────▼─────────┐
     │   OLED Display    │           │     PCA9685        │
     │  (I2C, face/eyes) │           │ (I2C → PWM driver)  │
     └────────────────────┘           └─────────┬─────────┘
                                                  │ PWM channels
                                     ┌────────────┴────────────┐
                                     │                          │
                              ┌──────▼──────┐           ┌───────▼──────┐
                              │  Pan Servo   │           │  Tilt Servo   │
                              └──────────────┘           └───────────────┘
```

---

## 4. Hardware Components — Detailed

### 4.1 Seeed Studio XIAO ESP32-S3 (Microcontroller)
- Acts as the "brain" of the robot.
- Runs the firmware loop: reads any inputs, decides on a behavior/expression, and drives outputs accordingly.
- Communicates with peripherals over I2C as the bus master.
- Small form factor, suitable for compact desktop robot enclosures.
- Has built-in WiFi/Bluetooth capability, which can optionally be used for remote control, OTA firmware updates, or connectivity features.

### 4.2 SSD1306 OLED Display (I2C, 0.96")
- Used exclusively for rendering the robot's "face" — typically a pair of animated eyes.
- Communicates over I2C, sharing the same physical bus as the PCA9685 (each device is distinguished by its I2C address).
- Chosen for low pin-count wiring (only SDA + SCL + power + ground needed) and crisp monochrome contrast, well suited to simple expressive graphics.

### 4.3 PCA9685 PWM Driver
- A dedicated 16-channel PWM driver chip, controlled over I2C.
- Its purpose is to offload precise PWM signal generation from the microcontroller, and to allow multiple servos to be driven cleanly without timing conflicts in firmware.
- Has an **OE (Output Enable)** pin: when present, this should be tied to GND so its outputs are enabled by default.

### 4.4 Pan Servo (SG90 Micro Servo)
- Provides left/right rotation of the robot's head.
- Physically mounted at the base of the neck assembly.
- Powered from the external 5V rail; receives its PWM control signal from PCA9685 channel 0.

### 4.5 Tilt Servo (SG90 Micro Servo)
- Provides up/down rotation of the robot's head.
- Physically mounted between the neck and head assembly.
- Powered from the external 5V rail; receives its PWM control signal from PCA9685 channel 1.

### 4.6 External 5V 3–4A Power Supply
- A dedicated power source used **only** for the servos.
- Kept separate from the XIAO's onboard 3V3 regulator because servos draw current spikes (especially at startup or under load) that a microcontroller's small onboard regulator is not designed to supply — attempting to power servos from the 3V3 pin risks brownouts, resets, or permanent damage to the microcontroller.

---

## 5. Wiring & Power Architecture

### 5.1 Communication Bus (I2C)
Both the OLED display and the PCA9685 sit on the same I2C bus:
- **SDA** (data line) — shared between OLED and PCA9685, connected back to the XIAO's D4 pin.
- **SCL** (clock line) — shared between OLED and PCA9685, connected back to the XIAO's D5 pin.
- Each device is addressed individually over the bus using its unique I2C address, so no additional wiring is needed to distinguish them.

### 5.2 Power Domains
There are two distinct power domains in this design, and keeping them separate is critical:

| Domain | Powers | Source |
|---|---|---|
| Logic power | XIAO ESP32-S3, OLED display, PCA9685 logic | XIAO's onboard 3V3 |
| Servo power | Pan servo, Tilt servo | External 5V supply |

### 5.3 Golden Wiring Rules
1. **Common ground is mandatory.** Every ground pin — on the XIAO, the OLED, the PCA9685, the servos, and the external power supply — must be tied together. Without a shared ground reference, PWM signals from the PCA9685 will not be interpreted correctly by the servos, and I2C communication can become unreliable.
2. **Never power servos from the XIAO's 3V3 pin.** Use the external 5V rail exclusively for servo power.
3. **Tie OE to GND (if present).** This keeps the PCA9685's PWM outputs active by default, rather than requiring firmware to explicitly enable them at startup.

### 5.4 Pin Mapping

| Component | Pin / GPIO | Signal Type | Purpose | Voltage |
|---|---|---|---|---|
| XIAO | D4 | I2C SDA | Data to OLED + PCA9685 | 3.3V |
| XIAO | D5 | I2C SCL | Clock to OLED + PCA9685 | 3.3V |
| XIAO | 3V3 | Power Out | Logic power for OLED + PCA | 3.3V |
| XIAO | GND | Ground | Common ground reference | 0V |
| OLED | SDA | I2C Data | Face expression data | 3.3V |
| OLED | SCL | I2C Clock | Clock signal | 3.3V |
| OLED | VCC | Power In | Display power | 3.3V |
| PCA9685 | SDA | I2C Data | Servo command data | 3.3V |
| PCA9685 | SCL | I2C Clock | Clock signal | 3.3V |
| PCA9685 | VCC | Power In | Logic power | 3.3V |
| PCA9685 | V+ | Power In | Servo power input | 5V |
| PCA9685 | CH0 | PWM Out | Pan servo signal | 5V PWM |
| PCA9685 | CH1 | PWM Out | Tilt servo signal | 5V PWM |
| PSU | +5V | Power Out | Servo power rail | 5V |
| PSU | GND | Ground | Common ground | 0V |
| Pan Servo | Sig | PWM In | Position signal | 5V PWM |
| Pan Servo | 5V | Power In | Motor power | 5V |
| Tilt Servo | Sig | PWM In | Position signal | 5V PWM |
| Tilt Servo | 5V | Power In | Motor power | 5V |

---

## 6. Firmware / Software Architecture

The firmware is organized into focused modules rather than a single large file, so each concern can be developed and tested independently:

| File | Responsibility |
|---|---|
| `main.ino` | Entry point — `setup()` initializes peripherals; `loop()` runs the main behavior cycle |
| `config.h` | All user-editable constants: WiFi credentials, pin assignments, servo angle limits |
| `expressions.h` | Defines the animation frames/logic for the OLED "face" |
| `servo_control.h` | Wraps PCA9685 communication and exposes simple pan/tilt movement functions |
| `behaviors.h` | A small state machine defining robot moods/behaviors (e.g. idle, reacting, sleeping) and deciding which expression + movement to show at any given time |
| `wifi_setup.h` *(optional)* | Handles WiFi connection and, if desired, over-the-air (OTA) firmware updates |

### 6.1 Firmware Execution Flow

```
Power on
   │
   ▼
Initialize I2C bus
   │
   ▼
Initialize OLED display
   │
   ▼
Initialize PCA9685 + center servos
   │
   ▼
┌─────────────── Main Loop ───────────────┐
│  1. Determine current behavior/mood     │
│  2. Render corresponding face/expression│
│  3. Compute target pan/tilt angles      │
│  4. Send angles to PCA9685              │
│  5. Small delay / yield                 │
└──────────────────────────────────────────┘
   (repeats indefinitely)
```

---

## 7. Web Preview (3D Interactive Viewer)

In addition to the physical robot, this project includes a browser-based 3D preview, intended to:
- Let anyone (including examiners or collaborators without the physical hardware) explore how the robot is built.
- Visually trace wiring and connections between components.
- Provide an "exploded view" showing how the assembly comes apart, component by component.
- Optionally simulate pan/tilt servo movement in the browser (clearly labeled as simulation, since it does not control real hardware unless a live backend connection is added).

This is deployed as a static site via GitHub Pages and lives in the root of the repository.

### 7.1 Interactive Features
- **Workbench Mode** — Exploded view of all components with color-coded wiring (17 cables)
- **Robot Mode** — Assembled robot preview with animated OLED face
- **X-Ray Mode** — See internal components through the shell
- **Connections Explorer** — Click any wire to trace its full circuit net
- **Servo Control** — Simulate pan/tilt head movement in real time
- **Component Inspector** — Click any part for detailed specifications

---

## 8. Repository Structure

```
desktop-companion-robot/
├── index.html              # Main web preview entry point
├── css/
│   └── styles.css          # All styling (dark theme, responsive)
├── js/
│   └── app.js              # Three.js 3D scene, interactions, UI logic
├── images/
│   └── robot.jpeg          # Photo of actual built robot
├── firmware/                # Code flashed to the XIAO ESP32-S3
│   ├── main.ino
│   ├── config.h
│   ├── expressions.h
│   ├── servo_control.h
│   ├── behaviors.h
│   └── wifi_setup.h
├── hardware/                # Wiring diagrams, BOM, enclosure files
├── docs/
│   ├── SETUP.md
│   └── CUSTOMIZATION.md
├── README.md
└── LICENSE
```

---

## 9. Build Process

```
Idea → Design → 3D Model → Circuit Design → Hardware Assembly → Firmware Development → Testing → Final Robot
```

Each stage produces its own artifacts (sketches/CAD files, schematic, assembled photos, firmware commits, test logs) which should be kept in the repository for traceability.

---

## 10. Testing Strategy

| Test | Purpose | Result |
|---|---|---|
| I2C bus scan | Confirm OLED and PCA9685 are both detected at their expected addresses | ☐ |
| OLED display test | Confirm the display initializes and renders expressions correctly | ☐ |
| Servo center test | Confirm both servos move to a known neutral position on startup | ☐ |
| Servo range test | Confirm both servos can reach their full intended range without mechanical binding | ☐ |
| Power stability test | Confirm no brownouts/resets occur when both servos move simultaneously under load | ☐ |
| Full system test | Run the complete behavior loop for an extended period and confirm stable operation | ☐ |

---

## 11. Advantages

- Modular hardware and firmware design makes it easy to extend or repurpose individual parts (e.g., swap the display, add more servos).
- Clear separation of power domains improves reliability and protects the microcontroller.
- The web-based 3D preview makes the project accessible and understandable without needing the physical hardware present.
- Small footprint and low component count keep the build approachable for students and hobbyists.

## 12. Limitations

- Current design is limited to two degrees of freedom (pan and tilt) — no arms, wheels, or additional actuators.
- No onboard sensors are assumed in this base design (e.g., no camera, microphone, or proximity sensor) unless explicitly added.
- The web preview's control panel is a simulation unless a live hardware connection (e.g., over WiFi/serial) is separately implemented.

## 13. Future Scope

- Add sensor input (e.g., a distance or light sensor) to allow reactive, not just idle, behaviors.
- Add audio feedback via a small speaker or buzzer.
- Implement a live WiFi bridge so the web dashboard can control the real robot, not just a simulation.
- Expand the behavior state machine with more moods and personality-driven animations.
- Publish 3D-printable enclosure files for easier replication by others.

---

## 14. Conclusion

The Desktop Companion Robot demonstrates a complete, small-scale embedded system: a microcontroller coordinating a display and mechanical actuators over a shared communication bus, with careful attention to power management and modular software design. Paired with its interactive 3D web preview, the project is documented and presented in a way that is understandable to newcomers while remaining technically transparent for detailed review.

---

## Appendix: Quick Reference

- **MCU:** Seeed Studio XIAO ESP32-S3
- **Display:** SSD1306 OLED 0.96", I2C
- **Actuators:** 2x SG90 Micro Servo (pan, tilt) via PCA9685
- **Power:** Logic power from XIAO 3V3; servo power from external 5V 3–4A rail
- **Ground:** Common ground across all components
- **Communication:** I2C (SDA = D4, SCL = D5) shared bus for OLED + PCA9685
