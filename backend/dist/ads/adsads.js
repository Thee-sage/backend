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
const Ad_1 = require("../models/Ad");
const adminauthenticationmiddleware_1 = require("../middlewares/adminauthenticationmiddleware");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const router = express_1.default.Router();
const storage = multer_1.default.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
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
router.use(adminauthenticationmiddleware_1.verifyAdminAuth);
router.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const ads = yield Ad_1.Ad.find({})
            .select({
            title: 1,
            description: 1,
            link: 1,
            imageUrl: 1,
            service: 1,
            rating: 1,
            location: 1,
            isShowInMainPage: 1,
            percentageInHomePage: 1,
            orderInCasinosPage: 1,
            createdBy: 1,
            lastEditedBy: 1,
            casino: 1 // Add this
        })
            .populate('casino', 'name logo') // Add this
            .sort({ orderInCasinosPage: 1 });
        if (!ads || ads.length === 0) {
            return res.status(404).json({ message: 'No ads found.' });
        }
        res.status(200).json(ads);
    }
    catch (error) {
        console.error('Error fetching ads:', error);
        res.status(500).json({ message: 'Error fetching ads', error });
    }
}));
router.post('/', upload.single('image'), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.admin || !req.admin.email) {
        return res.status(401).json({ message: 'Admin authentication required' });
    }
    try {
        let { title, description, link, service, location, rating, isShowInMainPage, percentageInHomePage, orderInCasinosPage, casino } = req.body;
        // Validate required fields
        if (!(title === null || title === void 0 ? void 0 : title.trim())) {
            return res.status(400).json({ message: 'Title is required' });
        }
        if (!(description === null || description === void 0 ? void 0 : description.trim())) {
            return res.status(400).json({ message: 'Description is required' });
        }
        if (!(link === null || link === void 0 ? void 0 : link.trim())) {
            return res.status(400).json({ message: 'Link is required' });
        }
        if (!(location === null || location === void 0 ? void 0 : location.trim())) {
            return res.status(400).json({ message: 'Location is required' });
        }
        // Convert and validate numeric values
        const numericRating = Number(rating);
        if (isNaN(numericRating) || numericRating < 0 || numericRating > 5) {
            return res.status(400).json({ message: 'Rating must be between 0 and 5' });
        }
        // Validate MainContent specific fields
        if (location === 'MainContent') {
            // Convert strings to proper types
            isShowInMainPage = isShowInMainPage === 'true';
            percentageInHomePage = Number(percentageInHomePage) || 0;
            orderInCasinosPage = Number(orderInCasinosPage) || 0;
            if (isShowInMainPage && percentageInHomePage) {
                const isValidPercentage = yield Ad_1.Ad.validateTotalPercentage(percentageInHomePage);
                if (!isValidPercentage) {
                    return res.status(400).json({ message: 'Total percentage exceeds 100%' });
                }
            }
            // Validate order in casinos page
            const isValidOrder = yield Ad_1.Ad.validateUniqueOrder(orderInCasinosPage);
            if (!isValidOrder) {
                return res.status(400).json({ message: 'This order number is already taken' });
            }
        }
        const imageUrl = req.file ? `/uploads/${req.file.filename}` : undefined;
        // Create new ad with validated data
        const adData = {
            title: title.trim(),
            description: description.trim(),
            link: link.trim(),
            imageUrl,
            service: service || 'Custom',
            location: location.trim(),
            rating: numericRating,
            isShowInMainPage: location === 'MainContent' ? isShowInMainPage : false,
            percentageInHomePage: location === 'MainContent' ? percentageInHomePage : 0,
            orderInCasinosPage: location === 'MainContent' ? orderInCasinosPage : 0,
            casino: casino || null,
            createdBy: {
                email: req.admin.email,
                timestamp: new Date()
            },
            lastEditedBy: {
                email: req.admin.email,
                timestamp: new Date()
            }
        };
        const newAd = new Ad_1.Ad(adData);
        try {
            const savedAd = yield newAd.save();
            // Populate casino details before sending response
            const populatedAd = yield Ad_1.Ad.findById(savedAd._id)
                .populate('casino', 'name logo');
            res.status(201).json({
                message: 'Ad created successfully',
                ad: populatedAd
            });
        }
        catch (saveError) {
            // Handle mongoose validation errors
            if (saveError.name === 'ValidationError') {
                const validationErrors = Object.values(saveError.errors)
                    .map((err) => err.message)
                    .join(', ');
                return res.status(400).json({
                    message: 'Validation failed',
                    errors: validationErrors
                });
            }
            throw saveError; // Re-throw if it's not a validation error
        }
    }
    catch (error) {
        console.error('Error creating ad:', error);
        // Handle specific error types
        if (error instanceof Error) {
            if (error.name === 'CastError') {
                return res.status(400).json({
                    message: 'Invalid data format',
                    error: error.message
                });
            }
            if (error.name === 'MongoServerError' && error.code === 11000) {
                return res.status(400).json({
                    message: 'Duplicate value found',
                    error: 'A unique constraint was violated'
                });
            }
        }
        res.status(500).json({
            message: 'Error creating ad',
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        });
    }
}));
router.get('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const ad = yield Ad_1.Ad.findById(req.params.id)
            .populate('casino', 'name logo');
        if (!ad) {
            return res.status(404).json({ message: 'Ad not found' });
        }
        res.status(200).json(ad);
    }
    catch (error) {
        console.error('Error fetching ad:', error);
        res.status(500).json({ message: 'Error fetching ad', error });
    }
}));
router.get('/location/:location', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const ad = yield Ad_1.Ad.findOne({ location: req.params.location });
        if (!ad) {
            return res.status(404).json({ message: 'No ad found for this location' });
        }
        res.status(200).json(ad);
    }
    catch (error) {
        console.error('Error fetching ad by location:', error);
        res.status(500).json({ message: 'Error fetching ad by location', error });
    }
}));
router.put('/id/:id', upload.single('image'), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.admin || !req.admin.email) {
        return res.status(401).json({ message: 'Admin authentication required' });
    }
    try {
        const { title, description, link, service, location, rating, isShowInMainPage, percentageInHomePage, orderInCasinosPage, casino // Add this
         } = req.body;
        if (location === 'MainContent' && isShowInMainPage === 'true' && percentageInHomePage) {
            const isValidPercentage = yield Ad_1.Ad.validateTotalPercentage(Number(percentageInHomePage), req.params.id);
            if (!isValidPercentage) {
                return res.status(400).json({ message: 'Total percentage exceeds 100%' });
            }
        }
        const updateData = {
            title,
            description,
            link,
            service,
            rating: Number(rating),
            location,
            isShowInMainPage: location === 'MainContent' ? isShowInMainPage === 'true' : false,
            percentageInHomePage: location === 'MainContent' ? Number(percentageInHomePage) : 0,
            orderInCasinosPage: location === 'MainContent' ? Number(orderInCasinosPage) : 0,
            casino: casino || null, // Add this
            lastEditedBy: {
                email: req.admin.email,
                timestamp: new Date()
            }
        };
        if (req.file) {
            updateData.imageUrl = `/uploads/${req.file.filename}`;
        }
        const updatedAd = yield Ad_1.Ad.findByIdAndUpdate(req.params.id, { $set: updateData }, { new: true }).populate('casino', 'name logo'); // Add this
        if (!updatedAd) {
            return res.status(404).json({ message: 'Ad not found' });
        }
        res.status(200).json({
            message: 'Ad updated successfully',
            ad: updatedAd
        });
    }
    catch (error) {
        console.error('Error updating ad:', error);
        res.status(500).json({ message: 'Error updating ad', error });
    }
}));
router.put('/location/:location', upload.single('image'), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.admin || !req.admin.email) {
        return res.status(401).json({ message: 'Admin authentication required' });
    }
    const { title, description, link, service, rating, isShowInMainPage, percentageInHomePage, orderInCasinosPage } = req.body;
    try {
        const updateData = {
            title,
            description,
            link,
            service,
            rating: Number(rating),
            isShowInMainPage: isShowInMainPage === 'true',
            percentageInHomePage: Number(percentageInHomePage),
            orderInCasinosPage: Number(orderInCasinosPage),
            lastEditedBy: {
                email: req.admin.email,
                timestamp: new Date()
            }
        };
        if (req.file) {
            updateData.imageUrl = `/uploads/${req.file.filename}`;
        }
        const ad = yield Ad_1.Ad.findOneAndUpdate({ location: req.params.location }, {
            $set: updateData,
            $setOnInsert: {
                createdBy: {
                    email: req.admin.email,
                    timestamp: new Date()
                }
            }
        }, {
            new: true,
            upsert: true
        });
        res.status(200).json({
            message: ad.isNew ? 'Ad created successfully' : 'Ad updated successfully',
            ad
        });
    }
    catch (error) {
        console.error('Error updating ad by location:', error);
        res.status(500).json({ message: 'Error updating ad by location', error });
    }
}));
router.delete('/id/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.admin || !req.admin.email) {
        return res.status(401).json({ message: 'Admin authentication required' });
    }
    try {
        const deletedAd = yield Ad_1.Ad.findByIdAndDelete(req.params.id);
        if (!deletedAd) {
            return res.status(404).json({ message: 'Ad not found' });
        }
        res.status(200).json({
            message: 'Ad deleted successfully',
            ad: deletedAd
        });
    }
    catch (error) {
        console.error('Error deleting ad:', error);
        res.status(500).json({ message: 'Error deleting ad', error });
    }
}));
exports.default = router;
