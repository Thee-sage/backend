import express from 'express';
import { Ad } from './models/Ad';
import { verifyAdminAuth } from './middlewares/adminauthenticationmiddleware';

const router = express.Router();

// Apply admin authentication to all routes
router.use(verifyAdminAuth);

// Get all ads with admin info included
router.get('/', async (req, res) => {
    try {
        const ads = await Ad.find({})
            .select({
                title: 1,
                description: 1,
                link: 1,
                imageUrl: 1,
                service: 1,
                location: 1,
                createdBy: 1,
                lastEditedBy: 1
            });

        if (!ads || ads.length === 0) {
            return res.status(404).json({ message: 'No ads found.' });
        }
        res.status(200).json(ads);
    } catch (error) {
        console.error('Error fetching ads:', error);
        res.status(500).json({ message: 'Error fetching ads', error });
    }
});

// Create new ad with admin info
router.post('/', async (req, res) => {
    const { title, description, link, imageUrl, service, location } = req.body;

    if (!req.admin || !req.admin.email) {
        return res.status(401).json({ message: 'Admin authentication required' });
    }

    try {
        const newAd = new Ad({
            title,
            description,
            link,
            imageUrl,
            service,
            location,
            createdBy: {
                email: req.admin.email,
                timestamp: new Date()
            },
            lastEditedBy: {
                email: req.admin.email,
                timestamp: new Date()
            }
        });

        const savedAd = await newAd.save();
        res.status(201).json({
            message: 'Ad created successfully',
            ad: {
                ...savedAd.toObject(),
                createdBy: {
                    email: req.admin.email,
                    timestamp: new Date()
                },
                lastEditedBy: {
                    email: req.admin.email,
                    timestamp: new Date()
                }
            }
        });
    } catch (error) {
        console.error('Error creating ad:', error);
        res.status(500).json({ message: 'Error creating ad', error });
    }
});

// Update ad by ID with admin info
router.put('/id/:id', async (req, res) => {
    if (!req.admin || !req.admin.email) {
        return res.status(401).json({ message: 'Admin authentication required' });
    }

    try {
        const { title, description, link, imageUrl, service, location } = req.body;
        const updatedAd = await Ad.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    title,
                    description,
                    link,
                    imageUrl,
                    service,
                    location,
                    lastEditedBy: {
                        email: req.admin.email,
                        timestamp: new Date()
                    }
                }
            },
            { new: true }
        );

        if (!updatedAd) {
            return res.status(404).json({ message: 'Ad not found' });
        }

        res.status(200).json({
            message: 'Ad updated successfully',
            ad: updatedAd
        });
    } catch (error) {
        console.error('Error updating ad:', error);
        res.status(500).json({ message: 'Error updating ad', error });
    }
});

// Get ad by ID with admin info
router.get('/:id', async (req, res) => {
    try {
        const ad = await Ad.findById(req.params.id);
        if (!ad) {
            return res.status(404).json({ message: 'Ad not found' });
        }
        res.status(200).json(ad);
    } catch (error) {
        console.error('Error fetching ad:', error);
        res.status(500).json({ message: 'Error fetching ad', error });
    }
});

// Get ad by location with admin info
router.get('/location/:location', async (req, res) => {
    try {
        const ad = await Ad.findOne({ location: req.params.location });
        if (!ad) {
            return res.status(404).json({ message: 'No ad found for this location' });
        }
        res.status(200).json(ad);
    } catch (error) {
        console.error('Error fetching ad by location:', error);
        res.status(500).json({ message: 'Error fetching ad by location', error });
    }
});

// Update or create ad by location with admin info
router.put('/location/:location', async (req, res) => {
    if (!req.admin || !req.admin.email) {
        return res.status(401).json({ message: 'Admin authentication required' });
    }

    const { title, description, link, imageUrl, service } = req.body;
    try {
        const ad = await Ad.findOneAndUpdate(
            { location: req.params.location },
            {
                $set: {
                    title,
                    description,
                    link,
                    imageUrl,
                    service,
                    lastEditedBy: {
                        email: req.admin.email,
                        timestamp: new Date()
                    }
                },
                $setOnInsert: {
                    createdBy: {
                        email: req.admin.email,
                        timestamp: new Date()
                    }
                }
            },
            {
                new: true,
                upsert: true
            }
        );

        res.status(200).json({
            message: ad.isNew ? 'Ad created successfully' : 'Ad updated successfully',
            ad
        });
    } catch (error) {
        console.error('Error updating ad by location:', error);
        res.status(500).json({ message: 'Error updating ad by location', error });
    }
});

export default router;