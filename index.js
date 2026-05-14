require("dotenv").config();
const fs = require("fs");
const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  MessageFlags,
} = require("discord.js");
const cron = require("node-cron");

const { DISCORD_TOKEN, CHANNEL_ID, FRONT_ROLE_ID, BACK_ROLE_ID } = process.env;

for (const [key, value] of Object.entries({
  DISCORD_TOKEN,
  CHANNEL_ID,
  FRONT_ROLE_ID,
  BACK_ROLE_ID,
})) {
  if (!value) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}

const STATE_FILE = "./state.json";

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
  } catch {
    return { enabled: true };
  }
}

function saveState(next) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(next, null, 2));
}

let state = loadState();

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const SCRUM_MESSAGE =
  `<@&${FRONT_ROLE_ID}> <@&${BACK_ROLE_ID}>\n` +
  `📝 **데일리 스크럼 작성 시간입니다!**\n` +
  `오늘 완료한 작업 / 계획한 작업 / 장애 요소 / 추가 논의 사항을 공유해 주세요.`;

async function sendScrumReminder() {
  if (!state.enabled) {
    console.log(`[${new Date().toISOString()}] Skipped (disabled)`);
    return;
  }
  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel?.isTextBased()) {
      console.error(`Channel ${CHANNEL_ID} is not a text channel`);
      return;
    }
    await channel.send({
      content: SCRUM_MESSAGE,
      allowedMentions: { roles: [FRONT_ROLE_ID, BACK_ROLE_ID] },
    });
    console.log(`[${new Date().toISOString()}] Scrum reminder sent`);
  } catch (err) {
    console.error("Failed to send scrum reminder:", err);
  }
}

const scrumCommand = new SlashCommandBuilder()
  .setName("scrum")
  .setDescription("데일리 스크럼 알림 제어")
  .addSubcommand((sub) => sub.setName("on").setDescription("알림 켜기"))
  .addSubcommand((sub) => sub.setName("off").setDescription("알림 끄기"))
  .addSubcommand((sub) =>
    sub.setName("status").setDescription("현재 알림 상태 확인"),
  );

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "scrum") return;

  const sub = interaction.options.getSubcommand();
  if (sub === "on") {
    state.enabled = true;
    saveState(state);
    await interaction.reply({
      content:
        "✅ 스크럼 알림이 **켜졌습니다**. 매주 월/목 19:00에 알림이 발송됩니다.",
      flags: MessageFlags.Ephemeral,
    });
  } else if (sub === "off") {
    state.enabled = false;
    saveState(state);
    await interaction.reply({
      content:
        "🔕 스크럼 알림이 **꺼졌습니다**. `/scrum on` 으로 다시 켤 수 있습니다.",
      flags: MessageFlags.Ephemeral,
    });
  } else if (sub === "status") {
    await interaction.reply({
      content: `현재 상태: ${state.enabled ? "✅ 켜짐" : "🔕 꺼짐"}`,
      flags: MessageFlags.Ephemeral,
    });
  }
});

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  try {
    await client.application.commands.set([scrumCommand]);
    console.log("Slash commands registered");
  } catch (err) {
    console.error("Failed to register slash commands:", err);
  }

  // 매주 월(1), 목(4) 19:00 KST
  cron.schedule("0 19 * * 1,4", sendScrumReminder, {
    timezone: "Asia/Seoul",
  });

  console.log(
    `Scheduler started: every Mon/Thu 19:00 Asia/Seoul (enabled=${state.enabled})`,
  );
});

client.login(DISCORD_TOKEN);
