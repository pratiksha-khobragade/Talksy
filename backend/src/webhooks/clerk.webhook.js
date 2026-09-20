import express from "express";
import User from "../models/user.model.js";
import { verifyWebhook } from "@clerk/backend/webhooks";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    console.log("🔥 CLERK WEBHOOK RECEIVED");

    const signingSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;

    if (!signingSecret) {
      console.error("❌ CLERK_WEBHOOK_SIGNING_SECRET is missing");

      return res.status(503).json({
        message: "Webhook secret is not configured",
      });
    }

    // Clerk webhook body must remain the original raw body
    // for signature verification.
    const payload = Buffer.isBuffer(req.body)
      ? req.body.toString("utf8")
      : JSON.stringify(req.body);

    console.log("📦 Webhook body type:", typeof req.body);
    console.log("📦 Is Buffer:", Buffer.isBuffer(req.body));

    const request = new Request(
      "http://localhost/webhooks/clerk",
      {
        method: "POST",
        headers: new Headers(req.headers),
        body: payload,
      },
    );

    const event = await verifyWebhook(request, {
      signingSecret,
    });

    console.log("✅ Clerk webhook verified");
    console.log("📦 Event type:", event.type);
    console.log("📦 Event data:", JSON.stringify(event.data, null, 2));

    // =====================================================
    // USER CREATED / UPDATED
    // =====================================================

    if (
      event.type === "user.created" ||
      event.type === "user.updated"
    ) {
      const clerkUser = event.data;

      const email =
        clerkUser.email_addresses?.find(
          (emailAddress) =>
            emailAddress.id ===
            clerkUser.primary_email_address_id,
        )?.email_address ||
        clerkUser.email_addresses?.[0]?.email_address;

      const fullName =
        [clerkUser.first_name, clerkUser.last_name]
          .filter(Boolean)
          .join(" ") ||
        clerkUser.username ||
        email?.split("@")[0] ||
        "Talksy User";

      const profilePic = clerkUser.image_url || "";

      if (!clerkUser.id) {
        console.error("❌ Clerk user ID is missing");

        return res.status(400).json({
          message: "Clerk user ID is missing",
        });
      }

      if (!email) {
        console.error(
          `❌ No email found for Clerk user: ${clerkUser.id}`,
        );

        return res.status(400).json({
          message: "User email is missing",
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

    // =====================================================
    // SUCCESS
    // =====================================================

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