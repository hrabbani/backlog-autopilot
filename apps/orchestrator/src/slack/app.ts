import { App } from "@slack/bolt";

let slackApp: App | null = null;

export function getSlackApp(): App {
  if (!slackApp) {
    const token = process.env.SLACK_BOT_TOKEN;
    const signingSecret = process.env.SLACK_SIGNING_SECRET;
    if (!token || !signingSecret) {
      throw new Error("SLACK_BOT_TOKEN and SLACK_SIGNING_SECRET must be set");
    }
    slackApp = new App({ token, signingSecret, socketMode: false });
  }
  return slackApp;
}

/**
 * Post a message to a Slack channel.
 */
export async function postMessage(params: {
  channel: string;
  text: string;
  blocks?: Array<Record<string, unknown>>;
  thread_ts?: string;
}): Promise<string | undefined> {
  const app = getSlackApp();
  const result = await app.client.chat.postMessage({
    channel: params.channel,
    text: params.text,
    blocks: params.blocks as any,
    thread_ts: params.thread_ts,
  });
  return result.ts;
}

/**
 * Post a simple text message to the log channel.
 */
export async function postLogMessage(
  logChannel: string,
  text: string
): Promise<void> {
  await postMessage({ channel: logChannel, text });
}
