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
const Casino_1 = require("../models/Casino");
const Ad_1 = require("../models/Ad");
const adminauthenticationmiddleware_1 = require("../middlewares/adminauthenticationmiddleware");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const casinoValidation_1 = require("../utils/casinoValidation");
const router = express_1.default.Router();
// Storage configuration
const storage = multer_1.default.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
const cleanArrayData = (data) => {
    if (typeof data === 'string') {
        try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
                return parsed.map(item => {
                    if (typeof item === 'string') {
                        try {
                            if (item.startsWith('[') || item.startsWith('"')) {
                                const parsedItem = JSON.parse(item);
                                return Array.isArray(parsedItem) ? parsedItem[0] : parsedItem;
                            }
                            return item.replace(/[\[\]"]/g, '').trim();
                        }
                        catch (_a) {
                            return item.replace(/[\[\]"]/g, '').trim();
                        }
                    }
                    return item;
                }).filter(Boolean);
            }
            return parsed;
        }
        catch (_a) {
            return data.replace(/[\[\]"]/g, '').trim();
        }
    }
    if (Array.isArray(data)) {
        return data.map(item => typeof item === 'string' ? item.replace(/[\[\]"]/g, '').trim() : item).filter(Boolean);
    }
    return data;
};
const upload = (0, multer_1.default)({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path_1.default.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Only images are allowed!'));
    }
});
const getNextOrderNumber = () => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const lastCasino = yield Casino_1.Casino.findOne({ isActive: true })
        .sort({ orderInListing: -1 })
        .limit(1);
    return ((_a = lastCasino === null || lastCasino === void 0 ? void 0 : lastCasino.orderInListing) !== null && _a !== void 0 ? _a : -1) + 1;
});
const validateAdmin = (req) => {
    if (!req.admin)
        return false;
    return req.admin.role === 'admin';
};
router.get('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const casino = yield Casino_1.Casino.findById(req.params.id)
            .populate('ads');
        if (!casino) {
            return res.status(404).json({ message: 'Casino not found' });
        }
        return res.status(200).json(casino);
    }
    catch (error) {
        console.error('Error fetching casino:', error);
        res.status(500).json({ message: 'Error fetching casino details', error });
    }
}));
router.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const casinos = yield Casino_1.Casino.find({})
            .sort({ orderInListing: 1 })
            .populate('ads');
        return res.status(200).json(casinos || []);
    }
    catch (error) {
        console.error('Error fetching casinos:', error);
        res.status(500).json({ message: 'Error fetching casinos', error });
    }
}));
router.use(adminauthenticationmiddleware_1.verifyAdminAuth);
router.post('/', upload.single('logo'), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if (!((_a = req.admin) === null || _a === void 0 ? void 0 : _a.uid) || !req.admin.email || !req.admin.role || req.admin.role !== 'admin') {
        return res.status(401).json({ message: 'Admin authentication required' });
    }
    try {
        const nextOrderNumber = yield getNextOrderNumber();
        const logoUrl = req.file ? `/uploads/${req.file.filename}` : undefined;
        const baseCasino = new Casino_1.Casino({
            payoutRatio: {
                percentage: 0,
                lastUpdated: new Date()
            },
            payoutSpeed: {
                averageDays: "2-3 days",
                details: ""
            },
            termsAndConditions: {
                firstDepositBonus: {
                    minDeposit: 0,
                    maxCashout: 0,
                    excludedPaymentMethods: [],
                    wageringRequirement: 0,
                    bonusExpirationDays: 0,
                    processingSpeed: "Instant",
                    freeSpinsConditions: {
                        wageringRequirement: 0,
                        maxCashout: 0,
                        expirationDays: 0
                    },
                    bonusPercentage: 0,
                    claimTimeLimit: 0,
                    currencies: []
                },
                generalTerms: [],
                eligibilityRequirements: [],
                restrictedCountries: [],
                additionalNotes: []
            },
            categoryRatings: [],
            contentSections: [],
            paymentMethods: [],
            currencies: [],
            advantages: [],
            disadvantages: [],
            licenses: [],
            securityMeasures: [],
            fairnessVerification: [],
            minDeposit: 0,
            maxPayout: 0,
            orderInListing: nextOrderNumber,
            isActive: true
        });
        let parsedBody = Object.assign({}, req.body);
        try {
            ['payoutRatio', 'payoutSpeed', 'termsAndConditions', 'categoryRatings',
                'paymentMethods', 'contentSections'].forEach(field => {
                if (typeof req.body[field] === 'string') {
                    try {
                        parsedBody[field] = JSON.parse(req.body[field]);
                    }
                    catch (e) {
                        console.error(`Error parsing ${field}:`, e);
                    }
                }
            });
            ['currencies', 'advantages', 'disadvantages', 'licenses',
                'securityMeasures', 'fairnessVerification'].forEach(field => {
                if (typeof req.body[field] === 'string') {
                    try {
                        parsedBody[field] = JSON.parse(req.body[field]);
                    }
                    catch (e) {
                        parsedBody[field] = [];
                    }
                }
            });
        }
        catch (e) {
            console.error('Error parsing form data:', e);
        }
        const processedData = (0, casinoValidation_1.processCasinoUpdateData)(Object.assign(Object.assign({}, parsedBody), { logo: logoUrl, orderInListing: nextOrderNumber, createdBy: {
                email: req.admin.email,
                timestamp: new Date()
            }, lastEditedBy: {
                email: req.admin.email,
                timestamp: new Date()
            } }), baseCasino);
        const newCasino = new Casino_1.Casino(processedData);
        const savedCasino = yield newCasino.save();
        res.status(201).json({
            message: 'Casino created successfully',
            casino: savedCasino
        });
    }
    catch (error) {
        console.error('Detailed error:', {
            name: error instanceof Error ? error.name : 'Unknown error',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
            stack: error instanceof Error ? error.stack : undefined,
            validationErrors: error instanceof Error && 'errors' in error ? error.errors : undefined
        });
        if (error instanceof Error) {
            if (error.name === 'ValidationError') {
                return res.status(400).json({
                    message: 'Validation error',
                    errors: error.message
                });
            }
            if (error.name === 'MongoServerError' && error.code === 11000) {
                return res.status(400).json({
                    message: 'A casino with this name already exists',
                    error: 'Duplicate name'
                });
            }
            res.status(500).json({
                message: 'Error creating casino',
                error: error.message
            });
        }
        else {
            res.status(500).json({ message: 'Unknown error occurred' });
        }
    }
}));
const ensureNumericValue = (value, defaultValue = 0) => {
    const parsed = Number(value);
    return !isNaN(parsed) && parsed >= 0 ? parsed : defaultValue;
};
router.put('/:id', upload.single('logo'), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
    try {
        if (!req.admin || !req.admin.email) {
            return res.status(401).json({ message: 'Admin authentication required' });
        }
        const casinoId = req.params.id;
        const existingCasino = yield Casino_1.Casino.findById(casinoId);
        if (!existingCasino) {
            return res.status(404).json({
                message: 'Casino not found',
                casinoId: casinoId
            });
        }
        let parsedBody = Object.assign({}, req.body);
        try {
            if (typeof req.body.payoutRatio === 'string') {
                parsedBody.payoutRatio = JSON.parse(req.body.payoutRatio);
            }
        }
        catch (e) {
            console.error('Error parsing payoutRatio:', e);
        }
        try {
            if (typeof req.body.termsAndConditions === 'string') {
                parsedBody.termsAndConditions = JSON.parse(req.body.termsAndConditions);
            }
        }
        catch (e) {
            console.error('Error parsing termsAndConditions:', e);
        }
        try {
            if (typeof req.body.paymentMethods === 'string') {
                parsedBody.paymentMethods = JSON.parse(req.body.paymentMethods);
            }
        }
        catch (e) {
            console.error('Error parsing paymentMethods:', e);
        }
        const formData = Object.assign(Object.assign({}, parsedBody), { payoutRatio: {
                percentage: Number((_b = (_a = parsedBody.payoutRatio) === null || _a === void 0 ? void 0 : _a.percentage) !== null && _b !== void 0 ? _b : existingCasino.payoutRatio.percentage),
                lastUpdated: new Date()
            }, payoutSpeed: {
                averageDays: ((_c = parsedBody.payoutSpeed) === null || _c === void 0 ? void 0 : _c.averageDays) || existingCasino.payoutSpeed.averageDays,
                details: ((_d = parsedBody.payoutSpeed) === null || _d === void 0 ? void 0 : _d.details) || existingCasino.payoutSpeed.details
            }, termsAndConditions: parsedBody.termsAndConditions || existingCasino.termsAndConditions });
        console.log('Processed form data:', formData);
        const processedData = (0, casinoValidation_1.processCasinoUpdateData)(formData, existingCasino);
        console.log('Final processed data:', processedData);
        if (req.file) {
            processedData.logo = `/uploads/${req.file.filename}`;
        }
        processedData.lastEditedBy = {
            email: ((_e = req.admin) === null || _e === void 0 ? void 0 : _e.email) || '',
            timestamp: new Date()
        };
        const updatedCasino = yield Casino_1.Casino.findByIdAndUpdate(casinoId, { $set: processedData }, {
            new: true,
            runValidators: true,
            context: 'query'
        }).populate('ads');
        if (!updatedCasino) {
            return res.status(404).json({
                message: 'Casino not found',
                casinoId: casinoId
            });
        }
        return res.status(200).json({
            message: 'Casino updated successfully',
            casino: updatedCasino
        });
    }
    catch (error) {
        console.error('Update error:', error);
        if (error instanceof Error) {
            if (error instanceof SyntaxError) {
                return res.status(400).json({
                    message: 'Invalid JSON in request body',
                    error: error.message
                });
            }
            if (error.name === 'ValidationError') {
                return res.status(400).json({
                    message: 'Validation error',
                    errors: error.message
                });
            }
            if (error.name === 'CastError') {
                return res.status(400).json({
                    message: 'Invalid data format',
                    errors: error.message
                });
            }
        }
        return res.status(500).json({
            message: 'Error updating casino',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
router.post('/:casinoId/ads', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if (!((_a = req.admin) === null || _a === void 0 ? void 0 : _a.uid) || !req.admin.email || !req.admin.role || req.admin.role !== 'admin') {
        return res.status(401).json({ message: 'Admin authentication required' });
    }
    try {
        const { adId } = req.body;
        const casinoId = req.params.casinoId;
        const casino = yield Casino_1.Casino.findByIdAndUpdate(casinoId, { $addToSet: { ads: adId } }, { new: true }).populate('ads');
        yield Ad_1.Ad.findByIdAndUpdate(adId, { casino: casinoId });
        res.status(200).json({
            message: 'Ad added to casino successfully',
            casino
        });
    }
    catch (error) {
        res.status(500).json({ message: 'Error adding ad to casino', error });
    }
}));
router.delete('/:casinoId/ads/:adId', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if (!((_a = req.admin) === null || _a === void 0 ? void 0 : _a.uid) || !req.admin.email || !req.admin.role || req.admin.role !== 'admin') {
        return res.status(401).json({ message: 'Admin authentication required' });
    }
    try {
        const { casinoId, adId } = req.params;
        const casino = yield Casino_1.Casino.findByIdAndUpdate(casinoId, { $pull: { ads: adId } }, { new: true }).populate('ads');
        yield Ad_1.Ad.findByIdAndUpdate(adId, { $unset: { casino: "" } });
        res.status(200).json({
            message: 'Ad removed from casino successfully',
            casino
        });
    }
    catch (error) {
        res.status(500).json({ message: 'Error removing ad from casino', error });
    }
}));
router.delete('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if (!((_a = req.admin) === null || _a === void 0 ? void 0 : _a.uid) || !req.admin.email || !req.admin.role || req.admin.role !== 'admin') {
        return res.status(401).json({ message: 'Admin authentication required' });
    }
    try {
        const deletedCasino = yield Casino_1.Casino.findByIdAndDelete(req.params.id);
        if (!deletedCasino) {
            return res.status(404).json({ message: 'Casino not found' });
        }
        yield Ad_1.Ad.updateMany({ casino: req.params.id }, { $unset: { casino: "" } });
        res.status(200).json({
            message: 'Casino permanently deleted',
            casino: deletedCasino
        });
    }
    catch (error) {
        res.status(500).json({ message: 'Error deleting casino', error });
    }
}));
exports.default = router;
