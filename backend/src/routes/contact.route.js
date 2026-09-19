import express from "express";

import {
  getContacts,
  getContactRequests,
  sendContactRequest,
  respondToContactRequest,
} from "../controllers/contact.controller.js";

import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

// All contact routes require a logged-in Talksy user.
router.use(protectRoute);

// Accepted contacts
router.get("/", getContacts);

// Incoming requests
router.get("/requests", getContactRequests);

// Send a new request
router.post("/request", sendContactRequest);

// Accept / reject request
router.patch("/requests/:id", respondToContactRequest);

export default router;