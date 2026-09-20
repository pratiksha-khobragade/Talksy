import express from "express";
import User from "../models/user.model.js";
import { verifyWebhook } from "@clerk/express/webhooks";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    console.log("🔥 CLERK WEBHOOK RECEIVED");

    const event = await verifyWebhook(req, {
      signingSecret: process.env.CLERK_WEBHOOK_SIGNING_SECRET,
    });

    console.log("✅ Clerk webhook verified");
    console.log("📦 Event type:", event.type);

    // =====================================================
    // USER CREATED / UPDATED
    // =====================================================

    if (
      event.type === "user.created" ||
      event.type === "user.updated"
    ) {
      const clerkUser = event.data;

      console.log("👤 Clerk user ID:", clerkUser.id);

      const email =
        clerkUser.email_addresses?.find(
          (emailAddress) =>
            emailAddress.id ===
            clerkUser.primary_email_address_id,
        )?.email_address ||
        clerkUser.email_addresses?.[0]?.email_address ||
        null;

      const fullName =
        [clerkUser.first_name, clerkUser.last_name]
          .filter(Boolean)
          .join(" ")
          .trim() ||
        clerkUser.username ||
        "Talksy User";

      const profilePic =
        clerkUser.image_url ||
        clerkUser.profile_image_url ||
        "";

      if (!clerkUser.id) {
        console.error("❌ Clerk user ID is missing");

        return res.status(400).json({
          message: "Clerk user ID is missing",
        });
      }

      // If Clerk doesn't provide email in this event,
      // don't crash the webhook.
      //
      // This is especially useful for Clerk test events.
      if (!email) {
        console.warn(
          "⚠️ Clerk webhook has no email. Skipping database sync for this event.",
        );

        return res.status(200).json({
          received: true,
          synced: false,
          reason: "No email provided by Clerk event",
        });
      }

      const user = await User.findOneAndUpdate(
        {
          clerkId: clerkUser.id,
        },
        {
          $set: {
            clerkId: clerkUser.id,
            email,
            fullName,
            profilePic,
          },
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        },
      );

      console.log("✅ Talksy user synced:");

      console.log({
        id: user._id,
        clerkId: user.clerkId,
        email: user.email,
        fullName: user.fullName,
      });
    }

    // =====================================================
    // USER DELETED
    // =====================================================

    if (event.type === "user.deleted") {
      const clerkUserId = event.data.id;

      if (!clerkUserId) {
        console.error(
          "❌ Deleted Clerk user ID is missing",
        );

        return res.status(400).json({
          message: "Deleted user ID is missing",
        });
      }

      const deletedUser = await User.findOneAndDelete({
        clerkId: clerkUserId,
      });

      if (deletedUser) {
        console.log("🗑️ Talksy user deleted:");

        console.log({
          clerkId: deletedUser.clerkId,
          email: deletedUser.email,
          fullName: deletedUser.fullName,
        });
      } else {
        console.log(
          "ℹ️ Clerk user deleted, but no matching Talksy user was found:",
          clerkUserId,
        );
      }
    }

    return res.status(200).json({
      received: true,
    });
  } catch (error) {
    console.error("❌ Error processing Clerk webhook:");
    console.error(error);

    return res.status(400).json({
      message: "Webhook verification failed",
    });
  }
});

export default router;