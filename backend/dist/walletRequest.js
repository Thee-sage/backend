"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const User_1 = require("./models/User"); // Adjust the import path to where your User model is defined
const Wallet_1 = require("./models/Wallet"); // Adjust the import path to where your Wallet model is defined
const WalletRequest_1 = require("./models/WalletRequest"); // Import the WalletRequest model
const router = express_1.default.Router();
// POST /wallet/request: Request more money
router.post("/request", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { uid, requestedAmount } = req.body;
    if (!uid || !requestedAmount || requestedAmount <= 0) {
        return res.status(400).send({ error: "Invalid request data." });
    }
    try {
        const user = yield User_1.User.findOne({ uid });
        if (!user) {
            return res.status(404).send({ error: "User not found." });
        }
        const walletRequest = new WalletRequest_1.WalletRequest({
            uid,
            email: user.email,
            requestedAmount
        });
        yield walletRequest.save();
        res.status(201).send({ message: "Request submitted successfully." });
    }
    catch (error) {
        console.error('Error submitting wallet request:', error);
        res.status(500).send({ error: "Server error" });
    }
}));
// GET /wallet/requests: Fetch all wallet requests
router.get("/requests", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const requests = yield WalletRequest_1.WalletRequest.find();
        res.status(200).send(requests);
    }
    catch (error) {
        console.error('Error fetching wallet requests:', error);
        res.status(500).send({ error: "Server error" });
    }
}));
// PATCH /wallet/request/:id/approve: Approve wallet request
router.patch("/request/:id/approve", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { adminEmail } = req.body; // Add this to get admin's email
    const io = req.io;
    if (!adminEmail) {
        return res.status(400).send({ error: "Admin email is required." });
    }
    try {
        const request = yield WalletRequest_1.WalletRequest.findById(id);
        if (!request) {
            return res.status(404).send({ error: "Request not found." });
        }
        if (request.status !== 'pending') {
            return res.status(400).send({ error: "Request has already been processed." });
        }
        // Update request status and signedBy
        request.status = 'approved';
        request.signedBy = adminEmail;
        request.updatedAt = new Date();
        yield request.save();
        // Update wallet balance
        const wallet = yield Wallet_1.Wallet.findOne({ uid: request.uid });
        if (!wallet) {
            return res.status(404).send({ error: "Wallet not found." });
        }
        wallet.balance += request.requestedAmount;
        yield wallet.save();
        // Emit event to notify frontend
        io.emit("walletRequestApproved", {
            uid: request.uid,
            newBalance: wallet.balance,
            signedBy: adminEmail
        });
        res.send({
            message: "Request approved and wallet updated.",
            newBalance: wallet.balance,
            signedBy: adminEmail
        });
    }
    catch (error) {
        console.error('Error approving wallet request:', error);
        res.status(500).send({ error: "Server error" });
    }
}));
// PATCH /wallet/request/:id/reject: Reject wallet request
router.patch("/request/:id/reject", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { adminEmail } = req.body; // Add this to get admin's email
    const io = req.io;
    if (!adminEmail) {
        return res.status(400).send({ error: "Admin email is required." });
    }
    try {
        const request = yield WalletRequest_1.WalletRequest.findById(id);
        if (!request) {
            return res.status(404).send({ error: "Request not found." });
        }
        if (request.status !== 'pending') {
            return res.status(400).send({ error: "Request has already been processed." });
        }
        // Update request status and signedBy
        request.status = 'rejected';
        request.signedBy = adminEmail;
        request.updatedAt = new Date();
        yield request.save();
        // Emit event to notify frontend
        io.emit("walletRequestRejected", {
            uid: request.uid,
            signedBy: adminEmail
        });
        res.send({
            message: "Request rejected.",
            signedBy: adminEmail
        });
    }
    catch (error) {
        console.error('Error rejecting wallet request:', error);
        res.status(500).send({ error: "Server error" });
    }
}));
exports.default = router;
