"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// auth/index.ts (main auth router file)
const express_1 = __importDefault(require("express"));
const regularAuth_1 = __importDefault(require("./regularAuth")); // your current auth.ts
const google_1 = __importDefault(require("./google")); // your current google.ts
const contact_1 = __importDefault(require("./contact"));
const router = express_1.default.Router();
// Mount both auth routes under appropriate paths
router.use('/', regularAuth_1.default); // handles /api/auth/login, /api/auth/signup etc.
router.use('/google', google_1.default); // handles /api/auth/google/callback etc.
router.use('/contact', contact_1.default); // handles /api/auth/contact etc.
exports.default = router;
