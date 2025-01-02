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
const Ad_1 = require("./models/Ad");
const router = express_1.default.Router();
// Get all public ads with complete casino information
router.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const ads = yield Ad_1.Ad.find({})
            .select('title description link imageUrl rating service location isShowInMainPage percentageInHomePage orderInCasinosPage casino')
            .populate({
            path: 'casino',
            select: 'name description logo website established ourRating userRating trustIndex ' +
                'categoryRatings payoutRatio payoutSpeed licenses securityMeasures fairnessVerification ' +
                'paymentMethods currencies minDeposit maxPayout contentSections advantages disadvantages ' +
                'isActive orderInListing offer'
        })
            .lean();
        // Add verification logging
        console.log('Populated ads:', ads.map(ad => {
            var _a, _b;
            return ({
                id: ad._id,
                title: ad.title,
                casinoName: (_a = ad.casino) === null || _a === void 0 ? void 0 : _a.name,
                casinoId: (_b = ad.casino) === null || _b === void 0 ? void 0 : _b._id
            });
        }));
        if (!ads || ads.length === 0) {
            return res.status(404).json({ message: 'No ads found.' });
        }
        res.status(200).json(ads);
    }
    catch (error) {
        console.error('Error fetching public ads:', error);
        res.status(500).json({ message: 'Error fetching ads', error });
    }
}));
// Get main content ads for public view with complete casino information
router.get('/main-content', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Get all main content ads
        const ads = yield Ad_1.Ad.find({
            location: 'MainContent',
            isShowInMainPage: true
        })
            .select('title description link imageUrl rating service location isShowInMainPage percentageInHomePage orderInCasinosPage casino')
            .populate({
            path: 'casino',
            match: { isActive: true },
            select: 'name description logo website established ourRating userRating trustIndex ' +
                'categoryRatings payoutRatio payoutSpeed licenses securityMeasures fairnessVerification ' +
                'paymentMethods currencies minDeposit maxPayout contentSections advantages disadvantages ' +
                'isActive orderInListing offer'
        })
            .sort({ percentageInHomePage: -1 })
            .lean();
        // Log the populated data for debugging
        console.log('Populated main content ads with full data:', ads.map(ad => {
            var _a, _b;
            return ({
                adId: ad._id,
                title: ad.title,
                casinoId: (_a = ad.casino) === null || _a === void 0 ? void 0 : _a._id,
                casinoName: (_b = ad.casino) === null || _b === void 0 ? void 0 : _b.name,
                hasCasino: !!ad.casino
            });
        }));
        if (!ads || ads.length === 0) {
            return res.status(404).json({
                message: 'No main content ads found.',
                debug: {
                    totalAds: ads.length
                }
            });
        }
        res.status(200).json(ads);
    }
    catch (error) {
        console.error('Error fetching main content ads:', error);
        res.status(500).json({
            message: 'Error fetching main content ads',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
// Get public ads by location with complete casino information
router.get('/location/:location', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const ads = yield Ad_1.Ad.find({ location: req.params.location })
            .select('title description link imageUrl rating service location isShowInMainPage percentageInHomePage orderInCasinosPage casino')
            .populate({
            path: 'casino',
            select: 'name description logo website established ourRating userRating trustIndex ' +
                'categoryRatings payoutRatio payoutSpeed licenses securityMeasures fairnessVerification ' +
                'paymentMethods currencies minDeposit maxPayout contentSections advantages disadvantages ' +
                'isActive orderInListing'
        })
            .lean();
        // Add verification logging
        console.log(`Populated ads for location ${req.params.location}:`, ads.map(ad => {
            var _a, _b;
            return ({
                id: ad._id,
                title: ad.title,
                casinoName: (_a = ad.casino) === null || _a === void 0 ? void 0 : _a.name,
                casinoId: (_b = ad.casino) === null || _b === void 0 ? void 0 : _b._id
            });
        }));
        if (!ads || ads.length === 0) {
            return res.status(404).json({ message: 'No ads found for this location' });
        }
        res.status(200).json(ads);
    }
    catch (error) {
        console.error('Error fetching public ads by location:', error);
        res.status(500).json({ message: 'Error fetching ads by location', error });
    }
}));
// Get public ad by ID with complete casino information
router.get('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const ad = yield Ad_1.Ad.findById(req.params.id)
            .select('title description link imageUrl rating service location isShowInMainPage percentageInHomePage orderInCasinosPage casino')
            .populate({
            path: 'casino',
            select: 'name description logo website established ourRating userRating trustIndex ' +
                'categoryRatings payoutRatio payoutSpeed licenses securityMeasures fairnessVerification ' +
                'paymentMethods currencies minDeposit maxPayout contentSections advantages disadvantages ' +
                'isActive orderInListing'
        })
            .lean();
        // Add verification logging
        console.log(`Populated ad for ID ${req.params.id}:`, ad ? {
            id: ad._id,
            title: ad.title,
            casinoName: (_a = ad.casino) === null || _a === void 0 ? void 0 : _a.name,
            casinoId: (_b = ad.casino) === null || _b === void 0 ? void 0 : _b._id
        } : 'No ad found');
        if (!ad) {
            return res.status(404).json({ message: 'Ad not found' });
        }
        res.status(200).json(ad);
    }
    catch (error) {
        console.error('Error fetching public ad:', error);
        res.status(500).json({ message: 'Error fetching ad', error });
    }
}));
exports.default = router;
