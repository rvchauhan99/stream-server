const express = require('express');
const router = express.Router();
const  controller = require('../../controller/user/controller')    
const middleware = require('../../middleware/authMiddleware')


router.get('/search',middleware.checkUser ,  controller.searchUsers);
router.delete('/:id',middleware.validateAdmin , controller.deleteUser)
router.put('/:id',middleware.validateUser , controller.updateUser)
router.put("/:id/block", middleware.validateAdmin, controller.blockUser);
router.get('/users', middleware.validateAdmin, controller.getUsers);
router.get('/userStats', middleware.validateAdmin , controller.getUserStats);
router.get('/',middleware.validateAdmin , controller.getAllUsers)
router.post('/',middleware.validateAdmin , controller.createUser)
router.get('/:id',middleware.validateAdmin , controller.getUserById)




module.exports = router