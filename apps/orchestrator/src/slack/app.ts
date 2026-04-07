import { App } from "@slack/bolt";

let slackApp: App | null = null;

export function getSlackApp(): App {
  if (!slackApp) {
    const token = process.env.SLACK_BOT_TOKEN;
    const appToken = process.env.SLACK_APP_TOKEN;
    if (!token || !appToken) {
      throw new Error("SLACK_BOT_TOKEN and SLACK_APP_TOKEN must be set");
    }
    slackApp = new App({ token, appToken, socketMode: true });
  }
  return slackApp;
}

/**
 * Start the Slack app's Socket Mode connection.
 */
export async function startSlackApp(): Promise<void> {
  const app = getSlackApp();
  await app.start();
  console.log("[slack] Socket Mode connected");
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

/**
 * Post a main message then a thread reply with detail blocks.
 * Returns the main message ts.
 */
export async function postWithThread(params: {
  channel: string;
  text: string;
  blocks?: Array<Record<string, unknown>>;
  threadText: string;
  threadBlocks?: Array<Record<string, unknown>>;
}): Promise<string | undefined> {
  const mainTs = await postMessage({
    channel: params.channel,
    text: params.text,
    blocks: params.blocks,
  });
  if (mainTs) {
    await postMessage({
      channel: params.channel,
      text: params.threadText,
      blocks: params.threadBlocks,
      thread_ts: mainTs,
    });
  }
  return mainTs;
}
