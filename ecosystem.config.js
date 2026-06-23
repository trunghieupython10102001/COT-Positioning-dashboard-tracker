module.exports = {
  apps: [
    {
      name: "cot",
      cwd: "/var/www/cot",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3100",
      env: { NODE_ENV: "production", PORT: "3100", DATA_DIR: "/var/lib/cot-data" },
      autorestart: true,
      max_memory_restart: "400M",
    },
    {
      name: "cot-refresh",
      cwd: "/var/www/cot",
      script: "scripts/refresh-data.sh",
      interpreter: "bash",
      autorestart: false,
      cron_restart: "0 22 * * 5",
      env: { DATA_DIR: "/var/lib/cot-data" },
    },
  ],
};
