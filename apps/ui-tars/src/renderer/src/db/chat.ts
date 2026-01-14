/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
// /apps/ui-tars/src/renderer/src/db/chat.ts
import { get, set, del, entries, createStore } from 'idb-keyval';
import { ConversationWithSoM } from '@/main/shared/types';

export interface ChatMetaInfo {
  [key: string]: any;
}

const DBName = 'ui_tars_db_chat';
const chatStore = createStore(DBName, 'chats');

export class ChatManager {
  async createSessionMessages(
    sessionId: string,
    messages: ConversationWithSoM[],
  ) {
    await set(sessionId, messages, chatStore);
    return messages;
  }

  async updateSessionMessages(
    sessionId: string,
    messages: ConversationWithSoM[],
  ) {
    await set(sessionId, messages, chatStore);

    return messages;
  }

  // 获取会话的所有消息
  async getSessionMessages(sessionId: string) {
    return get<ConversationWithSoM[]>(sessionId, chatStore);
  }

  // 删除会话相关的所有消息
  async deleteSessionMessages(sessionId: string) {
    await del(sessionId, chatStore);

    return true;
  }

  async clearAllChats() {
    const keys = await entries(chatStore);
    await Promise.all(keys.map(([key]) => del(key, chatStore)));
  }

  async clearAllScreenshots() {
    const entriesList = await entries(chatStore);
    await Promise.all(
      entriesList.map(async ([key, value]) => {
        const messages = value as ConversationWithSoM[];
        const updatedMessages = messages.map((msg) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const {
            screenshotBase64,
            screenshotBase64WithElementMarker,
            ...rest
          } = msg;
          return rest as ConversationWithSoM;
        });
        await set(key, updatedMessages, chatStore);
      }),
    );
  }

  async getChatUsage() {
    const items = await entries(chatStore);
    const jsonString = JSON.stringify(items);
    return new Blob([jsonString]).size;
  }
}

export const chatManager = new ChatManager();
