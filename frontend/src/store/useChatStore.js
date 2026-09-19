import { create } from "zustand";
import { persist } from "zustand/middleware";

import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

import toast from "react-hot-toast";

export const useChatStore = create(
  persist(
    (set, get) => ({
      users: [],
      conversations: [],
      messages: [],

      // Incoming contact requests
      contactRequests: [],

      selectedUser: null,

      isConversationsLoading: false,
      isUsersLoading: false,
      isMessagesLoading: false,
      isContactRequestsLoading: false,
      isSendingContactRequest: false,

      activeConversationId: null,
      searchQuery: "",
      sidebarTab: "chats",
      composerText: "",
      isSoundEnabled: true,
      isSendingMedia: false,

      /*
        Get accepted contacts.

        The backend now returns only users
        who have accepted our contact request.
      */
      getUsers: async () => {
        set({ isUsersLoading: true });

        try {
          const res = await axiosInstance.get(
            "/messages/users",
          );

          set((state) => ({
            users: res.data,

            selectedUser:
              state.selectedUser &&
              res.data.some(
                (user) =>
                  user._id === state.selectedUser._id,
              )
                ? state.selectedUser
                : null,
          }));
        } catch (error) {
          console.log(
            "Error in getUsers:",
            error.message,
          );
        } finally {
          set({ isUsersLoading: false });
        }
      },

      /*
        Get incoming contact requests.
      */
      getContactRequests: async () => {
        set({
          isContactRequestsLoading: true,
        });

        try {
          const res = await axiosInstance.get(
            "/contacts/requests",
          );

          set({
            contactRequests: res.data,
          });
        } catch (error) {
          console.log(
            "Error in getContactRequests:",
            error.message,
          );
        } finally {
          set({
            isContactRequestsLoading: false,
          });
        }
      },

      /*
        Send a new contact request.
      */
      sendContactRequest: async (email) => {
        if (!email.trim()) return false;

        set({
          isSendingContactRequest: true,
        });

        try {
          const res = await axiosInstance.post(
            "/contacts/request",
            { email },
          );

          toast.success(
            res.data.message ||
              "Contact request sent",
          );

          return true;
        } catch (error) {
          toast.error(
            error.response?.data?.message ||
              "Could not send request",
          );

          return false;
        } finally {
          set({
            isSendingContactRequest: false,
          });
        }
      },

      /*
        Accept or reject a request.
      */
      respondToContactRequest: async (
        requestId,
        action,
      ) => {
        try {
          const res = await axiosInstance.patch(
            `/contacts/requests/${requestId}`,
            { action },
          );

          toast.success(res.data.message);

          // Refresh both lists after accepting/rejecting.
          await get().getContactRequests();

          if (action === "accepted") {
            await get().getUsers();
          }

          return true;
        } catch (error) {
          toast.error(
            error.response?.data?.message ||
              "Could not update request",
          );

          return false;
        }
      },

      /*
        Listen for real-time contact requests.
      */
      subscribeToContactRequests: () => {
        const socket =
          useAuthStore.getState().socket;

        if (!socket) return;

        socket.off("contactRequest");
        socket.off("contactRequestUpdated");

        // Someone sent us a request.
        socket.on(
          "contactRequest",
          (request) => {
            set((state) => {
              const alreadyExists =
                state.contactRequests.some(
                  (item) =>
                    item._id === request._id,
                );

              if (alreadyExists) {
                return state;
              }

              return {
                contactRequests: [
                  request,
                  ...state.contactRequests,
                ],
              };
            });

            toast.success(
              `${request.requester.fullName} sent you a contact request`,
            );
          },
        );

        // A request was accepted or rejected.
        socket.on(
          "contactRequestUpdated",
          async () => {
            await get().getContactRequests();
            await get().getUsers();
          },
        );
      },

      unsubscribeFromContactRequests: () => {
        const socket =
          useAuthStore.getState().socket;

        socket?.off("contactRequest");
        socket?.off("contactRequestUpdated");
      },

      getConversations: async () => {
        set({
          isConversationsLoading: true,
        });

        try {
          const res = await axiosInstance.get(
            "/messages/conversations",
          );

          set({
            conversations: res.data,
          });
        } catch (error) {
          console.log(
            "Error in getConversations:",
            error.message,
          );
        } finally {
          set({
            isConversationsLoading: false,
          });
        }
      },

      getMessages: async (userId) => {
        if (!userId) return;

        set({
          isMessagesLoading: true,
        });

        try {
          const res = await axiosInstance.get(
            `/messages/${userId}`,
          );

          set({
            messages: res.data,
          });
        } catch (error) {
          toast.error(
            error.response?.data?.message ||
              "Failed to load messages",
          );
        } finally {
          set({
            isMessagesLoading: false,
          });
        }
      },

      sendMessage: async (messageData) => {
        const {
          selectedUser,
          messages,
        } = get();

        if (!selectedUser) return false;

        try {
          const res =
            await axiosInstance.post(
              `/messages/send/${selectedUser._id}`,
              messageData,
            );

          set({
            messages: [
              ...messages,
              res.data,
            ],
            composerText: "",
          });

          get().getConversations();

          return true;
        } catch (error) {
          toast.error(
            error.response?.data?.message ||
              "Failed to send message",
          );

          return false;
        }
      },

      subscribeToMessages: (userId) => {
        if (!userId) return;

        const socket =
          useAuthStore.getState().socket;

        if (!socket) return;

        socket.off("newMessage");

        socket.on(
          "newMessage",
          (newMessage) => {
            // Ignore messages from other chats.
            if (
              String(newMessage.senderId) !==
              String(userId)
            ) {
              return;
            }

            set({
              messages: [
                ...get().messages,
                newMessage,
              ],
            });

            get().getConversations();
          },
        );
      },

      unsubscribeFromMessages: () => {
        const socket =
          useAuthStore.getState().socket;

        socket?.off("newMessage");
      },

      setSelectedUser: (selectedUser) =>
        set({ selectedUser }),

      setActiveConversationId: (
        activeConversationId,
      ) => {
        set((state) => ({
          activeConversationId,

          selectedUser:
            state.users.find(
              (user) =>
                user._id ===
                activeConversationId,
            ) ||
            state.conversations.find(
              (user) =>
                user._id ===
                activeConversationId,
            ) ||
            null,

          messages: activeConversationId
            ? state.messages
            : [],
        }));
      },

      setSearchQuery: (searchQuery) =>
        set({ searchQuery }),

      setSidebarTab: (sidebarTab) =>
        set({ sidebarTab }),

      setComposerText: (composerText) =>
        set({ composerText }),

      setSoundEnabled: (isSoundEnabled) =>
        set({ isSoundEnabled }),

      sendTextMessage: async (
        conversationId,
      ) => {
        const messageText =
          get().composerText.trim();

        if (
          !conversationId ||
          !messageText
        ) {
          return false;
        }

        return get().sendMessage({
          text: messageText,
        });
      },

      sendMediaMessage: async ({
        conversationId,
        file,
      }) => {
        if (!conversationId || !file) {
          return false;
        }

        const formData = new FormData();

        formData.append(
          "media",
          file,
        );

        set({
          isSendingMedia: true,
        });

        try {
          return await get().sendMessage(
            formData,
          );
        } finally {
          set({
            isSendingMedia: false,
          });
        }
      },
    }),

    {
      name: "Talksy-storage",

      // Don't persist users/messages/requests.
      // They should always come fresh from the backend.
      partialize: (state) => ({
        isSoundEnabled:
          state.isSoundEnabled,
      }),
    },
  ),
);