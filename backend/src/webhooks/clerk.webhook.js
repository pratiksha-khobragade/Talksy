import express from "express";
import User from "../models/user.model.js";
import { verifyWebhook } from "@clerk/backend/webhooks";

const router = express.Router();

/*
  Clerk sends user events to this webhook.

  Important:
  - user.created  -> create user in MongoDB
  - user.updated  -> update user in MongoDB
  - user.deleted  -> remove user from MongoDB

  This means we NEVER manually create fake users from the frontend.
  Only real Clerk users can appear in the Talksy Users list.
*/

router.post("/", async (req, res) => {
  try {
    console.log("🔥 CLERK WEBHOOK RECEIVED");

    // ---------------------------------------------------------
    // 1. Get the webhook signing secret
    // ---------------------------------------------------------

    const signingSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;

    if (!signingSecret) {
      console.error("❌ CLERK_WEBHOOK_SIGNING_SECRET is missing");

      return res.status(503).json({
        message: "Webhook secret is not configured",
      });
    }

    // ---------------------------------------------------------
    // 2. Clerk requires the ORIGINAL raw request body
    // ---------------------------------------------------------

    const payload = Buffer.isBuffer(req.body)
      ? req.body.toString("utf8")
      : String(req.body);

    /*
      Re-create a Web Request because Clerk's verifyWebhook()
      expects a Web Request object.
    */

    const request = new Request("http://localhost/webhooks/clerk", {
      method: "POST",

      headers: new Headers(req.headers),

      body: payload,
    });

    // ---------------------------------------------------------
    // 3. Verify that the webhook actually came from Clerk
    // ---------------------------------------------------------

    const event = await verifyWebhook(request, {
      signingSecret,
    });

    console.log("✅ Clerk webhook verified");
    console.log("📦 Event type:", event.type);

    // ---------------------------------------------------------
    // 4. USER CREATED / UPDATED
    // ---------------------------------------------------------

    if (event.type === "user.created" || event.type === "user.updated") {
      const clerkUser = event.data;

      // Find the primary email
      const email =
        clerkUser.email_addresses?.find(
          (emailAddress) =>
            emailAddress.id === clerkUser.primary_email_address_id,
        )?.email_address ||
        clerkUser.email_addresses?.[0]?.email_address;

      // -------------------------------------------------------
      // Make a readable full name
      // -------------------------------------------------------

      const fullName =
        [clerkUser.first_name, clerkUser.last_name]
          .filter(Boolean)
          .join(" ") ||
        clerkUser.username ||
        email?.split("@")[0] ||
        "Talksy User";

      // -------------------------------------------------------
      // Profile picture
      // -------------------------------------------------------

      const profilePic = clerkUser.image_url || "";

      // -------------------------------------------------------
      // Make sure the important Clerk data exists
      // -------------------------------------------------------

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

      // -------------------------------------------------------
      // Create or update the MongoDB user
      // -------------------------------------------------------

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

    // ---------------------------------------------------------
    // 5. USER DELETED
    // ---------------------------------------------------------

    if (event.type === "user.deleted") {
      const clerkUserId = event.data.id;

      if (!clerkUserId) {
        console.error("❌ Deleted Clerk user ID is missing");

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

    // ---------------------------------------------------------
    // 6. Tell Clerk that the webhook was successfully processed
    // ---------------------------------------------------------

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