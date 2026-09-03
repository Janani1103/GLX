import asyncHandler from 'express-async-handler';
import Settings from '../models/Settings.js';

// @desc    Get system settings
// @route   GET /api/settings
// @access  Private
export const getSettings = asyncHandler(async (req, res) => {
    let settings = await Settings.findOne();
    if (!settings) {
        settings = await Settings.create({ companyName: 'GLX Industries' });
    }
    res.json({ success: true, data: settings });
});

// @desc    Update system settings
// @route   PUT /api/settings
// @access  Private/Admin
export const updateSettings = asyncHandler(async (req, res) => {
    if (req.body.bossSignature && req.body.bossSignature.length > 3 * 1024 * 1024) {
        res.status(400);
        throw new Error('Signature image payload exceeds maximum allowed size (2MB)');
    }

    let settings = await Settings.findOne();
    
    if (!settings) {
        settings = new Settings(req.body);
    } else {
        Object.assign(settings, req.body);
    }

    settings.updatedBy = req.user._id;
    await settings.save();

    res.json({ success: true, data: settings });
});
