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
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const google_auth_library_1 = require("google-auth-library");
const app = (0, express_1.default)();
const client = new google_auth_library_1.OAuth2Client(process.env.GOOGLE_CLIENT_ID);
// CORS setup
app.use((0, cors_1.default)({
    origin: ['http://localhost:5173', 'http://localhost:3000'], // Adjusted origins
    credentials: true
}));
// Middleware to set Cross-Origin-Opener-Policy and Cross-Origin-Embedder-Policy
app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups'); // Adjusted COOP header
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    next();
});
app.use(express_1.default.json());
app.post('/auth/google', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { token } = req.body;
    try {
        // Verify the token with Google
        const ticket = yield client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (!payload) {
            return res.status(401).send({ error: 'Invalid token' });
        }
        const { sub, email, name, picture } = payload;
        // Send the user data back to the frontend
        res.send({ userId: sub, email, name, picture });
    }
    catch (error) {
        res.status(401).send({ error: 'Invalid token' });
    }
}));
app.listen(3000, () => {
    console.log("Server is running on port 3000");
});
