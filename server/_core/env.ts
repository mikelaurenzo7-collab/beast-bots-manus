import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().default(3001),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  BOT_BOSS_VAULT_KEY: z.string().optional(),
  BOT_BOSS_DATA_DIR: z.string().optional(),
  GITHUB_TOKEN: z.string().optional(),
  SLACK_BOT_TOKEN: z.string().optional(),
  NOTION_TOKEN: z.string().optional(),
  LINEAR_API_KEY: z.string().optional(),
});

const parsed = EnvSchema.parse(process.env);

const normalize = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

export const ENV = {
  port: parsed.PORT,
  openAIApiKey: normalize(parsed.OPENAI_API_KEY),
  openAIModel: normalize(parsed.OPENAI_MODEL),
  vaultKey: normalize(parsed.BOT_BOSS_VAULT_KEY),
  dataDir: normalize(parsed.BOT_BOSS_DATA_DIR),
  connectorTokens: {
    github: normalize(parsed.GITHUB_TOKEN),
    slack: normalize(parsed.SLACK_BOT_TOKEN),
    notion: normalize(parsed.NOTION_TOKEN),
    linear: normalize(parsed.LINEAR_API_KEY),
  },
} as const;