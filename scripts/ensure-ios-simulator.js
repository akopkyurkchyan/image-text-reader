#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const workspace = path.join(projectRoot, 'ios', 'ImageTextReader.xcworkspace');
const scheme = 'ImageTextReader';

function run(command) {
  return execSync(command, { cwd: projectRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function getValidSimulators() {
  const output = run(
    `xcodebuild -showdestinations -workspace "${workspace}" -scheme ${scheme} 2>/dev/null`,
  );

  const simulators = [];
  const linePattern =
    /platform:iOS Simulator, arch:[^,]+, id:([^,]+), OS:([^,]+), name:([^}]+)/;

  for (const line of output.split('\n')) {
    const match = line.match(linePattern);
    if (!match || !match[3].trim().startsWith('iPhone')) {
      continue;
    }

    simulators.push({
      id: match[1].trim(),
      os: match[2].trim(),
      name: match[3].trim(),
    });
  }

  return simulators;
}

function getBootedSimulatorIds() {
  try {
    const output = run('xcrun simctl list devices booted -j');
    const data = JSON.parse(output);
    const booted = [];

    for (const devices of Object.values(data.devices)) {
      for (const device of devices) {
        if (device.state === 'Booted' && device.udid) {
          booted.push(device.udid);
        }
      }
    }

    return booted;
  } catch {
    return [];
  }
}

function pickSimulator(validSimulators) {
  const preferredNames = [
    'iPhone 16 Pro',
    'iPhone 15 Pro',
    'iPhone 16',
    'iPhone SE (3rd generation)',
  ];

  for (const preferredName of preferredNames) {
    const match = validSimulators.find(simulator => simulator.name === preferredName);
    if (match) {
      return match;
    }
  }

  return validSimulators[0] ?? null;
}

function bootSimulator(simulator) {
  console.log(`Booting ${simulator.name} (iOS ${simulator.os})...`);
  run(`xcrun simctl boot "${simulator.id}"`);
}

function main() {
  const validSimulators = getValidSimulators();

  if (validSimulators.length === 0) {
    console.error(
      'No compatible iOS Simulator found for this Xcode project. Open Xcode and install an iOS simulator runtime.',
    );
    process.exit(1);
  }

  const validIds = new Set(validSimulators.map(simulator => simulator.id));
  const bootedIds = getBootedSimulatorIds();
  const hasCompatibleBootedSimulator = bootedIds.some(id => validIds.has(id));

  if (hasCompatibleBootedSimulator) {
    return;
  }

  if (bootedIds.length > 0) {
    console.log(
      'The currently booted simulator is not supported by this Xcode project. Switching to a compatible simulator...',
    );

    for (const bootedId of bootedIds) {
      try {
        run(`xcrun simctl shutdown "${bootedId}"`);
      } catch {
        // Ignore shutdown errors and continue.
      }
    }
  }

  const simulator = pickSimulator(validSimulators);

  if (!simulator) {
    console.error('Could not find a compatible iPhone simulator to boot.');
    process.exit(1);
  }

  try {
    bootSimulator(simulator);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('current state appears to be Booted')) {
      console.error(message);
      process.exit(1);
    }
  }
}

main();
