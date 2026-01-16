/*
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { initIpc } from '@ui-tars/electron-ipc/main';
import { StatusEnum, Conversation, Message } from '@ui-tars/shared/types';
import { store } from '@main/store/create';
import { AppState } from '@main/store/types';
import { runAgent } from '@main/services/runAgent';
import { showWindow } from '@main/window/index';

import { closeScreenMarker } from '@main/window/ScreenMarker';
import { GUIAgent } from '@ui-tars/sdk';
import { Operator } from '@ui-tars/sdk/core';

const t = initIpc.create();

export class GUIAgentManager {
  private static instance: GUIAgentManager;
  private currentAgent: GUIAgent<Operator> | null = null;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  public static getInstance(): GUIAgentManager {
    if (!GUIAgentManager.instance) {
      GUIAgentManager.instance = new GUIAgentManager();
    }
    return GUIAgentManager.instance;
  }

  public setAgent(agent: GUIAgent<Operator>) {
    this.currentAgent = agent;
  }

  public getAgent(): GUIAgent<Operator> | null {
    return this.currentAgent;
  }

  public clearAgent() {
    this.currentAgent = null;
  }
}

export const agentRoute = t.router({
  runAgent: t.procedure.input<void>().handle(async () => {
    const { thinking, status } = store.getState();
    console.log('[runAgent] Called - thinking:', thinking, 'status:', status);
    if (thinking) {
      console.log('[runAgent] Already thinking, returning early');
      return;
    }

    store.setState({
      abortController: new AbortController(),
      thinking: true,
      status: StatusEnum.RUNNING,
      errorMsg: null,
    });
    console.log('[runAgent] State set to RUNNING, thinking: true');

    // Start the agent loop in the background so we don't block the IPC response
    (async () => {
      console.log('[MessageQueue] Starting agent loop');
      // eslint-disable-next-line no-constant-condition
      while (true) {
        // Intercept setState to prevent UI flash (status END/CALL_USER) if we have pending messages
        const wrappedSetState = (newState: AppState) => {
          const { pendingMessages } = store.getState();
          if (
            pendingMessages.length > 0 &&
            (newState.status === StatusEnum.END ||
              newState.status === StatusEnum.CALL_USER)
          ) {
            // Keep it running seamlessly
            newState.status = StatusEnum.RUNNING;
            newState.thinking = true;
          }
          store.setState(newState);
        };

        try {
          console.log('[runAgent] Calling runAgent service...');
          await runAgent(wrappedSetState, store.getState);
          console.log('[runAgent] runAgent service returned');
        } catch (error) {
          console.error('Error in agent loop:', error);
          store.setState({
            status: StatusEnum.ERROR,
            errorMsg:
              error instanceof Error
                ? error.message
                : 'Unknown error in agent loop',
            thinking: false,
          });
          break;
        }

        const { pendingMessages, status, messages } = store.getState();
        console.log(
          '[MessageQueue] After runAgent - pendingMessages:',
          pendingMessages.length,
          'status:',
          status,
        );
        const nextMessage = pendingMessages[0];

        // If we have a next message and the agent didn't crash or wasn't stopped manually
        // Note: If we suppressed END, status is RUNNING.
        if (
          nextMessage &&
          status !== StatusEnum.ERROR &&
          status !== StatusEnum.USER_STOPPED &&
          !store.getState().abortController?.signal.aborted
        ) {
          // Persist history for the next run
          const historyMessages = messages.map((msg) => {
            const {
              screenshotBase64,
              screenshotBase64WithElementMarker,
              screenshotContext,
              ...rest
            } = msg;
            return rest;
          });

          // Create the new human message for the queued instruction
          const newHumanMessage: Conversation = {
            from: 'human',
            value: nextMessage,
            timing: { start: Date.now(), end: Date.now(), cost: 0 },
          };

          store.setState({
            instructions: nextMessage,
            pendingMessages: pendingMessages.slice(1),
            sessionHistoryMessages: historyMessages, // Pass lightweight context to next agent instance
            messages: [...messages, newHumanMessage], // Add the human message to conversation
            status: StatusEnum.RUNNING,
            thinking: true,
          });
        } else {
          console.log(
            '[MessageQueue] Breaking loop - no pending messages or agent stopped',
          );
          break;
        }
      }

      store.setState({ thinking: false });
    })();
  }),
  pauseRun: t.procedure.input<void>().handle(async () => {
    const guiAgent = GUIAgentManager.getInstance().getAgent();
    if (guiAgent instanceof GUIAgent) {
      guiAgent.pause();
      store.setState({ thinking: false });
    }
  }),
  resumeRun: t.procedure.input<void>().handle(async () => {
    const guiAgent = GUIAgentManager.getInstance().getAgent();
    if (guiAgent instanceof GUIAgent) {
      guiAgent.resume();
      store.setState({ thinking: false });
    }
  }),
  stopRun: t.procedure.input<void>().handle(async () => {
    const { abortController } = store.getState();
    store.setState({
      status: StatusEnum.END,
      thinking: false,
      pendingMessages: [],
    });

    showWindow();

    abortController?.abort();
    const guiAgent = GUIAgentManager.getInstance().getAgent();
    if (guiAgent instanceof GUIAgent) {
      guiAgent.resume();
      guiAgent.stop();
    }

    closeScreenMarker();
  }),
  setInstructions: t.procedure
    .input<{ instructions: string }>()
    .handle(async ({ input }) => {
      store.setState({ instructions: input.instructions });
    }),
  addPendingMessage: t.procedure
    .input<{ message: string }>()
    .handle(async ({ input }) => {
      const { pendingMessages } = store.getState();
      console.log(
        '[MessageQueue] addPendingMessage called:',
        input.message,
        'current queue size:',
        pendingMessages.length,
      );
      store.setState({
        pendingMessages: [...pendingMessages, input.message],
      });
      console.log('[MessageQueue] New queue size:', pendingMessages.length + 1);
    }),
  setMessages: t.procedure
    .input<{ messages: Conversation[] }>()
    .handle(async ({ input }) => {
      store.setState({ messages: input.messages });
    }),
  setSessionHistoryMessages: t.procedure
    .input<{ messages: Message[] }>()
    .handle(async ({ input }) => {
      store.setState({ sessionHistoryMessages: input.messages });
    }),
  clearHistory: t.procedure.input<void>().handle(async () => {
    store.setState({
      status: StatusEnum.END,
      messages: [],
      thinking: false,
      errorMsg: null,
      instructions: '',
      pendingMessages: [],
    });
  }),
});
