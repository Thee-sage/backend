"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const adsads_1 = __importDefault(require("./adsads"));
const Casino_1 = __importDefault(require("./Casino"));
const router = express_1.default.Router();
// This means /ads/ads/... which might be redundant
// router.use('/', adRoutes);  
// Better approach:
router.use('/ad', adsads_1.default); // Will handle /ads/ad/...
router.use('/casino', Casino_1.default); // Will handle /ads/casino/...
exports.default = router;
