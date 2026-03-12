const express = require('express');
const router = express.Router();
const controller = require('../../controller/genericMaster/controller');
const middleware = require('../../middleware/authMiddleware'); // JWT middleware

router.post('/', middleware.validateAdmin, controller.createGenericMaster);
router.get('/:key', controller.getByKey);
router.get('/id/:id', controller.getById);
router.put('/:id', middleware.validateAdmin, controller.updateGenericMaster);
router.delete('/:id', middleware.validateAdmin, controller.deleteGenericMaster);

module.exports = router;
