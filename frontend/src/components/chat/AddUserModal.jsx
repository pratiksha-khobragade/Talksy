import { useState } from "react";
import { X, UserPlus, Check, XCircle } from "lucide-react";

import { useChatStore } from "../../store/useChatStore";

function AddUserModal({ onClose }) {
  const [email, setEmail] = useState("");

  const contactRequests = useChatStore(
    (state) => state.contactRequests,
  );

  const sendContactRequest = useChatStore(
    (state) => state.sendContactRequest,
  );

  const respondToContactRequest =
    useChatStore(
      (state) =>
        state.respondToContactRequest,
    );

  const isSendingContactRequest =
    useChatStore(
      (state) =>
        state.isSendingContactRequest,
    );

  const handleSubmit = async (event) => {
    event.preventDefault();

    const success =
      await sendContactRequest(email);

    if (success) {
      setEmail("");
    }
  };

  const handleResponse = async (
    requestId,
    action,
  ) => {
    await respondToContactRequest(
      requestId,
      action,
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-2xl">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              Add User
            </h2>

            <p className="mt-1 text-sm text-muted">
              Add a real Talksy user by email.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 transition hover:bg-muted/20"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Add user form */}
        <form
          onSubmit={handleSubmit}
          className="flex gap-2"
        >
          <input
            type="email"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
            placeholder="Enter user's email"
            className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            required
          />

          <button
            type="submit"
            disabled={
              isSendingContactRequest
            }
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <UserPlus className="size-4" />

            {isSendingContactRequest
              ? "Sending..."
              : "Add"}
          </button>
        </form>

        {/* Incoming requests */}
        {contactRequests.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-3 text-sm font-semibold">
              Contact Requests
            </h3>

            <div className="space-y-2">
              {contactRequests.map(
                (request) => (
                  <div
                    key={request._id}
                    className="flex items-center gap-3 rounded-xl border border-border p-3"
                  >
                    <img
                      src={
                        request.requester
                          ?.profilePic ||
                        ""
                      }
                      alt=""
                      className="size-10 rounded-full object-cover"
                    />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {
                          request
                            .requester
                            ?.fullName
                        }
                      </p>

                      <p className="truncate text-xs text-muted">
                        {
                          request
                            .requester
                            ?.email
                        }
                      </p>
                    </div>

                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          handleResponse(
                            request._id,
                            "accepted",
                          )
                        }
                        className="rounded-lg p-2 text-green-500 transition hover:bg-green-500/10"
                        title="Accept"
                      >
                        <Check className="size-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleResponse(
                            request._id,
                            "rejected",
                          )
                        }
                        className="rounded-lg p-2 text-red-500 transition hover:bg-red-500/10"
                        title="Reject"
                      >
                        <XCircle className="size-4" />
                      </button>
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>
        )}

        {contactRequests.length === 0 && (
          <p className="mt-5 text-center text-xs text-muted">
            No pending contact requests.
          </p>
        )}
      </div>
    </div>
  );
}

export default AddUserModal;