import type { OpenClawConfig } from "../../config/config.js";
import type { DiscordConfig } from "../../config/types.js";
import type {
  GroupToolPolicyBySenderConfig,
  GroupToolPolicyConfig,
} from "../../config/types.tools.js";
import {
  resolveChannelGroupRequireMention,
  resolveChannelGroupToolsPolicy,
  resolveToolsBySender,
} from "../../config/group-policy.js";

type GroupMentionParams = {
  cfg: OpenClawConfig;
  groupId?: string | null;
  groupChannel?: string | null;
  groupSpace?: string | null;
  accountId?: string | null;
  senderId?: string | null;
  senderName?: string | null;
  senderUsername?: string | null;
  senderE164?: string | null;
};

function normalizeDiscordSlug(value?: string | null) {
  if (!value) {
    return "";
  }
  let text = value.trim().toLowerCase();
  if (!text) {
    return "";
  }
  text = text.replace(/^[@#]+/, "");
  text = text.replace(/[\s_]+/g, "-");
  text = text.replace(/[^a-z0-9-]+/g, "-");
  text = text.replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "");
  return text;
}

function resolveDiscordGuildEntry(guilds: DiscordConfig["guilds"], groupSpace?: string | null) {
  if (!guilds || Object.keys(guilds).length === 0) {
    return null;
  }
  const space = groupSpace?.trim() ?? "";
  if (space && guilds[space]) {
    return guilds[space];
  }
  const normalized = normalizeDiscordSlug(space);
  if (normalized && guilds[normalized]) {
    return guilds[normalized];
  }
  if (normalized) {
    const match = Object.values(guilds).find(
      (entry) => normalizeDiscordSlug(entry?.slug ?? undefined) === normalized,
    );
    if (match) {
      return match;
    }
  }
  return guilds["*"] ?? null;
}

export function resolveDiscordGroupRequireMention(params: GroupMentionParams): boolean {
  const guildEntry = resolveDiscordGuildEntry(
    params.cfg.channels?.discord?.guilds,
    params.groupSpace,
  );
  const channelEntries = guildEntry?.channels;
  if (channelEntries && Object.keys(channelEntries).length > 0) {
    const groupChannel = params.groupChannel;
    const channelSlug = normalizeDiscordSlug(groupChannel);
    const entry =
      (params.groupId ? channelEntries[params.groupId] : undefined) ??
      (channelSlug
        ? (channelEntries[channelSlug] ?? channelEntries[`#${channelSlug}`])
        : undefined) ??
      (groupChannel ? channelEntries[normalizeDiscordSlug(groupChannel)] : undefined);
    if (entry && typeof entry.requireMention === "boolean") {
      return entry.requireMention;
    }
  }
  if (typeof guildEntry?.requireMention === "boolean") {
    return guildEntry.requireMention;
  }
  return true;
}

export function resolveGoogleChatGroupRequireMention(params: GroupMentionParams): boolean {
  return resolveChannelGroupRequireMention({
    cfg: params.cfg,
    channel: "googlechat",
    groupId: params.groupId,
    accountId: params.accountId,
  });
}

export function resolveGoogleChatGroupToolPolicy(
  params: GroupMentionParams,
): GroupToolPolicyConfig | undefined {
  return resolveChannelGroupToolsPolicy({
    cfg: params.cfg,
    channel: "googlechat",
    groupId: params.groupId,
    accountId: params.accountId,
    senderId: params.senderId,
    senderName: params.senderName,
    senderUsername: params.senderUsername,
    senderE164: params.senderE164,
  });
}

export function resolveDiscordGroupToolPolicy(
  params: GroupMentionParams,
): GroupToolPolicyConfig | undefined {
  const guildEntry = resolveDiscordGuildEntry(
    params.cfg.channels?.discord?.guilds,
    params.groupSpace,
  );
  const channelEntries = guildEntry?.channels;
  if (channelEntries && Object.keys(channelEntries).length > 0) {
    const groupChannel = params.groupChannel;
    const channelSlug = normalizeDiscordSlug(groupChannel);
    const entry =
      (params.groupId ? channelEntries[params.groupId] : undefined) ??
      (channelSlug
        ? (channelEntries[channelSlug] ?? channelEntries[`#${channelSlug}`])
        : undefined) ??
      (groupChannel ? channelEntries[normalizeDiscordSlug(groupChannel)] : undefined);
    const senderPolicy = resolveToolsBySender({
      toolsBySender: entry?.toolsBySender,
      senderId: params.senderId,
      senderName: params.senderName,
      senderUsername: params.senderUsername,
      senderE164: params.senderE164,
    });
    if (senderPolicy) {
      return senderPolicy;
    }
    if (entry?.tools) {
      return entry.tools;
    }
  }
  const guildSenderPolicy = resolveToolsBySender({
    toolsBySender: guildEntry?.toolsBySender,
    senderId: params.senderId,
    senderName: params.senderName,
    senderUsername: params.senderUsername,
    senderE164: params.senderE164,
  });
  if (guildSenderPolicy) {
    return guildSenderPolicy;
  }
  if (guildEntry?.tools) {
    return guildEntry.tools;
  }
  return undefined;
}
