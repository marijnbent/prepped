import { spawn } from "node:child_process";

const DEFAULT_BACKUP_TIME = "03:00";

function parseBackupTime(value) {
  const match = /^(?<hours>\d{1,2}):(?<minutes>\d{2})$/.exec(value);
  if (!match?.groups) {
    throw new Error(`Invalid BACKUP_TIME value: "${value}". Expected HH:MM.`);
  }

  const hours = Number.parseInt(match.groups.hours, 10);
  const minutes = Number.parseInt(match.groups.minutes, 10);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(`Invalid BACKUP_TIME value: "${value}". Expected HH:MM.`);
  }

  return { hours, minutes };
}

function getNextRun(now, schedule) {
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setHours(schedule.hours, schedule.minutes, 0, 0);

  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runBackup() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["scripts/backup-s3.mjs"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });

    child.on("exit", (code, signal) => {
      if (signal) {
        console.error(`Backup process terminated by signal ${signal}.`);
        resolve(false);
        return;
      }

      resolve(code === 0);
    });

    child.on("error", (error) => {
      console.error("Failed to start backup process.");
      console.error(error);
      resolve(false);
    });
  });
}

async function main() {
  const schedule = parseBackupTime(process.env.BACKUP_TIME || DEFAULT_BACKUP_TIME);
  const runOnStart = ["1", "true", "yes"].includes((process.env.BACKUP_RUN_ON_START || "").toLowerCase());

  console.log(`Daily backup scheduler started. Time: ${String(schedule.hours).padStart(2, "0")}:${String(schedule.minutes).padStart(2, "0")}`);

  if (runOnStart) {
    console.log("Running backup immediately on startup.");
    await runBackup();
  }

  while (true) {
    const now = new Date();
    const nextRun = getNextRun(now, schedule);
    const waitMs = nextRun.getTime() - now.getTime();

    console.log(`Next backup scheduled for ${nextRun.toString()}`);
    await sleep(waitMs);

    const succeeded = await runBackup();
    if (!succeeded) {
      console.error("Scheduled backup failed. Will retry at the next scheduled time.");
    }
  }
}

main().catch((error) => {
  console.error("Backup scheduler failed.");
  console.error(error);
  process.exit(1);
});
