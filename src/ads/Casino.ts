import express from 'express';
import { Casino } from '../models/Casino';
import { Ad } from '../models/Ad';
import { verifyAdminAuth } from '../middlewares/adminauthenticationmiddleware';
import multer from 'multer';
import path from 'path';
import { processCasinoUpdateData } from '../utils/casinoValidation';

const router = express.Router();

// Debug logging utility
const debugLog = (data: any) => {
    if (process.env.NODE_ENV === 'development') {
        console.log(JSON.stringify(data, null, 2));
    }
};

// Storage configuration
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
const cleanArrayData = (data: string | string[] | any): any => {
    if (typeof data === 'string') {
        try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
                return parsed.map(item => {
                    if (typeof item === 'string') {
                        try {
                            // Only parse if it looks like JSON
                            if (item.startsWith('[') || item.startsWith('"')) {
                                const parsedItem = JSON.parse(item);
                                return Array.isArray(parsedItem) ? parsedItem[0] : parsedItem;
                            }
                            // Otherwise just return the cleaned string
                            return item.replace(/[\[\]"]/g, '').trim();
                        } catch {
                            return item.replace(/[\[\]"]/g, '').trim();
                        }
                    }
                    return item;
                }).filter(Boolean);
            }
            return parsed;
        } catch {
            // If JSON parsing fails, clean the string
            return data.replace(/[\[\]"]/g, '').trim();
        }
    }
    if (Array.isArray(data)) {
        return data.map(item => 
            typeof item === 'string' ? item.replace(/[\[\]"]/g, '').trim() : item
        ).filter(Boolean);
    }
    return data;
};
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Only images are allowed!'));
    }
});



const getNextOrderNumber = async () => {
    const lastCasino = await Casino.findOne({ isActive: true })
      .sort({ orderInListing: -1 })
      .limit(1);
    return (lastCasino?.orderInListing ?? -1) + 1;
  };
  const validateAdmin = (req: any): boolean => {
    if (!req.admin) return false;
    return req.admin.role === 'admin';
};
router.get('/:id', async (req, res) => {
    try {
        const casino = await Casino.findById(req.params.id)
            .populate('ads');

        if (!casino) {
            return res.status(404).json({ message: 'Casino not found' });
        }

        return res.status(200).json(casino);
    } catch (error) {
        console.error('Error fetching casino:', error);
        res.status(500).json({ message: 'Error fetching casino details', error });
    }
});
router.get('/', async (req, res) => {
    try {
        const casinos = await Casino.find({}) // Remove the isActive filter
            .sort({ orderInListing: 1 })
            .populate('ads');

        return res.status(200).json(casinos || []);
    } catch (error) {
        console.error('Error fetching casinos:', error);
        res.status(500).json({ message: 'Error fetching casinos', error });
    }
});

router.use(verifyAdminAuth);
// Create new casino
router.post('/', upload.single('logo'), async (req, res) => {
    if (!req.admin?.uid || !req.admin.email || !req.admin.role || req.admin.role !== 'admin') {
        return res.status(401).json({ message: 'Admin authentication required' });
    }

    try {
        const nextOrderNumber = await getNextOrderNumber();
        const logoUrl = req.file ? `/uploads/${req.file.filename}` : undefined;

        // Create a base casino object with default values
        const baseCasino = new Casino({
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

        // Parse JSON strings from form data
        let parsedBody = { ...req.body };
        
        try {
            // Parse JSON fields
            ['payoutRatio', 'payoutSpeed', 'termsAndConditions', 'categoryRatings', 
             'paymentMethods', 'contentSections'].forEach(field => {
                if (typeof req.body[field] === 'string') {
                    try {
                        parsedBody[field] = JSON.parse(req.body[field]);
                    } catch (e) {
                        console.error(`Error parsing ${field}:`, e);
                    }
                }
            });

            // Parse array fields
            ['currencies', 'advantages', 'disadvantages', 'licenses', 
             'securityMeasures', 'fairnessVerification'].forEach(field => {
                if (typeof req.body[field] === 'string') {
                    try {
                        parsedBody[field] = JSON.parse(req.body[field]);
                    } catch (e) {
                        parsedBody[field] = [];
                    }
                }
            });
        } catch (e) {
            console.error('Error parsing form data:', e);
        }

        // Process the data using our validation utilities
        const processedData = processCasinoUpdateData({
            ...parsedBody,
            logo: logoUrl,
            orderInListing: nextOrderNumber,
            createdBy: {
                email: req.admin.email,
                timestamp: new Date()
            },
            lastEditedBy: {
                email: req.admin.email,
                timestamp: new Date()
            }
        }, baseCasino);

        console.log('Processed casino data:', JSON.stringify(processedData, null, 2)); // Debug log

        const newCasino = new Casino(processedData);
        const savedCasino = await newCasino.save();

        res.status(201).json({
            message: 'Casino created successfully',
            casino: savedCasino
        });
    } catch (error) {
        console.error('Detailed error:', {
            name: error instanceof Error ? error.name : 'Unknown error',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
            stack: error instanceof Error ? error.stack : undefined,
            validationErrors: error instanceof Error && 'errors' in error ? (error as any).errors : undefined
        });

        if (error instanceof Error) {
            if (error.name === 'ValidationError') {
                return res.status(400).json({
                    message: 'Validation error',
                    errors: error.message
                });
            }
            if (error.name === 'MongoServerError' && (error as any).code === 11000) {
                return res.status(400).json({
                    message: 'A casino with this name already exists',
                    error: 'Duplicate name'
                });
            }
            res.status(500).json({ 
                message: 'Error creating casino', 
                error: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
            });
        } else {
            res.status(500).json({ message: 'Unknown error occurred' });
        }
    }
});
// Get single casino by ID

// Update casino
// Helper function to ensure numeric values with defaults
// Helper function to ensure numeric values with defaults
const ensureNumericValue = (value: any, defaultValue: number = 0): number => {
    const parsed = Number(value);
    return !isNaN(parsed) && parsed >= 0 ? parsed : defaultValue;
};

router.put('/:id', upload.single('logo'), async (req: any, res) => {
    try {
        if (!req.admin || !req.admin.email) {
            return res.status(401).json({ message: 'Admin authentication required' });
        }
        const casinoId = req.params.id;
        
        const existingCasino = await Casino.findById(casinoId);
        if (!existingCasino) {
            return res.status(404).json({ 
                message: 'Casino not found',
                casinoId: casinoId 
            });
        }

        // Parse JSON strings from form data
        let parsedBody = { ...req.body };

        // Parse payoutRatio if it's a string
        try {
            if (typeof req.body.payoutRatio === 'string') {
                parsedBody.payoutRatio = JSON.parse(req.body.payoutRatio);
            }
        } catch (e) {
            console.error('Error parsing payoutRatio:', e);
        }

        // Parse termsAndConditions if it's a string
        try {
            if (typeof req.body.termsAndConditions === 'string') {
                parsedBody.termsAndConditions = JSON.parse(req.body.termsAndConditions);
            }
        } catch (e) {
            console.error('Error parsing termsAndConditions:', e);
        }

        // Parse paymentMethods if it's a string
        try {
            if (typeof req.body.paymentMethods === 'string') {
                parsedBody.paymentMethods = JSON.parse(req.body.paymentMethods);
            }
        } catch (e) {
            console.error('Error parsing paymentMethods:', e);
        }

        // Prepare form data with parsed values
        const formData = {
            ...parsedBody,
            payoutRatio: {
                percentage: Number(parsedBody.payoutRatio?.percentage ?? existingCasino.payoutRatio.percentage),
                lastUpdated: new Date()
            },
            payoutSpeed: {
                averageDays: parsedBody.payoutSpeed?.averageDays || existingCasino.payoutSpeed.averageDays,
                details: parsedBody.payoutSpeed?.details || existingCasino.payoutSpeed.details
            },
            termsAndConditions: parsedBody.termsAndConditions || existingCasino.termsAndConditions
        };

        console.log('Processed form data:', formData); // Debug log

        // Process the data using our validation utilities
        const processedData = processCasinoUpdateData(formData, existingCasino);

        console.log('Final processed data:', processedData); // Debug log

        // Add the logo if uploaded
        if (req.file) {
            processedData.logo = `/uploads/${req.file.filename}`;
        }

        // Add admin info
        processedData.lastEditedBy = {
            email: req.admin?.email || '',
            timestamp: new Date()
        };

        // Update with processed data
        const updatedCasino = await Casino.findByIdAndUpdate(
            casinoId,
            { $set: processedData },
            { 
                new: true,
                runValidators: true,
                context: 'query'
            }
        ).populate('ads');

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
    } catch (error) {
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
});

// Add ad to casino
router.post('/:casinoId/ads', async (req, res) => {
    // Updated admin check
    if (!req.admin?.uid || !req.admin.email || !req.admin.role || req.admin.role !== 'admin') {
        return res.status(401).json({ message: 'Admin authentication required' });
    }

    try {
        const { adId } = req.body;
        const casinoId = req.params.casinoId;

        // Update the casino's ads array
        const casino = await Casino.findByIdAndUpdate(
            casinoId,
            { $addToSet: { ads: adId } },
            { new: true }
        ).populate('ads');

        // Update the ad's casino reference
        await Ad.findByIdAndUpdate(adId, { casino: casinoId });

        res.status(200).json({
            message: 'Ad added to casino successfully',
            casino
        });
    } catch (error) {
        console.error('Error adding ad to casino:', error);
        res.status(500).json({ message: 'Error adding ad to casino', error });
    }
});


// Remove ad from casino
router.delete('/:casinoId/ads/:adId', async (req, res) => {
    // Updated admin check
    if (!req.admin?.uid || !req.admin.email || !req.admin.role || req.admin.role !== 'admin') {
        return res.status(401).json({ message: 'Admin authentication required' });
    }

    try {
        const { casinoId, adId } = req.params;

        // Remove ad from casino's ads array
        const casino = await Casino.findByIdAndUpdate(
            casinoId,
            { $pull: { ads: adId } },
            { new: true }
        ).populate('ads');

        // Remove casino reference from ad
        await Ad.findByIdAndUpdate(adId, { $unset: { casino: "" } });

        res.status(200).json({
            message: 'Ad removed from casino successfully',
            casino
        });
    } catch (error) {
        console.error('Error removing ad from casino:', error);
        res.status(500).json({ message: 'Error removing ad from casino', error });
    }
});

// Delete casino
router.delete('/:id', async (req, res) => {
    if (!req.admin?.uid || !req.admin.email || !req.admin.role || req.admin.role !== 'admin') {
        return res.status(401).json({ message: 'Admin authentication required' });
    }

    try {
        // Instead of setting isActive to false, actually delete the casino
        const deletedCasino = await Casino.findByIdAndDelete(req.params.id);
        
        if (!deletedCasino) {
            return res.status(404).json({ message: 'Casino not found' });
        }

        // Remove casino reference from all associated ads
        await Ad.updateMany(
            { casino: req.params.id },
            { $unset: { casino: "" } }
        );

        res.status(200).json({
            message: 'Casino permanently deleted',
            casino: deletedCasino
        });
    } catch (error) {
        console.error('Error deleting casino:', error);
        res.status(500).json({ message: 'Error deleting casino', error });
    }
});

export default router;