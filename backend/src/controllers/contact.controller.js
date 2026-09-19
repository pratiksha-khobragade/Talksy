import Contact from "../models/contact.model.js";
import User from "../models/user.model.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

/*
  Get all accepted contacts of the logged-in user.

  We only return users who have accepted a contact request.
  This is what makes the Users tab behave like a real contact list.
*/
export async function getContacts(req, res) {
  try {
    const myId = req.user._id;

    const contacts = await Contact.find({
      status: "accepted",
      $or: [{ requester: myId }, { recipient: myId }],
    });

    const contactIds = contacts.map((contact) =>
      String(contact.requester) === String(myId)
        ? contact.recipient
        : contact.requester,
    );

    const users = await User.find({
      _id: { $in: contactIds },
    }).select("-clerkId");

    res.status(200).json(users);
  } catch (error) {
    console.error("Error in getContacts:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
}

/*
  Get incoming pending requests.

  Only requests sent TO the logged-in user are returned.
*/
export async function getContactRequests(req, res) {
  try {
    const myId = req.user._id;

    const requests = await Contact.find({
      recipient: myId,
      status: "pending",
    })
      .populate("requester", "fullName email profilePic")
      .sort({ createdAt: -1 });

    res.status(200).json(requests);
  } catch (error) {
    console.error("Error in getContactRequests:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
}

/*
  Send a new contact request.

  IMPORTANT:
  We search the User collection.
  That means the person must already be a real Talksy/Clerk user.
*/
export async function sendContactRequest(req, res) {
  try {
    const myId = req.user._id;
    const email = req.body.email?.trim().toLowerCase();

    if (!email) {
      return res.status(400).json({
        message: "Please enter an email address",
      });
    }

    // Find the real Talksy user.
    const recipient = await User.findOne({ email });

    if (!recipient) {
      return res.status(404).json({
        message: "No Talksy user found with this email",
      });
    }

    // Do not allow someone to add themselves.
    if (String(recipient._id) === String(myId)) {
      return res.status(400).json({
        message: "You cannot add yourself",
      });
    }

    // Check whether these two users are already connected.
    const existingAccepted = await Contact.findOne({
      status: "accepted",
      $or: [
        { requester: myId, recipient: recipient._id },
        { requester: recipient._id, recipient: myId },
      ],
    });

    if (existingAccepted) {
      return res.status(400).json({
        message: "You are already connected with this user",
      });
    }

    // Check for an existing pending request in either direction.
    const existingPending = await Contact.findOne({
      status: "pending",
      $or: [
        { requester: myId, recipient: recipient._id },
        { requester: recipient._id, recipient: myId },
      ],
    });

    if (existingPending) {
      return res.status(400).json({
        message: "A contact request is already pending",
      });
    }

    // Create the request.
    const request = await Contact.create({
      requester: myId,
      recipient: recipient._id,
      status: "pending",
    });

    // Send the request instantly if the recipient is online.
    const receiverSocketId = getReceiverSocketId(String(recipient._id));

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("contactRequest", {
        _id: request._id,
        requester: {
          _id: req.user._id,
          fullName: req.user.fullName,
          email: req.user.email,
          profilePic: req.user.profilePic,
        },
        createdAt: request.createdAt,
      });
    }

    res.status(201).json({
      message: "Contact request sent",
    });
  } catch (error) {
    console.error("Error in sendContactRequest:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
}

/*
  Accept or reject a contact request.
*/
export async function respondToContactRequest(req, res) {
  try {
    const myId = req.user._id;
    const { id } = req.params;
    const { action } = req.body;

    if (!["accepted", "rejected"].includes(action)) {
      return res.status(400).json({
        message: "Invalid request action",
      });
    }

    // Only the recipient can accept or reject the request.
    const request = await Contact.findOne({
      _id: id,
      recipient: myId,
      status: "pending",
    });

    if (!request) {
      return res.status(404).json({
        message: "Contact request not found",
      });
    }

    request.status = action;
    await request.save();

    // Tell the requester what happened.
    const requesterSocketId = getReceiverSocketId(String(request.requester));

    if (requesterSocketId) {
      io.to(requesterSocketId).emit("contactRequestUpdated", {
        requestId: String(request._id),
        status: action,
      });
    }

    // Also update the current user's other open tabs.
    const mySocketId = getReceiverSocketId(String(myId));

    if (mySocketId) {
      io.to(mySocketId).emit("contactRequestUpdated", {
        requestId: String(request._id),
        status: action,
      });
    }

    res.status(200).json({
      message:
        action === "accepted"
          ? "Contact request accepted"
          : "Contact request rejected",
    });
  } catch (error) {
    console.error("Error in respondToContactRequest:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
}